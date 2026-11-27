import { Router } from 'express';
import { z } from 'zod';
import type { Polygon } from 'geojson';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm, ownedZone } from '../lib/ownership.js';
import { generateZones, polygonAreaHectares, squareBoundary, validateBoundary } from '../lib/zones.js';
import { aiFindingsByZone, analyzeZone, loadFarmContext } from '../services/farmContext.js';
import { refreshFarmWeather } from '../services/nasaPower.js';

export const farmsRouter = Router();

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1),
});

const farmBody = z.object({
  name: z.string().trim().min(1).max(120),
  areaHectares: z.number().positive().max(100_000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().max(200).nullish(),
  boundary: polygonSchema.nullish(),
  waterSource: z.string().max(100).nullish(),
  waterAvailability: z.enum(['low', 'medium', 'high']).nullish(),
  soilTexture: z.string().max(60).nullish(),
  defaultCropKey: z.string().max(40).nullish(),
});

function resolveGeometry(body: { areaHectares?: number; latitude: number; longitude: number; boundary?: Polygon | null }) {
  if (body.boundary) {
    const err = validateBoundary(body.boundary);
    if (err) throw new HttpError(400, err);
    return { boundary: body.boundary, areaHectares: polygonAreaHectares(body.boundary), source: 'user' };
  }
  if (!body.areaHectares) throw new HttpError(400, 'Provide either a farm boundary or the farm area');
  return { boundary: squareBoundary(body.latitude, body.longitude, body.areaHectares), areaHectares: body.areaHectares, source: 'generated_square' };
}

farmsRouter.get('/', ah(async (req, res) => {
  const farms = await prisma.farm.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { zones: true, devices: true } } } });
  res.json({ farms });
}));

farmsRouter.post('/', ah(async (req, res) => {
  const body = parse(farmBody, req.body);
  const geo = resolveGeometry(body as typeof body & { boundary?: Polygon | null });
  const zones = generateZones(geo.boundary);
  const farm = await prisma.$transaction(async (tx) => {
    const f = await tx.farm.create({
      data: {
        userId: uid(req), name: body.name, areaHectares: geo.areaHectares, latitude: body.latitude, longitude: body.longitude,
        locationName: body.locationName, waterSource: body.waterSource, waterAvailability: body.waterAvailability, soilTexture: body.soilTexture, defaultCropKey: body.defaultCropKey,
        boundary: { create: { geojson: geo.boundary as object, source: geo.source } },
      },
    });
    await tx.farmZone.createMany({ data: zones.map((z) => ({ ...z, polygon: z.polygon as object, farmId: f.id })) });
    return f;
  }, { timeout: 30_000 });
  refreshFarmWeather(farm).catch(() => undefined);
  res.status(201).json({ farm });
}));

farmsRouter.get('/:farmId', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const boundary = await prisma.farmBoundary.findUnique({ where: { farmId: farm.id } });
  const zoneCount = await prisma.farmZone.count({ where: { farmId: farm.id } });
  res.json({ farm, boundary, zoneCount });
}));

farmsRouter.patch('/:farmId', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const body = parse(farmBody.partial(), req.body);
  const geomChanged = body.boundary !== undefined || body.areaHectares !== undefined || body.latitude !== undefined || body.longitude !== undefined;
  const data: Record<string, unknown> = { ...body };
  delete data.boundary;
  if (geomChanged) {
    const geo = resolveGeometry({
      latitude: body.latitude ?? farm.latitude,
      longitude: body.longitude ?? farm.longitude,
      areaHectares: body.areaHectares ?? farm.areaHectares,
      boundary: (body.boundary as Polygon | null | undefined) ?? (body.areaHectares !== undefined ? null : ((await prisma.farmBoundary.findUnique({ where: { farmId: farm.id } }))?.geojson as Polygon | undefined) ?? null),
    });
    data.areaHectares = geo.areaHectares;
    const zones = generateZones(geo.boundary);
    await prisma.$transaction(async (tx) => {
      await tx.farmBoundary.upsert({ where: { farmId: farm.id }, create: { farmId: farm.id, geojson: geo.boundary as object, source: geo.source }, update: { geojson: geo.boundary as object, source: geo.source } });
      // Zone IDs (A1…P16) are kept so that historical measurements stay attached to their zone.
      for (const z of zones) {
        await tx.farmZone.update({ where: { farmId_code: { farmId: farm.id, code: z.code } }, data: { polygon: z.polygon as object, centroidLat: z.centroidLat, centroidLng: z.centroidLng, areaM2: z.areaM2 } });
      }
    }, { timeout: 60_000 });
  }
  const updated = await prisma.farm.update({ where: { id: farm.id }, data });
  res.json({ farm: updated });
}));

