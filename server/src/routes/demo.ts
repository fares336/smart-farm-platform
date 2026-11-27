import { Router } from 'express';
import { prisma } from '../db.js';
import { ah } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { generateZones, squareBoundary } from '../lib/zones.js';
import { refreshFarmWeather } from '../services/nasaPower.js';

export const demoRouter = Router();

/** Seeded pseudo-random generator so demo data is reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Creates a separate farm flagged isDemo=true. Its simulated readings are labelled as demo everywhere. */
demoRouter.post('/farm', ah(async (req, res) => {
  const lat = 30.0444;
  const lng = 31.2357;
  const boundary = squareBoundary(lat, lng, 10);
  const zones = generateZones(boundary);
  const rand = rng(42);
  const farm = await prisma.farm.create({
    data: { userId: uid(req), name: 'Demo Farm (simulated data)', areaHectares: 10, latitude: lat, longitude: lng, locationName: 'Giza, Egypt (demo)', waterAvailability: 'medium', defaultCropKey: 'wheat', isDemo: true, boundary: { create: { geojson: boundary as object, source: 'demo' } } },
  });
  await prisma.farmZone.createMany({ data: zones.map((z) => ({ ...z, polygon: z.polygon as object, farmId: farm.id, growthStage: 'mid' })) });
  const dbZones = await prisma.farmZone.findMany({ where: { farmId: farm.id } });
  const now = Date.now();
  const rows = [];
  for (const z of dbZones) {
    if (rand() < 0.25) continue; // leave some zones unmeasured on purpose
    for (let d = 3; d >= 0; d--) {
      const gradient = z.col / 15;
      rows.push({
        farmId: farm.id, zoneId: z.id, source: 'MANUAL' as const, isDemo: true,
        moisture: +(22 + gradient * 30 + rand() * 10).toFixed(1),
        ph: +(7.2 + (z.row / 15) * 1.0 + rand() * 0.3).toFixed(2),
        ec: +(1.0 + gradient * 4 + rand() * 1.2).toFixed(2),
        temperature: +(18 + rand() * 6).toFixed(1),
        measuredAt: new Date(now - d * 7 * 86_400_000 - rand() * 3_600_000),
        notes: 'DEMO – simulated value',
      });
    }
  }
  await prisma.soilMeasurement.createMany({ data: rows });
  await prisma.financialSeason.create({
    data: {
      farmId: farm.id, name: 'Demo winter season', cropKey: 'wheat',
      expenses: { create: [
        { category: 'seeds', amountEgp: 15000, date: new Date(now - 120 * 86_400_000), description: 'DEMO', isEstimate: true },
        { category: 'fertilizers', amountEgp: 22000, date: new Date(now - 100 * 86_400_000), description: 'DEMO', isEstimate: true },
        { category: 'labor', amountEgp: 18000, date: new Date(now - 60 * 86_400_000), description: 'DEMO', isEstimate: true },
      ] },
      harvests: { create: [{ cropKey: 'wheat', quantityTon: 25, date: new Date(now - 5 * 86_400_000), isEstimate: true }] },
      sales: { create: [{ cropKey: 'wheat', quantityTon: 20, pricePerTonEgp: 4000, date: new Date(now - 2 * 86_400_000), isEstimate: true, buyer: 'DEMO' }] },
    },
  });
  refreshFarmWeather(farm).catch(() => undefined);
  res.status(201).json({ farm });
}));
