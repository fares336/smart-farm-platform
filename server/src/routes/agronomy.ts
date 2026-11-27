import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm, ownedZone } from '../lib/ownership.js';
import { analyzeZone, cropInputs, loadFarmContext } from '../services/farmContext.js';
import { getWeatherSummary, refreshFarmWeather } from '../services/nasaPower.js';
import { recommendCrops } from '../lib/crops.js';

export const cropsRouter = Router();
cropsRouter.get('/', ah(async (_req, res) => {
  res.json({ crops: await prisma.crop.findMany({ orderBy: { nameEn: 'asc' } }) });
}));

export const farmAgronomyRouter = Router({ mergeParams: true });

const STALE_MS = 6 * 60 * 60 * 1000;

farmAgronomyRouter.get('/weather', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  let summary = await getWeatherSummary(farm.id);
  let refreshError: string | null = null;
  if (!summary || Date.now() - summary.lastFetchedAt.getTime() > STALE_MS) {
    const r = await refreshFarmWeather(farm);
    if (!r.ok) refreshError = r.error;
    summary = await getWeatherSummary(farm.id);
  }
  const records = await prisma.weatherRecord.findMany({ where: { farmId: farm.id }, orderBy: { date: 'asc' }, take: 365 });
  res.json({ summary, records, refreshError, source: 'NASA POWER (daily, community=AG)', note: 'NASA POWER daily data has a latency of several days; it is not a live observation.' });
}));

farmAgronomyRouter.post('/weather/refresh', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const r = await refreshFarmWeather(farm);
  if (!r.ok) throw new HttpError(502, `NASA POWER unavailable: ${r.error}`);
  res.json(r);
}));

farmAgronomyRouter.get('/crop-recommendations', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const ctx = await loadFarmContext(farm);
  const zones = ctx.zones
    .filter((z) => ctx.readings.get(z.id)?.lastAt)
    .map((z) => ({ zoneId: z.id, code: z.code, recommendations: recommendCrops(ctx.crops, cropInputs(ctx, ctx.readings.get(z.id)!)) }));
  res.json({ zones, totalZones: ctx.zones.length, airTemp30: ctx.weather?.mean30.t2m ?? null, waterAvailability: farm.waterAvailability });
}));

farmAgronomyRouter.post('/zones/:zoneId/crop-recommendations', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const zone = await ownedZone(uid(req), req.params.zoneId);
  if (zone.farmId !== farm.id) throw new HttpError(404, 'Zone not found');
  const ctx = await loadFarmContext(farm, zone.id);
  const r = ctx.readings.get(zone.id);
  if (!r?.lastAt) throw new HttpError(400, 'No measurements available for this zone');
  const inputs = cropInputs(ctx, r);
  const results = recommendCrops(ctx.crops, inputs);
  const saved = await prisma.cropRecommendation.create({ data: { farmId: farm.id, zoneId: zone.id, inputs: inputs as object, results: results as object } });
  res.status(201).json({ recommendation: saved });
}));

farmAgronomyRouter.get('/irrigation', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const ctx = await loadFarmContext(farm);
  const zones = ctx.zones.map((z) => {
    const a = analyzeZone(ctx, z);
    return { zoneId: z.id, code: z.code, cropKey: a.crop?.key ?? null, growthStage: z.growthStage, areaM2: z.areaM2, advice: a.irrigation };
  });
  const records = await prisma.irrigationRecord.findMany({ where: { farmId: farm.id }, orderBy: { date: 'desc' }, take: 300, include: { zone: { select: { code: true } } } });
  const monthly = await prisma.$queryRaw<{ month: Date; volume: number; events: bigint }[]>(Prisma.sql`
    SELECT date_trunc('month', date) AS month, SUM("volumeM3") AS volume, COUNT(*) AS events
    FROM "IrrigationRecord" WHERE "farmId" = ${farm.id} GROUP BY 1 ORDER BY 1`);
  const daily = await prisma.$queryRaw<{ day: Date; volume: number }[]>(Prisma.sql`
    SELECT date_trunc('day', date) AS day, SUM("volumeM3") AS volume
    FROM "IrrigationRecord" WHERE "farmId" = ${farm.id} AND date >= NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1`);
  res.json({
    zones,
    summary: {
      urgent: zones.filter((z) => z.advice.status === 'urgent').length,
      irrigate: zones.filter((z) => z.advice.status === 'irrigate').length,
      ok: zones.filter((z) => z.advice.status === 'ok').length,
      tooWet: zones.filter((z) => z.advice.status === 'too_wet').length,
      noData: zones.filter((z) => z.advice.status === 'no_data').length,
      et0Mean7: ctx.weather?.et0Mean7 ?? null,
    },
    records,
    monthly: monthly.map((m) => ({ ...m, events: Number(m.events) })),
    daily,
    note: 'Water savings are only reported when comparable historical usage records exist.',
  });
}));

const irrigationBody = z.object({
  zoneId: z.string().nullish(),
  date: z.coerce.date(),
  volumeM3: z.number().positive().max(1_000_000),
  durationMin: z.number().positive().max(10_000).nullish(),
  method: z.string().max(60).nullish(),
  notes: z.string().max(500).nullish(),
});

farmAgronomyRouter.post('/irrigation-records', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const body = parse(irrigationBody, req.body);
  if (body.zoneId && !(await prisma.farmZone.findFirst({ where: { id: body.zoneId, farmId: farm.id } }))) throw new HttpError(400, 'Zone does not belong to this farm');
  res.status(201).json({ record: await prisma.irrigationRecord.create({ data: { ...body, farmId: farm.id } }) });
}));

farmAgronomyRouter.delete('/irrigation-records/:id', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const r = await prisma.irrigationRecord.deleteMany({ where: { id: req.params.id, farmId: farm.id } });
  if (!r.count) throw new HttpError(404, 'Record not found');
  res.json({ ok: true });
}));
