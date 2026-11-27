import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm } from '../lib/ownership.js';

export const measurementsRouter = Router({ mergeParams: true });

export const RANGES = {
  moisture: z.number().min(0).max(100),
  ph: z.number().min(0).max(14),
  ec: z.number().min(0).max(30),
  temperature: z.number().min(-20).max(70),
};

const manualBody = z.object({
  zoneId: z.string(),
  source: z.enum(['MANUAL', 'LAB']),
  moisture: RANGES.moisture.nullish(),
  ph: RANGES.ph.nullish(),
  ec: RANGES.ec.nullish(),
  temperature: RANGES.temperature.nullish(),
  nitrogenPpm: z.number().min(0).max(10_000).nullish(),
  phosphorusPpm: z.number().min(0).max(10_000).nullish(),
  potassiumPpm: z.number().min(0).max(10_000).nullish(),
  organicMatterPct: z.number().min(0).max(100).nullish(),
  measuredAt: z.coerce.date(),
  notes: z.string().max(500).nullish(),
});

measurementsRouter.get('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const q = parse(z.object({ zoneId: z.string().optional(), source: z.enum(['ROBOT', 'MANUAL', 'LAB']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(1000).default(200) }), req.query);
  const items = await prisma.soilMeasurement.findMany({
    where: { farmId: farm.id, zoneId: q.zoneId, source: q.source, measuredAt: { gte: q.from, lte: q.to } },
    orderBy: { measuredAt: 'desc' }, take: q.limit,
    include: { zone: { select: { code: true } }, device: { select: { name: true, deviceUid: true } } },
  });
  res.json({ items });
}));

measurementsRouter.post('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const body = parse(manualBody, req.body);
  const zone = await prisma.farmZone.findFirst({ where: { id: body.zoneId, farmId: farm.id } });
  if (!zone) throw new HttpError(400, 'Zone does not belong to this farm');
  const vals = [body.moisture, body.ph, body.ec, body.temperature, body.nitrogenPpm, body.phosphorusPpm, body.potassiumPpm, body.organicMatterPct];
  if (vals.every((v) => v == null)) throw new HttpError(400, 'Enter at least one measured value');
  if (body.measuredAt.getTime() > Date.now() + 5 * 60_000) throw new HttpError(400, 'Measurement date cannot be in the future');
  const m = await prisma.soilMeasurement.create({ data: { ...body, farmId: farm.id, isDemo: farm.isDemo } });
  res.status(201).json({ measurement: m });
}));

measurementsRouter.delete('/:id', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const r = await prisma.soilMeasurement.deleteMany({ where: { id: req.params.id, farmId: farm.id } });
  if (!r.count) throw new HttpError(404, 'Measurement not found');
  res.json({ ok: true });
}));

/** Daily averages for charts. */
measurementsRouter.get('/timeseries', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const q = parse(z.object({ zoneId: z.string().optional(), days: z.coerce.number().int().min(1).max(730).default(90) }), req.query);
  const since = new Date(Date.now() - q.days * 86_400_000);
  const rows = await prisma.$queryRaw<{ day: Date; moisture: number | null; ph: number | null; ec: number | null; temperature: number | null; n: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', "measuredAt") AS day, AVG(moisture) AS moisture, AVG(ph) AS ph, AVG(ec) AS ec, AVG(temperature) AS temperature, COUNT(*) AS n
    FROM "SoilMeasurement" WHERE "farmId" = ${farm.id} AND "measuredAt" >= ${since}
    ${q.zoneId ? Prisma.sql`AND "zoneId" = ${q.zoneId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1`);
  res.json({ series: rows.map((r) => ({ ...r, n: Number(r.n) })) });
}));
