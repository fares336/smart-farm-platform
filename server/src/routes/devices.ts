import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm } from '../lib/ownership.js';
import { newDeviceKey, newDeviceUid } from '../lib/deviceKeys.js';
import { robotStatus } from '../lib/robotStatus.js';
import { config } from '../config.js';
import { ZONE_COUNT } from '../lib/zones.js';

export const devicesRouter = Router({ mergeParams: true });

function publicDevice(d: Awaited<ReturnType<typeof prisma.robotDevice.findFirstOrThrow>> & { currentZone?: { code: string } | null }) {
  const { apiKeyHash: _h, ...rest } = d;
  return { ...rest, status: robotStatus(d) };
}

function apiBase(req: { protocol: string; get(h: string): string | undefined }) {
  return config.publicApiUrl || `${req.protocol}://${req.get('host')}`;
}

async function ownedDevice(userId: string, deviceId: string) {
  const d = await prisma.robotDevice.findFirst({ where: { id: deviceId, farm: { userId } }, include: { currentZone: { select: { code: true } } } });
  if (!d) throw new HttpError(404, 'Device not found');
  return d;
}

devicesRouter.get('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const devices = await prisma.robotDevice.findMany({ where: { farmId: farm.id }, include: { currentZone: { select: { code: true } } }, orderBy: { createdAt: 'asc' } });
  const since = new Date(Date.now() - config.surveyWindowDays * 86_400_000);
  const measured = await prisma.soilMeasurement.findMany({ where: { farmId: farm.id, source: 'ROBOT', measuredAt: { gte: since } }, distinct: ['zoneId'], select: { zone: { select: { code: true } } } });
  res.json({
    devices: devices.map(publicDevice),
    progress: { windowDays: config.surveyWindowDays, measuredZones: measured.map((m) => m.zone.code), measured: measured.length, total: ZONE_COUNT },
    ingestUrl: `${apiBase(req)}/api/device/v1/measurements`,
  });
}));

devicesRouter.post('/', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const body = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body);
  const k = newDeviceKey();
  const d = await prisma.robotDevice.create({ data: { farmId: farm.id, name: body.name, deviceUid: newDeviceUid(), apiKeyHash: k.hash, apiKeyPrefix: k.prefix }, include: { currentZone: { select: { code: true } } } });
  const base = apiBase(req);
  res.status(201).json({ device: publicDevice(d), apiKey: k.key, pairing: { server: base, device_id: d.deviceUid, device_key: k.key } });
}));

export const deviceRouter = Router();

deviceRouter.get('/:deviceId', ah(async (req, res) => {
  const d = await ownedDevice(uid(req), req.params.deviceId);
  const recent = await prisma.soilMeasurement.findMany({ where: { deviceId: d.id }, orderBy: { measuredAt: 'desc' }, take: 100, include: { zone: { select: { code: true } } } });
  res.json({ device: publicDevice(d), measurements: recent });
}));

deviceRouter.patch('/:deviceId', ah(async (req, res) => {
  const d = await ownedDevice(uid(req), req.params.deviceId);
  const body = parse(z.object({ name: z.string().trim().min(1).max(80) }), req.body);
  const u = await prisma.robotDevice.update({ where: { id: d.id }, data: body, include: { currentZone: { select: { code: true } } } });
  res.json({ device: publicDevice(u) });
}));

deviceRouter.post('/:deviceId/rotate-key', ah(async (req, res) => {
  const d = await ownedDevice(uid(req), req.params.deviceId);
  const k = newDeviceKey();
  await prisma.robotDevice.update({ where: { id: d.id }, data: { apiKeyHash: k.hash, apiKeyPrefix: k.prefix } });
  res.json({ apiKey: k.key, pairing: { server: apiBase(req), device_id: d.deviceUid, device_key: k.key } });
}));

deviceRouter.delete('/:deviceId', ah(async (req, res) => {
  const d = await ownedDevice(uid(req), req.params.deviceId);
  await prisma.robotDevice.delete({ where: { id: d.id } });
  res.json({ ok: true });
}));
