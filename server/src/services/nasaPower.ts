import { prisma } from '../db.js';
import { hargreavesEt0 } from '../lib/irrigation.js';

const BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M'];
const FILL = -999;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export interface PowerDay {
  date: Date;
  t2m: number | null;
  t2mMax: number | null;
  t2mMin: number | null;
  rh2m: number | null;
  precipMm: number | null;
  solarMjM2: number | null;
  windMs: number | null;
  et0Mm: number | null;
}

export function parsePowerResponse(json: unknown, lat: number): PowerDay[] {
  const p = (json as { properties?: { parameter?: Record<string, Record<string, number>> } })?.properties?.parameter;
  if (!p || !p.T2M) throw new Error('Unexpected NASA POWER response');
  const v = (k: string, day: string) => {
    const x = p[k]?.[day];
    return x == null || x === FILL || Number.isNaN(x) ? null : x;
  };
  return Object.keys(p.T2M)
    .sort()
    .map((day) => {
      const date = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)));
      const t2m = v('T2M', day);
      const t2mMax = v('T2M_MAX', day);
      const t2mMin = v('T2M_MIN', day);
      return {
        date,
        t2m,
        t2mMax,
        t2mMin,
        rh2m: v('RH2M', day),
        precipMm: v('PRECTOTCORR', day),
        solarMjM2: v('ALLSKY_SFC_SW_DWN', day),
        windMs: v('WS2M', day),
        et0Mm: t2m != null && t2mMax != null && t2mMin != null ? hargreavesEt0(t2m, t2mMax, t2mMin, lat, date) : null,
      };
    })
    .filter((d) => d.t2m != null || d.precipMm != null);
}

export async function fetchPower(lat: number, lng: number, days = 45): Promise<PowerDay[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const url = `${BASE}?parameters=${PARAMS.join(',')}&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
    return parsePowerResponse(await res.json(), lat);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch and persist; on failure, keep previously stored data and report the error. */
export async function refreshFarmWeather(farm: { id: string; latitude: number; longitude: number }) {
  try {
    const days = await fetchPower(farm.latitude, farm.longitude);
    const fetchedAt = new Date();
    for (const d of days) {
      await prisma.weatherRecord.upsert({
        where: { farmId_date: { farmId: farm.id, date: d.date } },
        create: { farmId: farm.id, ...d, fetchedAt },
        update: { ...d, fetchedAt },
      });
    }
    return { ok: true as const, count: days.length };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function getWeatherSummary(farmId: string) {
  const records = await prisma.weatherRecord.findMany({ where: { farmId }, orderBy: { date: 'desc' }, take: 60 });
  if (!records.length) return null;
  const last30 = records.slice(0, 30);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const latest = records[0];
  return {
    latest,
    latestDate: latest.date,
    lastFetchedAt: records.reduce((m, r) => (r.fetchedAt > m ? r.fetchedAt : m), records[0].fetchedAt),
    mean30: { t2m: avg(last30.map((r) => r.t2m)), rh2m: avg(last30.map((r) => r.rh2m)), precipTotal: last30.reduce((a, r) => a + (r.precipMm ?? 0), 0) },
    et0Mean7: avg(records.slice(0, 7).map((r) => r.et0Mm)),
    rain3: records.slice(0, 3).reduce((a, r) => a + (r.precipMm ?? 0), 0),
    maxTemp3: Math.max(...records.slice(0, 3).map((r) => r.t2mMax ?? -99)),
  };
}
