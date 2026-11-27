import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { config } from '../config.js';
import { ownedFarm } from '../lib/ownership.js';
import { aiStatus, getProvider } from '../services/ai/providers.js';
import { latestZoneReadings } from '../services/zoneState.js';
import { NUTRIENTS } from '../lib/nutrients.js';

export const aiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

/** Validate by magic bytes, not by client-provided MIME type. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

const meta = z.object({
  farmId: z.string().optional(),
  zoneId: z.string().optional(),
  cropKey: z.string().max(40).optional(),
  growthStage: z.string().max(40).optional(),
});

async function storeImage(userId: string, file: Express.Multer.File | undefined, body: unknown, purpose: 'disease' | 'nutrient') {
  if (!file) throw new HttpError(400, 'Image file is required (field name "image")');
  const mime = sniffImage(file.buffer);
  if (!mime) throw new HttpError(415, 'Only JPEG, PNG or WebP images are accepted');
  const m = parse(meta, body);
  if (m.farmId) await ownedFarm(userId, m.farmId);
  if (m.zoneId) {
    if (!m.farmId) throw new HttpError(400, 'farmId is required with zoneId');
    if (!(await prisma.farmZone.findFirst({ where: { id: m.zoneId, farmId: m.farmId } }))) throw new HttpError(400, 'Zone does not belong to this farm');
  }
  const storedName = `${crypto.randomUUID()}.${mime.split('/')[1]}`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, storedName), file.buffer);
  const image = await prisma.plantImage.create({
    data: { userId, farmId: m.farmId, zoneId: m.zoneId, storedName, mimeType: mime, sizeBytes: file.size, cropKey: m.cropKey, growthStage: m.growthStage, purpose },
  });
  return { image, mime, meta: m };
}

aiRouter.get('/status', (_req, res) => {
  res.json(aiStatus());
});

aiRouter.post('/disease', upload.single('image'), ah(async (req, res) => {
  const { image, mime, meta: m } = await storeImage(uid(req), req.file, req.body, 'disease');
  const provider = getProvider('disease');
  if (!provider?.diagnoseDisease) {
    const report = await prisma.diseaseReport.create({ data: { imageId: image.id, provider: config.ai.diseaseProvider, status: 'UNAVAILABLE', errorMessage: 'No AI diagnosis provider is configured on the server.' } });
    return res.status(503).json({ report, imageId: image.id, available: false });
  }
  try {
    const result = await provider.diagnoseDisease({ buffer: req.file!.buffer, mimeType: mime, cropKey: m.cropKey });
    result.candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const report = await prisma.diseaseReport.create({ data: { imageId: image.id, provider: provider.name, status: 'COMPLETED', results: { ...result, calibrated: false } as object } });
    res.status(201).json({ report, imageId: image.id, available: true });
  } catch (e) {
    const report = await prisma.diseaseReport.create({ data: { imageId: image.id, provider: provider.name, status: 'FAILED', errorMessage: (e as Error).message.slice(0, 500) } });
    res.status(502).json({ report, imageId: image.id, available: true, error: 'AI provider request failed' });
  }
}));

aiRouter.post('/nutrients', upload.single('image'), ah(async (req, res) => {
  const { image, mime, meta: m } = await storeImage(uid(req), req.file, req.body, 'nutrient');
  let context: Record<string, unknown> = {};
  if (m.farmId && m.zoneId) {
    const r = (await latestZoneReadings(m.farmId, m.zoneId)).get(m.zoneId) ?? {};
    context = { soilPh: r.ph?.value ?? null, soilEcDsM: r.ec?.value ?? null, soilMoisturePct: r.moisture?.value ?? null, soilTempC: r.temperature?.value ?? null };
  }
  const provider = getProvider('nutrient');
  if (!provider?.analyzeNutrients) {
    const analysis = await prisma.nutrientAnalysis.create({ data: { imageId: image.id, provider: config.ai.nutrientProvider, status: 'UNAVAILABLE', context: context as object, errorMessage: 'No AI nutrient-analysis provider is configured on the server.' } });
    return res.status(503).json({ analysis, available: false, reference: NUTRIENTS });
  }
  try {
    const result = await provider.analyzeNutrients({ buffer: req.file!.buffer, mimeType: mime, cropKey: m.cropKey, growthStage: m.growthStage, context });
    result.findings.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const analysis = await prisma.nutrientAnalysis.create({ data: { imageId: image.id, provider: provider.name, status: 'COMPLETED', results: result as object, context: context as object } });
    res.status(201).json({ analysis, available: true, reference: NUTRIENTS });
  } catch (e) {
    const analysis = await prisma.nutrientAnalysis.create({ data: { imageId: image.id, provider: provider.name, status: 'FAILED', context: context as object, errorMessage: (e as Error).message.slice(0, 500) } });
    res.status(502).json({ analysis, available: true, error: 'AI provider request failed' });
  }
}));

aiRouter.get('/history', ah(async (req, res) => {
  const q = parse(z.object({ purpose: z.enum(['disease', 'nutrient']).optional() }), req.query);
  const images = await prisma.plantImage.findMany({
    where: { userId: uid(req), purpose: q.purpose },
    orderBy: { createdAt: 'desc' }, take: 50,
    include: { diseaseReports: true, nutrientAnalyses: true, zone: { select: { code: true } }, farm: { select: { name: true } } },
  });
  res.json({ images });
}));

aiRouter.get('/nutrient-reference', (_req, res) => {
  res.json({ nutrients: NUTRIENTS });
});

/** Images are private: served only to their owner through an authenticated route. */
aiRouter.get('/images/:id', ah(async (req, res) => {
  const img = await prisma.plantImage.findFirst({ where: { id: req.params.id, userId: uid(req) } });
  if (!img) throw new HttpError(404, 'Image not found');
  res.setHeader('Content-Type', img.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(await fs.readFile(path.join(config.uploadDir, path.basename(img.storedName))));
}));
