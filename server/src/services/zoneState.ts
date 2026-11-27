import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export type Metric = 'moisture' | 'ph' | 'ec' | 'temperature';
export const METRICS: Metric[] = ['moisture', 'ph', 'ec', 'temperature'];

export interface Reading {
  value: number;
  at: Date;
  source: 'ROBOT' | 'MANUAL' | 'LAB';
}
export type ZoneReadings = Partial<Record<Metric, Reading>> & { lastAt?: Date };

/** Latest non-null value of each metric per zone (each zone keeps its own data; nothing is copied). */
export async function latestZoneReadings(farmId: string, zoneId?: string): Promise<Map<string, ZoneReadings>> {
  const out = new Map<string, ZoneReadings>();
  for (const m of METRICS) {
    const rows = await prisma.$queryRaw<{ zoneId: string; value: number; at: Date; source: Reading['source'] }[]>(Prisma.sql`
      SELECT DISTINCT ON ("zoneId") "zoneId", ${Prisma.raw(`"${m}"`)} AS value, "measuredAt" AS at, "source"
      FROM "SoilMeasurement"
      WHERE "farmId" = ${farmId} AND ${Prisma.raw(`"${m}"`)} IS NOT NULL
      ${zoneId ? Prisma.sql`AND "zoneId" = ${zoneId}` : Prisma.empty}
      ORDER BY "zoneId", "measuredAt" DESC`);
    for (const r of rows) {
      const z = out.get(r.zoneId) ?? {};
      z[m] = { value: r.value, at: r.at, source: r.source };
      if (!z.lastAt || r.at > z.lastAt) z.lastAt = r.at;
      out.set(r.zoneId, z);
    }
  }
  return out;
}

export function averages(readings: Iterable<ZoneReadings>) {
  const acc: Record<Metric, number[]> = { moisture: [], ph: [], ec: [], temperature: [] };
  for (const z of readings) for (const m of METRICS) if (z[m]) acc[m].push(z[m]!.value);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    moisture: avg(acc.moisture),
    ph: avg(acc.ph),
    ec: avg(acc.ec),
    temperature: avg(acc.temperature),
    zonesMeasured: Math.max(...METRICS.map((m) => acc[m].length)),
  };
}
