import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm } from '../lib/ownership.js';
import { recommendFertilizer, type FertilizerInputs } from '../lib/fertilizer.js';
import { NUTRIENT_KEYS, type NutrientKey } from '../lib/nutrients.js';
import { latestZoneReadings } from '../services/zoneState.js';

export const fertilizerRouter = Router({ mergeParams: true });

const body = z.object({
  zoneId: z.string().nullish(),
  cropKey: z.string().min(1).max(40),
  growthStage: z.string().max(40).nullish(),
  areaHa: z.number().positive().nullish(),
  suspected: z.array(z.enum(NUTRIENT_KEYS as [NutrientKey, ...NutrientKey[]])).default([]),
  useLatestImageAnalysis: z.boolean().default(true),
});

fertilizerRouter.post('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const b = parse(body, req.body);
  let ph: number | null = null;
  let ec: number | null = null;
  let lab: FertilizerInputs['lab'] = null;
  const suspected: FertilizerInputs['suspected'] = b.suspected.map((n) => ({ nutrient: n, source: 'user' as const }));
  if (b.zoneId) {
    if (!(await prisma.farmZone.findFirst({ where: { id: b.zoneId, farmId: farm.id } }))) throw new HttpError(400, 'Zone does not belong to this farm');
    const r = (await latestZoneReadings(farm.id, b.zoneId)).get(b.zoneId);
    ph = r?.ph?.value ?? null;
    ec = r?.ec?.value ?? null;
    const labRow = await prisma.soilMeasurement.findFirst({ where: { zoneId: b.zoneId, source: 'LAB' }, orderBy: { measuredAt: 'desc' } });
    if (labRow) lab = { nitrogenPpm: labRow.nitrogenPpm, phosphorusPpm: labRow.phosphorusPpm, potassiumPpm: labRow.potassiumPpm };
    if (b.useLatestImageAnalysis) {
      const na = await prisma.nutrientAnalysis.findFirst({ where: { status: 'COMPLETED', image: { zoneId: b.zoneId } }, orderBy: { createdAt: 'desc' } });
      for (const f of (na?.results as { findings?: { nutrient: string; confidence: number | null }[] } | null)?.findings ?? []) {
        if ((NUTRIENT_KEYS as string[]).includes(f.nutrient)) suspected.push({ nutrient: f.nutrient as NutrientKey, source: 'image_ai', confidence: f.confidence });
      }
    }
  }
  const inputs: FertilizerInputs = { cropKey: b.cropKey, growthStage: b.growthStage, farmAreaHa: b.areaHa ?? farm.areaHectares, ph, ec, lab, suspected };
  const results = recommendFertilizer(inputs);
  const saved = await prisma.fertilizerRecommendation.create({ data: { farmId: farm.id, zoneId: b.zoneId, cropKey: b.cropKey, growthStage: b.growthStage, inputs: inputs as object, results: results as object } });
  res.status(201).json({ recommendation: saved });
}));

fertilizerRouter.get('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  res.json({ items: await prisma.fertilizerRecommendation.findMany({ where: { farmId: farm.id }, orderBy: { createdAt: 'desc' }, take: 30, include: { zone: { select: { code: true } } } }) });
}));
