import type { Crop, Farm, FarmZone } from '@prisma/client';
import { prisma } from '../db.js';
import { recommendCrops, type CropInputs } from '../lib/crops.js';
import { irrigationAdvice, type GrowthStage } from '../lib/irrigation.js';
import { decideZone } from '../lib/decision.js';
import { config } from '../config.js';
import { getWeatherSummary } from './nasaPower.js';
import { latestZoneReadings, type ZoneReadings } from './zoneState.js';

export interface FarmContext {
  farm: Farm;
  zones: FarmZone[];
  readings: Map<string, ZoneReadings>;
  crops: Crop[];
  cropByKey: Map<string, Crop>;
  weather: Awaited<ReturnType<typeof getWeatherSummary>>;
}

export async function loadFarmContext(farm: Farm, zoneId?: string): Promise<FarmContext> {
  const [zones, readings, crops, weather] = await Promise.all([
    prisma.farmZone.findMany({ where: { farmId: farm.id, ...(zoneId ? { id: zoneId } : {}) }, orderBy: [{ row: 'asc' }, { col: 'asc' }] }),
    latestZoneReadings(farm.id, zoneId),
    prisma.crop.findMany({ orderBy: { nameEn: 'asc' } }),
    getWeatherSummary(farm.id),
  ]);
  return { farm, zones, readings, crops, cropByKey: new Map(crops.map((c) => [c.key, c])), weather };
}

export function zoneCrop(ctx: FarmContext, zone: FarmZone) {
  const key = zone.cropKey ?? ctx.farm.defaultCropKey;
  return key ? ctx.cropByKey.get(key) ?? null : null;
}

export function cropInputs(ctx: FarmContext, r: ZoneReadings): CropInputs {
  return {
    ph: r.ph?.value,
    moisture: r.moisture?.value,
    ec: r.ec?.value,
    soilTemp: r.temperature?.value,
    airTemp: ctx.weather?.mean30.t2m ?? null,
    waterAvailability: (ctx.farm.waterAvailability as CropInputs['waterAvailability']) ?? null,
  };
}

export function analyzeZone(
  ctx: FarmContext,
  zone: FarmZone,
  extra: { nutrientFindings?: { nutrient: string; confidence: number | null; at: Date }[]; diseases?: { name: string; confidence: number | null; at: Date }[] } = {},
) {
  const readings = ctx.readings.get(zone.id) ?? {};
  const crop = zoneCrop(ctx, zone);
  const hasData = !!readings.lastAt;
  const recommendations = hasData ? recommendCrops(ctx.crops, cropInputs(ctx, readings)) : [];
  const irrigation = irrigationAdvice({
    moisture: readings.moisture?.value ?? null,
    crop,
    stage: zone.growthStage as GrowthStage | null,
    et0MmDay: ctx.weather?.et0Mean7 ?? null,
    zoneAreaM2: zone.areaM2,
    recentRainMm: ctx.weather?.rain3 ?? null,
  });
  const decision = decideZone({
    zoneCode: zone.code,
    readings,
    crop,
    weather: ctx.weather ? { maxTemp3: ctx.weather.maxTemp3, rain3: ctx.weather.rain3, mean30T: ctx.weather.mean30.t2m } : null,
    irrigation,
    nutrientFindings: extra.nutrientFindings ?? [],
    diseases: extra.diseases ?? [],
    staleDays: config.surveyWindowDays,
  });
  return { readings, crop, recommendations, irrigation, decision };
}

/** Latest AI findings linked to zones of a farm, grouped by zone id. */
export async function aiFindingsByZone(farmId: string) {
  const [nutr, dis] = await Promise.all([
    prisma.nutrientAnalysis.findMany({ where: { status: 'COMPLETED', image: { farmId, zoneId: { not: null } } }, include: { image: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.diseaseReport.findMany({ where: { status: 'COMPLETED', image: { farmId, zoneId: { not: null } } }, include: { image: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);
  const nutrientFindings = new Map<string, { nutrient: string; confidence: number | null; at: Date }[]>();
  const diseases = new Map<string, { name: string; confidence: number | null; at: Date }[]>();
  for (const n of nutr) {
    const zid = n.image.zoneId!;
    if (nutrientFindings.has(zid)) continue;
    const fs = ((n.results as { findings?: { nutrient: string; confidence: number | null }[] })?.findings ?? []).map((f) => ({ ...f, at: n.createdAt }));
    nutrientFindings.set(zid, fs);
  }
  for (const d of dis) {
    const zid = d.image.zoneId!;
    if (diseases.has(zid)) continue;
    const cs = ((d.results as { candidates?: { name: string; confidence: number | null }[] })?.candidates ?? []).map((c) => ({ ...c, at: d.createdAt }));
    diseases.set(zid, cs);
  }
  return { nutrientFindings, diseases };
}
