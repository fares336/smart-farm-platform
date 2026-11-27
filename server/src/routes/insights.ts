import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm } from '../lib/ownership.js';
import { aiFindingsByZone, analyzeZone, loadFarmContext } from '../services/farmContext.js';
import { averages } from '../services/zoneState.js';
import { financialSummary } from '../lib/finance.js';
import { robotStatus } from '../lib/robotStatus.js';
import { L } from '../lib/i18n.js';

export const insightsRouter = Router({ mergeParams: true });

insightsRouter.get('/dashboard', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const ctx = await loadFarmContext(farm);
  const analyses = ctx.zones.map((z) => ({ zone: z, a: analyzeZone(ctx, z) }));
  const avg = averages(ctx.readings.values());
  const devices = await prisma.robotDevice.findMany({ where: { farmId: farm.id } });
  const seasons = await prisma.financialSeason.findMany({ where: { farmId: farm.id }, include: { expenses: true, harvests: true, sales: true } });
  const fin = financialSummary(seasons.flatMap((s) => s.expenses), seasons.flatMap((s) => s.harvests), seasons.flatMap((s) => s.sales));
  const cropTally = new Map<string, { key: string; nameEn: string; nameAr: string; zones: number; avgScore: number }>();
  for (const { a } of analyses) {
    const t = a.recommendations[0];
    if (!t) continue;
    const c = cropTally.get(t.cropKey) ?? { key: t.cropKey, nameEn: t.nameEn, nameAr: t.nameAr, zones: 0, avgScore: 0 };
    c.avgScore = (c.avgScore * c.zones + t.suitability) / (c.zones + 1);
    c.zones++;
    cropTally.set(t.cropKey, c);
  }
  const irrigationCounts: Record<string, number> = {};
  for (const { a } of analyses) irrigationCounts[a.irrigation.status] = (irrigationCounts[a.irrigation.status] ?? 0) + 1;
  res.json({
    farm,
    totals: { areaHectares: farm.areaHectares, zones: ctx.zones.length, zonesMeasured: avg.zonesMeasured },
    soil: { moisture: avg.moisture, ph: avg.ph, ec: avg.ec, temperature: avg.temperature },
    weather: ctx.weather,
    robots: devices.map((d) => ({ id: d.id, name: d.name, deviceUid: d.deviceUid, status: robotStatus(d), lastDataAt: d.lastDataAt, batteryPct: d.batteryPct })),
    cropRecommendations: [...cropTally.values()].sort((a, b) => b.zones - a.zones).slice(0, 5),
    irrigation: irrigationCounts,
    finance: fin,
  });
}));

insightsRouter.get('/decision', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const q = parse(z.object({ zoneId: z.string().optional() }), req.query);
  const ctx = await loadFarmContext(farm, q.zoneId);
  if (q.zoneId && !ctx.zones.length) throw new HttpError(404, 'Zone not found');
  const ai = await aiFindingsByZone(farm.id);
  const zones = ctx.zones.map((z) => ({ zoneId: z.id, ...analyzeZone(ctx, z, { nutrientFindings: ai.nutrientFindings.get(z.id), diseases: ai.diseases.get(z.id) }).decision }));
  const farmIssues = [];
  const seasons = await prisma.financialSeason.findMany({ where: { farmId: farm.id }, include: { expenses: true, harvests: true, sales: true } });
  for (const s of seasons) {
    const f = financialSummary(s.expenses, s.harvests, s.sales).actual;
    if (f.totalRevenue > 0 && f.netProfit < 0) {
      const top = Object.entries(f.expensesByCategory).sort((a, b) => b[1] - a[1])[0];
      farmIssues.push({
        id: `finance_${s.id}`, title: L(`Season "${s.name}" is running at a loss`, `الموسم "${s.name}" يحقق خسارة`), priority: 65, severity: 'warning', confidence: 'high',
        evidence: [L(`Actual net profit ${f.netProfit.toFixed(0)} EGP`, `صافي الربح الفعلي ${f.netProfit.toFixed(0)} جنيه`), ...(top ? [L(`Largest cost category: ${top[0]} (${top[1].toFixed(0)} EGP)`, `أكبر بند تكلفة: ${top[0]} (${top[1].toFixed(0)} جنيه)`)] : [])],
        actions: [L('Review the largest cost categories and input prices', 'راجع أكبر بنود التكلفة وأسعار المدخلات')],
        explanation: L('Calculated from the actual expenses and sales you entered.', 'محسوب من المصروفات والمبيعات الفعلية التي أدخلتها.'),
      });
    }
  }
  if (!ctx.weather) {
    farmIssues.push({ id: 'weather', title: L('Weather data unavailable', 'بيانات الطقس غير متاحة'), priority: 30, severity: 'info', confidence: 'high', evidence: [L('No NASA POWER records stored for this farm yet', 'لا توجد سجلات NASA POWER لهذه المزرعة بعد')], actions: [L('Open the Weather page to fetch data', 'افتح صفحة الطقس لجلب البيانات')], explanation: L('Weather improves irrigation and crop advice.', 'الطقس يحسّن توصيات الري والمحاصيل.') });
  }
  const order = { critical: 0, attention: 1, no_data: 2, good: 3 } as const;
  zones.sort((a, b) => order[a.status] - order[b.status] || (b.issues[0]?.priority ?? 0) - (a.issues[0]?.priority ?? 0));
  const summary = { critical: zones.filter((z) => z.status === 'critical').length, attention: zones.filter((z) => z.status === 'attention').length, good: zones.filter((z) => z.status === 'good').length, noData: zones.filter((z) => z.status === 'no_data').length };
  const content = { summary, farmIssues, zones };
  if (req.query.save === '1') await prisma.decisionReport.create({ data: { farmId: farm.id, zoneId: q.zoneId, content: content as object } });
  res.json({ ...content, generatedAt: new Date(), isDemo: farm.isDemo });
}));
