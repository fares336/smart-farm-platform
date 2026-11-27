import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { keyMatches } from '../lib/deviceKeys.js';
import { findZoneForPoint } from '../lib/zones.js';
import { RANGES } from './measurements.js';

export const deviceIngestRouter = Router();

async function authDevice(req: Request) {
  const uidHeader = req.get('x-device-id');
  const auth = req.get('authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : req.get('x-device-key');
  if (!uidHeader || !key) throw new HttpError(401, 'Missing X-Device-Id or device key');
  const device = await prisma.robotDevice.findUnique({ where: { deviceUid: uidHeader } });
  if (!device || !keyMatches(key, device.apiKeyHash)) throw new HttpError(401, 'Invalid device credentials');
  return device;
}

const MAX_CLOCK_SKEW_MS = 10 * 60_000;
const MIN_VALID_EPOCH = Date.UTC(2023, 0, 1);

const reading = z.object({
  zone_id: z.string().trim().max(4).optional(),
  moisture: RANGES.moisture.nullish(),
  ph: RANGES.ph.nullish(),
  ec: RANGES.ec.nullish(),
  temperature: RANGES.temperature.nullish(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  message_id: z.string().max(64).optional(),
  gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  battery: z.number().min(0).max(100).optional(),
});

function parseTimestamp(ts: number | string | undefined, now: Date) {
  if (ts == null) return { at: now, note: 'server_time' };
  const d = typeof ts === 'number' ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts);
  if (Number.isNaN(d.getTime()) || d.getTime() < MIN_VALID_EPOCH) return { at: now, note: 'invalid_device_time_replaced' };
  if (d.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) throw new HttpError(422, 'Timestamp is in the future');
  return { at: d, note: null };
}

deviceIngestRouter.post('/measurements', ah(async (req, res) => {
  const device = await authDevice(req);
  const body = req.body?.readings ? parse(z.object({ readings: z.array(z.unknown()).min(1).max(100) }), req.body).readings : [req.body];
  const zones = await prisma.farmZone.findMany({ where: { farmId: device.farmId }, select: { id: true, code: true, polygon: true } });
  const byCode = new Map(zones.map((z) => [z.code.toUpperCase(), z]));
  const now = new Date();
  const results: { index: number; status: 'stored' | 'duplicate' | 'rejected'; id?: string; zone?: string; error?: unknown }[] = [];
  let lastZoneId: string | null = null;
  let battery: number | undefined;

  for (const [index, raw] of body.entries()) {
    const r = reading.safeParse(raw);
    if (!r.success) {
      results.push({ index, status: 'rejected', error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      continue;
    }
    const v = r.data;
    if ([v.moisture, v.ph, v.ec, v.temperature].every((x) => x == null)) {
      results.push({ index, status: 'rejected', error: 'No sensor values' });
      continue;
    }
    let zone = v.zone_id ? byCode.get(v.zone_id.toUpperCase()) : undefined;
    if (!zone && v.gps) zone = findZoneForPoint(zones, v.gps.lat, v.gps.lng);
    if (!zone) {
      results.push({ index, status: 'rejected', error: v.zone_id ? `Unknown zone_id ${v.zone_id} (expected A1–P16)` : 'zone_id or gps inside the farm boundary is required' });
      continue;
    }
    let ts;
    try {
      ts = parseTimestamp(v.timestamp, now);
    } catch (e) {
      results.push({ index, status: 'rejected', error: (e as Error).message });
      continue;
    }
    const dedupeKey = v.message_id ? `${device.id}:msg:${v.message_id}` : ts.note ? null : `${device.id}:${zone.id}:${ts.at.toISOString()}`;
    if (dedupeKey) {
      const dup = await prisma.soilMeasurement.findUnique({ where: { dedupeKey }, select: { id: true } });
      if (dup) {
        results.push({ index, status: 'duplicate', id: dup.id, zone: zone.code });
        continue;
      }
    }
    const m = await prisma.soilMeasurement.create({
      data: {
        farmId: device.farmId, zoneId: zone.id, deviceId: device.id, source: 'ROBOT',
        moisture: v.moisture, ph: v.ph, ec: v.ec, temperature: v.temperature,
        measuredAt: ts.at, gpsLat: v.gps?.lat, gpsLng: v.gps?.lng, messageId: v.message_id, dedupeKey,
        notes: ts.note === 'invalid_device_time_replaced' ? 'Device clock invalid; server time used' : null,
      },
    });
    lastZoneId = zone.id;
    if (v.battery != null) battery = v.battery;
    results.push({ index, status: 'stored', id: m.id, zone: zone.code });
  }

  const stored = results.filter((r) => r.status === 'stored').length;
  const rejected = results.filter((r) => r.status === 'rejected');
  await prisma.robotDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: now,
      ...(stored ? { lastDataAt: now } : {}),
      ...(lastZoneId ? { currentZoneId: lastZoneId } : {}),
      ...(battery != null ? { batteryPct: battery } : {}),
      ...(rejected.length && !stored ? { lastError: `Rejected reading: ${JSON.stringify(rejected[0].error).slice(0, 200)}`, lastErrorAt: now } : {}),
    },
  });
  const status = stored ? 201 : rejected.length === results.length ? 422 : 200;
  res.status(status).json({ stored, duplicates: results.filter((r) => r.status === 'duplicate').length, rejected: rejected.length, results });
}));

deviceIngestRouter.post('/heartbeat', ah(async (req, res) => {
  const device = await authDevice(req);
  const body = parse(z.object({ battery: z.number().min(0).max(100).optional(), firmware: z.string().max(40).optional(), zone_id: z.string().max(4).optional(), error: z.string().max(300).optional() }), req.body ?? {});
  let currentZoneId: string | undefined;
  if (body.zone_id) {
    const zone = await prisma.farmZone.findFirst({ where: { farmId: device.farmId, code: body.zone_id.toUpperCase() } });
    currentZoneId = zone?.id;
  }
  const now = new Date();
  await prisma.robotDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: now,
      batteryPct: body.battery,
      firmwareVersion: body.firmware,
      currentZoneId,
      ...(body.error ? { lastError: body.error, lastErrorAt: now } : {}),
    },
  });
  res.json({ ok: true, server_time: now.toISOString() });
}));

deviceIngestRouter.get('/config', ah(async (req, res) => {
  const device = await authDevice(req);
  await prisma.robotDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  const farm = await prisma.farm.findUniqueOrThrow({ where: { id: device.farmId }, select: { id: true, name: true } });
  res.json({ device_id: device.deviceUid, farm, zones: 'A1-P16', server_time: new Date().toISOString() });
}));
