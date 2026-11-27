import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm, ownedSeason } from '../lib/ownership.js';
import { financialSummary } from '../lib/finance.js';

export const EXPENSE_CATEGORIES = ['seeds', 'fertilizers', 'water', 'electricity', 'labor', 'pesticides', 'transportation', 'fuel', 'equipment', 'other'] as const;

export const farmFinanceRouter = Router({ mergeParams: true });

const seasonInclude = { expenses: { orderBy: { date: 'asc' as const } }, harvests: { orderBy: { date: 'asc' as const } }, sales: { orderBy: { date: 'asc' as const } } };

farmFinanceRouter.get('/seasons', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const seasons = await prisma.financialSeason.findMany({ where: { farmId: farm.id }, orderBy: { createdAt: 'asc' }, include: seasonInclude });
  res.json({ seasons: seasons.map((s) => ({ ...s, summary: financialSummary(s.expenses, s.harvests, s.sales) })), categories: EXPENSE_CATEGORIES });
}));

farmFinanceRouter.post('/seasons', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const b = parse(z.object({ name: z.string().trim().min(1).max(100), cropKey: z.string().max(40).nullish(), startDate: z.coerce.date().nullish(), endDate: z.coerce.date().nullish() }), req.body);
  res.status(201).json({ season: await prisma.financialSeason.create({ data: { ...b, farmId: farm.id } }) });
}));

export const seasonRouter = Router();

seasonRouter.get('/:seasonId', ah(async (req, res) => {
  const s = await ownedSeason(uid(req), req.params.seasonId);
  const full = await prisma.financialSeason.findUniqueOrThrow({ where: { id: s.id }, include: seasonInclude });
  res.json({ season: full, summary: financialSummary(full.expenses, full.harvests, full.sales) });
}));

seasonRouter.patch('/:seasonId', ah(async (req, res) => {
  const s = await ownedSeason(uid(req), req.params.seasonId);
  const b = parse(z.object({ name: z.string().trim().min(1).max(100).optional(), cropKey: z.string().max(40).nullish(), startDate: z.coerce.date().nullish(), endDate: z.coerce.date().nullish() }), req.body);
  res.json({ season: await prisma.financialSeason.update({ where: { id: s.id }, data: b }) });
}));

seasonRouter.delete('/:seasonId', ah(async (req, res) => {
  const s = await ownedSeason(uid(req), req.params.seasonId);
  await prisma.financialSeason.delete({ where: { id: s.id } });
  res.json({ ok: true });
}));

const money = z.number().min(0).max(1e10);
const schemas = {
  expenses: z.object({ category: z.enum(EXPENSE_CATEGORIES), description: z.string().max(300).nullish(), amountEgp: money, date: z.coerce.date(), isEstimate: z.boolean().default(false) }),
  harvests: z.object({ cropKey: z.string().min(1).max(40), quantityTon: z.number().min(0).max(1e7), date: z.coerce.date(), isEstimate: z.boolean().default(false) }),
  sales: z.object({ cropKey: z.string().min(1).max(40), quantityTon: z.number().positive().max(1e7), pricePerTonEgp: money, date: z.coerce.date(), buyer: z.string().max(120).nullish(), isEstimate: z.boolean().default(false) }),
};