farmsRouter.delete('/:farmId', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  await prisma.farm.delete({ where: { id: farm.id } });
  res.json({ ok: true });
}));

farmsRouter.get('/:farmId/zones', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const ctx = await loadFarmContext(farm);
  const ai = await aiFindingsByZone(farm.id);
  const zones = ctx.zones.map((z) => {
    const a = analyzeZone(ctx, z, { nutrientFindings: ai.nutrientFindings.get(z.id), diseases: ai.diseases.get(z.id) });
    return {
      id: z.id, code: z.code, row: z.row, col: z.col, polygon: z.polygon, centroidLat: z.centroidLat, centroidLng: z.centroidLng, areaM2: z.areaM2,
      cropKey: z.cropKey, growthStage: z.growthStage,
      readings: a.readings,
      status: a.decision.status,
      irrigationStatus: a.irrigation.status,
      topCrop: a.recommendations[0] ? { key: a.recommendations[0].cropKey, nameEn: a.recommendations[0].nameEn, nameAr: a.recommendations[0].nameAr, suitability: a.recommendations[0].suitability } : null,
    };
  });
  const boundary = await prisma.farmBoundary.findUnique({ where: { farmId: farm.id } });
  res.json({ farm, boundary: boundary?.geojson ?? null, zones });
}));

const zoneUpdate = z.object({ cropKey: z.string().max(40).nullable().optional(), growthStage: z.enum(['initial', 'development', 'mid', 'late']).nullable().optional() });

farmsRouter.patch('/:farmId/zones', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const body = parse(zoneUpdate.extend({ zoneIds: z.array(z.string()).optional() }), req.body);
  const { zoneIds, ...data } = body;
  const r = await prisma.farmZone.updateMany({ where: { farmId: farm.id, ...(zoneIds ? { id: { in: zoneIds } } : {}) }, data });
  res.json({ updated: r.count });
}));

export const zonesRouter = Router();

zonesRouter.get('/:zoneId', ah(async (req, res) => {
  const zone = await ownedZone(uid(req), req.params.zoneId);
  const farm = await prisma.farm.findUniqueOrThrow({ where: { id: zone.farmId } });
  const ctx = await loadFarmContext(farm, zone.id);
  const ai = await aiFindingsByZone(farm.id);
  const analysis = analyzeZone(ctx, zone, { nutrientFindings: ai.nutrientFindings.get(zone.id), diseases: ai.diseases.get(zone.id) });
  const history = await prisma.soilMeasurement.findMany({ where: { zoneId: zone.id }, orderBy: { measuredAt: 'desc' }, take: 100, include: { device: { select: { name: true, deviceUid: true } } } });
  const latestLab = await prisma.soilMeasurement.findFirst({ where: { zoneId: zone.id, source: 'LAB' }, orderBy: { measuredAt: 'desc' } });
  res.json({
    zone, farm: { id: farm.id, name: farm.name, isDemo: farm.isDemo }, weather: ctx.weather, ...analysis, history,
    nutrients: {
      lab: latestLab ? { nitrogenPpm: latestLab.nitrogenPpm, phosphorusPpm: latestLab.phosphorusPpm, potassiumPpm: latestLab.potassiumPpm, organicMatterPct: latestLab.organicMatterPct, measuredAt: latestLab.measuredAt } : null,
      imageFindings: ai.nutrientFindings.get(zone.id) ?? [],
    },
  });
}));

zonesRouter.patch('/:zoneId', ah(async (req, res) => {
  const zone = await ownedZone(uid(req), req.params.zoneId);
  const body = parse(zoneUpdate, req.body);
  res.json({ zone: await prisma.farmZone.update({ where: { id: zone.id }, data: body }) });
}));
