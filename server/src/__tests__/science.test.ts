import { describe, expect, it } from 'vitest';
import type { Crop } from '@prisma/client';
import { generateZones, squareBoundary, findZoneForPoint, polygonAreaHectares, validateBoundary, ZONE_COUNT } from '../lib/zones.js';
import { maasHoffman, recommendCrops, scoreCrop, trapezoid } from '../lib/crops.js';
import { hargreavesEt0, irrigationAdvice } from '../lib/irrigation.js';
import { summarize, welchTTest } from '../lib/stats.js';
import { financialSummary } from '../lib/finance.js';
import { recommendFertilizer } from '../lib/fertilizer.js';

const wheat = { id: '1', key: 'wheat', nameEn: 'Wheat', nameAr: 'القمح', phMin: 5.5, phOptMin: 6, phOptMax: 7.5, phMax: 8.5, tempMin: 3, tempOptMin: 15, tempOptMax: 24, tempMax: 32, moistureMin: 15, moistureOptMin: 22, moistureOptMax: 32, ecThreshold: 6, ecSlope: 7.1, kcIni: 0.7, kcMid: 1.15, kcEnd: 0.3, waterNeedMm: '450-650', seasonEn: null, seasonAr: null, references: '' } as Crop;
const beans = { ...wheat, id: '2', key: 'beans', nameEn: 'Beans', nameAr: 'الفول', ecThreshold: 1.0, ecSlope: 19 } as Crop;

describe('zones', () => {
  it('splits a farm into 256 zones covering its area', () => {
    const b = squareBoundary(30, 31, 10);
    expect(polygonAreaHectares(b)).toBeCloseTo(10, 1);
    const zones = generateZones(b);
    expect(zones).toHaveLength(ZONE_COUNT);
    expect(new Set(zones.map((z) => z.code)).size).toBe(256);
    expect(zones[0].code).toBe('A1');
    expect(zones[255].code).toBe('P16');
    const total = zones.reduce((a, z) => a + z.areaM2, 0);
    expect(total / 10_000).toBeCloseTo(10, 1);
  });
  it('maps a GPS point to the zone that contains it', () => {
    const zones = generateZones(squareBoundary(30, 31, 10));
    const z = zones[37];
    expect(findZoneForPoint(zones, z.centroidLat, z.centroidLng)?.code).toBe(z.code);
    expect(findZoneForPoint(zones, 31, 32)).toBeUndefined();
  });
  it('rejects self-intersecting boundaries', () => {
    const bow = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] };
    expect(validateBoundary(bow)).not.toBeNull();
  });
});

describe('crop scoring', () => {
  it('trapezoid is 1 in optimum and 0 outside limits', () => {
    expect(trapezoid(7, 5, 6, 7.5, 8.5)).toBe(1);
    expect(trapezoid(9, 5, 6, 7.5, 8.5)).toBe(0);
    expect(trapezoid(8, 5, 6, 7.5, 8.5)).toBeCloseTo(0.5);
  });
  it('Maas–Hoffman yield decline', () => {
    expect(maasHoffman(6, 6, 7.1)).toBe(1);
    expect(maasHoffman(10, 6, 7.1)).toBeCloseTo(1 - (4 * 7.1) / 100);
  });
  it('salt-tolerant crop ranks above salt-sensitive crop at high EC', () => {
    const r = recommendCrops([beans, wheat], { ph: 7, moisture: 25, ec: 5, temperature: 20 });
    expect(r[0].cropKey).toBe('wheat');
  });
  it('missing data reduces coverage instead of being invented', () => {
    const s = scoreCrop(wheat, { ph: 7 });
    expect(s.dataCoverage).toBeLessThan(100);
    expect(s.components.find((c) => c.factor === 'salinity')?.score).toBeNull();
  });
});

describe('irrigation', () => {
  it('Hargreaves ET0 is in a realistic range for Cairo in summer', () => {
    const et0 = hargreavesEt0(29, 36, 22, 30, new Date('2026-07-15'));
    expect(et0).toBeGreaterThan(5);
    expect(et0).toBeLessThan(9);
  });
  it('no moisture → no_data, dry → urgent', () => {
    expect(irrigationAdvice({ moisture: null, crop: wheat, stage: 'mid', et0MmDay: 5, zoneAreaM2: 100, recentRainMm: 0 }).status).toBe('no_data');
    expect(irrigationAdvice({ moisture: 10, crop: wheat, stage: 'mid', et0MmDay: 5, zoneAreaM2: 100, recentRainMm: 0 }).status).toBe('urgent');
  });
});

describe('statistics', () => {
  it('Welch t-test needs ≥2 replicates', () => {
    expect(welchTTest([1], [2, 3])).toBeNull();
    const r = welchTTest([20, 22, 21], [30, 33, 31]);
    expect(r!.p).toBeLessThan(0.01);
  });
  it('summary with a single value has no SD/CI', () => {
    expect(summarize([5]).sd).toBeNull();
  });
});

describe('finance', () => {
  it('keeps actual and estimated separate', () => {
    const d = new Date();
    const s = financialSummary(
      [{ category: 'seeds', amountEgp: 1000, isEstimate: false, date: d }, { category: 'labor', amountEgp: 9999, isEstimate: true, date: d }],
      [{ quantityTon: 10, isEstimate: false, date: d }],
      [{ quantityTon: 5, pricePerTonEgp: 400, isEstimate: false, date: d }],
    );
    expect(s.actual.totalCosts).toBe(1000);
    expect(s.actual.totalRevenue).toBe(2000);
    expect(s.actual.unsoldTon).toBe(5);
    expect(s.estimated.totalCosts).toBe(9999);
  });
});

describe('fertilizer', () => {
  it('never produces numeric doses and never recommends sodium', () => {
    const r = recommendFertilizer({ cropKey: 'wheat', suspected: [{ nutrient: 'N', source: 'user' }, { nutrient: 'K', source: 'image_ai', confidence: 0.6 }], ph: 8.3, ec: 5 });
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/\d+\s?(kg|كجم)\s?\/\s?(ha|fed|فدان)/i);
    for (const it of r.items) for (const f of it.recommendedFertilizers) expect(f.name.en.toLowerCase()).not.toMatch(/sodium/);
    expect(r.items.find((i) => i.nutrient === 'K')?.confidence).not.toBe('high');
  });
});
