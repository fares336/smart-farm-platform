import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm } from '../lib/ownership.js';
import { summarize, welchTTest } from '../lib/stats.js';

export const biopodRouter = Router();

async function ownedExperiment(userId: string, id: string) {
  const e = await prisma.bioPodExperiment.findFirst({ where: { id, userId }, include: { groups: { include: { observations: { orderBy: [{ day: 'asc' }, { replicate: 'asc' }] } } } } });
  if (!e) throw new HttpError(404, 'Experiment not found');
  return e;
}

export type ExperimentFull = Awaited<ReturnType<typeof ownedExperiment>>;

/** Per-group summaries and comparisons against the control group, only where replicates allow. */
export function analyzeExperiment(e: ExperimentFull) {
  const days = [...new Set(e.groups.flatMap((g) => g.observations.map((o) => o.day)))].sort((a, b) => a - b);
  const series = days.map((day) => {
    const row: Record<string, number | null> = { day };
    for (const g of e.groups) {
      const xs = g.observations.filter((o) => o.day === day).map((o) => o.moisture);
      row[g.name] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    }
    return row;
  });
  const lastDay = days[days.length - 1];
  const firstDay = days[0];
  const groups = e.groups.map((g) => {
    const final = g.observations.filter((o) => o.day === lastDay).map((o) => o.moisture);
    const initial = g.observations.filter((o) => o.day === firstDay).map((o) => o.moisture);
    const retention = initial.length && final.length && lastDay !== firstDay
      ? g.observations
          .filter((o) => o.day === lastDay)
          .map((o) => {
            const init = g.observations.find((x) => x.day === firstDay && x.replicate === o.replicate);
            return init && init.moisture > 0 ? (o.moisture / init.moisture) * 100 : null;
          })
          .filter((x): x is number => x != null)
      : [];
    const water = g.observations.map((o) => o.waterAppliedMl).filter((x): x is number => x != null);
    return { id: g.id, name: g.name, treatment: g.treatment, isControl: g.isControl, finalMoisture: summarize(final), retentionPct: summarize(retention), totalWaterMl: water.length ? water.reduce((a, b) => a + b, 0) : null, _retention: retention, _final: final };
  });
  const control = groups.find((g) => g.isControl);
  const comparisons = control
    ? groups.filter((g) => !g.isControl).map((g) => {
        const test = welchTTest(g._retention.length ? g._retention : g._final, control._retention.length ? control._retention : control._final);
        return {
          group: g.name,
          vsControl: control.name,
          metric: g._retention.length ? 'retention_pct' : 'final_moisture',
          difference: g.retentionPct.mean != null && control.retentionPct.mean != null ? g.retentionPct.mean - control.retentionPct.mean : g.finalMoisture.mean != null && control.finalMoisture.mean != null ? g.finalMoisture.mean - control.finalMoisture.mean : null,
          test,
          note: test ? (test.p < 0.05 ? 'Statistically significant at α = 0.05 (Welch t-test)' : 'Not statistically significant at α = 0.05') : 'Statistical test needs at least 2 replicates per group',
        };
      })
    : [];
  return { days, series, groups: groups.map(({ _retention, _final, ...g }) => g), comparisons };
}

biopodRouter.get('/', ah(async (req, res) => {
  res.json({ experiments: await prisma.bioPodExperiment.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { groups: true } } } }) });
}));

biopodRouter.post('/', ah(async (req, res) => {
  const b = parse(z.object({ title: z.string().trim().min(1).max(150), description: z.string().max(3000).nullish(), conditions: z.string().max(3000).nullish(), startDate: z.coerce.date().nullish(), farmId: z.string().nullish(), groups: z.array(z.object({ name: z.string().trim().min(1).max(60), treatment: z.string().max(300).nullish(), isControl: z.boolean().default(false) })).min(1).max(20) }), req.body);
  if (b.farmId) await ownedFarm(uid(req), b.farmId);
  const { groups, ...data } = b;
  const e = await prisma.bioPodExperiment.create({ data: { ...data, userId: uid(req), groups: { create: groups } }, include: { groups: true } });
  res.status(201).json({ experiment: e });
}));

biopodRouter.get('/:id', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  res.json({ experiment: e, analysis: analyzeExperiment(e) });
}));

biopodRouter.delete('/:id', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  await prisma.bioPodExperiment.delete({ where: { id: e.id } });
  res.json({ ok: true });
}));

biopodRouter.post('/:id/groups', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  const b = parse(z.object({ name: z.string().trim().min(1).max(60), treatment: z.string().max(300).nullish(), isControl: z.boolean().default(false) }), req.body);
  res.status(201).json({ group: await prisma.bioPodGroup.create({ data: { ...b, experimentId: e.id } }) });
}));

biopodRouter.post('/:id/observations', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  const b = parse(z.object({ observations: z.array(z.object({ groupId: z.string(), replicate: z.number().int().min(1).max(100), day: z.number().min(0).max(3650), moisture: z.number().min(0).max(100), waterAppliedMl: z.number().min(0).nullish(), notes: z.string().max(300).nullish() })).min(1).max(500) }), req.body);
  const ids = new Set(e.groups.map((g) => g.id));
  if (b.observations.some((o) => !ids.has(o.groupId))) throw new HttpError(400, 'Group does not belong to this experiment');
  const r = await prisma.bioPodObservation.createMany({ data: b.observations });
  res.status(201).json({ created: r.count });
}));

biopodRouter.delete('/:id/observations/:obsId', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  const r = await prisma.bioPodObservation.deleteMany({ where: { id: req.params.obsId, groupId: { in: e.groups.map((g) => g.id) } } });
  if (!r.count) throw new HttpError(404, 'Observation not found');
  res.json({ ok: true });
}));

export { ownedExperiment };
