import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';

const app = createApp();
const stamp = Date.now();
const emailA = `a-${stamp}@test.local`;
const emailB = `b-${stamp}@test.local`;
const agentA = request.agent(app);
const agentB = request.agent(app);
let farmId = '';
let deviceUid = '';
let deviceKey = '';

beforeAll(async () => {
  await agentA.post('/api/auth/signup').send({ name: 'User A', email: emailA, password: 'Secret123!' }).expect(201);
  await agentB.post('/api/auth/signup').send({ name: 'User B', email: emailB, password: 'Secret123!' }).expect(201);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects wrong password and unauthenticated requests', async () => {
    await request(app).post('/api/auth/login').send({ email: emailA, password: 'wrong-pass1' }).expect(401);
    await request(app).get('/api/farms').expect(401);
  });
});

describe('farms & isolation', () => {
  it('creates a farm with 256 zones', async () => {
    const r = await agentA.post('/api/farms').send({ name: 'F', latitude: 30.1, longitude: 31.1, areaHectares: 4 }).expect(201);
    farmId = r.body.farm.id;
    const z = await agentA.get(`/api/farms/${farmId}/zones`).expect(200);
    expect(z.body.zones).toHaveLength(256);
    expect(z.body.zones.every((x: { status: string }) => x.status === 'no_data')).toBe(true);
  });
  it('another user cannot read the farm', async () => {
    await agentB.get(`/api/farms/${farmId}`).expect(404);
    await agentB.get(`/api/farms/${farmId}/zones`).expect(404);
  });
});

describe('ESP32 ingestion', () => {
  it('registers a device and returns the key once', async () => {
    const r = await agentA.post(`/api/farms/${farmId}/devices`).send({ name: 'R1' }).expect(201);
    deviceUid = r.body.device.deviceUid;
    deviceKey = r.body.apiKey;
    expect(r.body.device.apiKeyHash).toBeUndefined();
  });
  it('rejects bad credentials', async () => {
    await request(app).post('/api/device/v1/measurements').set('X-Device-Id', deviceUid).set('Authorization', 'Bearer nope').send({ zone_id: 'A1', moisture: 20 }).expect(401);
  });
  it('stores a valid reading only in its own zone and deduplicates', async () => {
    const body = { zone_id: 'B3', moisture: 21.5, ph: 7.4, ec: 1.8, temperature: 22, timestamp: Math.floor(Date.now() / 1000) - 60, message_id: 'm-1' };
    const send = () => request(app).post('/api/device/v1/measurements').set('X-Device-Id', deviceUid).set('Authorization', `Bearer ${deviceKey}`).send(body);
    const r1 = await send().expect(201);
    expect(r1.body.stored).toBe(1);
    const r2 = await send().expect(200);
    expect(r2.body.duplicates).toBe(1);
    const zones = (await agentA.get(`/api/farms/${farmId}/zones`)).body.zones as { code: string; readings: { moisture?: { value: number; source: string } } }[];
    expect(zones.find((z) => z.code === 'B3')!.readings.moisture).toMatchObject({ value: 21.5, source: 'ROBOT' });
    expect(zones.filter((z) => z.readings.moisture).length).toBe(1);
  });
  it('rejects invalid values and unknown zones', async () => {
    const r = await request(app).post('/api/device/v1/measurements').set('X-Device-Id', deviceUid).set('Authorization', `Bearer ${deviceKey}`).send({ readings: [{ zone_id: 'Z9', moisture: 20 }, { zone_id: 'A1', ph: 15 }] }).expect(422);
    expect(r.body.rejected).toBe(2);
  });
});

describe('manual & AI', () => {
  it('manual measurement requires a zone of the same farm', async () => {
    await agentA.post(`/api/farms/${farmId}/measurements`).send({ zoneId: 'nope', source: 'MANUAL', moisture: 30, measuredAt: new Date().toISOString() }).expect(400);
  });
  it('AI returns UNAVAILABLE (no fabricated result) when no provider is configured', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const r = await agentA.post('/api/ai/disease').attach('image', jpeg, 'leaf.jpg').field('farmId', farmId).expect(503);
    expect(r.body.report.status).toBe('UNAVAILABLE');
    expect(r.body.report.results).toBeNull();
  });
  it('rejects non-image uploads by content', async () => {
    await agentA.post('/api/ai/disease').attach('image', Buffer.from('<?php echo 1; ?>'), 'x.jpg').expect(415);
  });
});