for (const kind of ['expenses', 'harvests', 'sales'] as const) {
  seasonRouter.post(`/:seasonId/${kind}`, ah(async (req, res) => {
    const s = await ownedSeason(uid(req), req.params.seasonId);
    const data = { ...parse(schemas[kind] as z.ZodType<Record<string, unknown>>, req.body), seasonId: s.id };
    if (kind === 'sales') {
      const sale = data as unknown as { quantityTon: number; isEstimate: boolean };
      const [h, sold] = await Promise.all([
        prisma.harvestRecord.aggregate({ where: { seasonId: s.id, isEstimate: sale.isEstimate }, _sum: { quantityTon: true } }),
        prisma.salesRecord.aggregate({ where: { seasonId: s.id, isEstimate: sale.isEstimate }, _sum: { quantityTon: true } }),
      ]);
      const harvested = h._sum.quantityTon ?? 0;
      if (harvested > 0 && (sold._sum.quantityTon ?? 0) + sale.quantityTon > harvested + 1e-9) throw new HttpError(400, 'Sold quantity cannot exceed harvested quantity');
    }
    const model = { expenses: prisma.expense, harvests: prisma.harvestRecord, sales: prisma.salesRecord }[kind] as unknown as { create(a: { data: unknown }): Promise<unknown> };
    res.status(201).json({ item: await model.create({ data }) });
  }));
  seasonRouter.delete(`/:seasonId/${kind}/:id`, ah(async (req, res) => {
    const s = await ownedSeason(uid(req), req.params.seasonId);
    const model = { expenses: prisma.expense, harvests: prisma.harvestRecord, sales: prisma.salesRecord }[kind] as unknown as { deleteMany(a: { where: unknown }): Promise<{ count: number }> };
    const r = await model.deleteMany({ where: { id: req.params.id, seasonId: s.id } });
    if (!r.count) throw new HttpError(404, 'Record not found');
    res.json({ ok: true });
  }));
}

/** Prices: farm-specific rows override the shared default estimates. */
farmFinanceRouter.get('/prices', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const [defaults, own] = await Promise.all([
    prisma.marketPrice.findMany({ where: { farmId: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.marketPrice.findMany({ where: { farmId: farm.id }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
  ]);
  const overridden = new Set(own.map((p) => p.itemKey).filter(Boolean));
  res.json({
    prices: [...own.filter((p) => p.source !== 'hidden').map((p) => ({ ...p, scope: 'farm' })), ...defaults.filter((d) => !overridden.has(d.itemKey)).map((p) => ({ ...p, scope: 'default' }))],
    disclaimer: 'Default prices are rough, unverified estimates in EGP for planning only. They are not confirmed current market prices — edit them with your local prices.',
  });
}));

const priceBody = z.object({ itemKey: z.string().max(60).nullish(), name: z.string().trim().min(1).max(100), category: z.enum(EXPENSE_CATEGORIES), unit: z.string().trim().min(1).max(40), priceEgp: money, isEstimate: z.boolean().default(true), source: z.string().max(200).nullish(), priceDate: z.coerce.date().optional() });

farmFinanceRouter.post('/prices', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const b = parse(priceBody, req.body);
  res.status(201).json({ price: await prisma.marketPrice.create({ data: { ...b, farmId: farm.id } }) });
}));

farmFinanceRouter.patch('/prices/:id', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const b = parse(priceBody.partial(), req.body);
  const existing = await prisma.marketPrice.findFirst({ where: { id: req.params.id, OR: [{ farmId: farm.id }, { farmId: null }] } });
  if (!existing) throw new HttpError(404, 'Price not found');
  if (existing.farmId === null) {
    // Editing a default creates a farm-specific copy; shared defaults are never modified by users.
    const { id: _id, farmId: _f, updatedAt: _u, ...base } = existing;
    const created = await prisma.marketPrice.create({ data: { ...base, ...b, itemKey: existing.itemKey ?? existing.id, farmId: farm.id, priceDate: b.priceDate ?? new Date() } });
    return res.json({ price: created });
  }
  res.json({ price: await prisma.marketPrice.update({ where: { id: existing.id }, data: { ...b, priceDate: b.priceDate ?? new Date() } }) });
}));

farmFinanceRouter.delete('/prices/:id', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const existing = await prisma.marketPrice.findFirst({ where: { id: req.params.id, OR: [{ farmId: farm.id }, { farmId: null }] } });
  if (!existing) throw new HttpError(404, 'Price not found');
  if (existing.farmId === null) {
    const { id: _id, farmId: _f, updatedAt: _u, ...base } = existing;
    await prisma.marketPrice.create({ data: { ...base, itemKey: existing.itemKey ?? existing.id, farmId: farm.id, name: `${existing.name} (hidden)`, priceEgp: 0, source: 'hidden' } });
    return res.json({ ok: true, hidden: true });
  }
  await prisma.marketPrice.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}));
