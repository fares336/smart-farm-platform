import { Router, type Response } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../db.js';
import { ah } from '../middleware/error.js';
import { uid } from '../middleware/auth.js';
import { ownedFarm, ownedSeason } from '../lib/ownership.js';
import { financialSummary } from '../lib/finance.js';
import { analyzeZone, loadFarmContext } from '../services/farmContext.js';
import { averages } from '../services/zoneState.js';
import { ownedExperiment, analyzeExperiment } from './biopod.js';

export const reportsRouter = Router();

function csvCell(v: unknown) {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

function sendCsv(res: Response, name: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(csv);
}

const fmt = (n: number | null | undefined, d = 1) => (n == null ? 'N/A' : n.toFixed(d));

reportsRouter.get('/farms/:farmId/measurements.csv', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const rows = await prisma.soilMeasurement.findMany({ where: { farmId: farm.id }, orderBy: { measuredAt: 'asc' }, include: { zone: { select: { code: true } }, device: { select: { deviceUid: true } } } });
  sendCsv(res, `measurements-${farm.id}.csv`, toCsv(
    ['zone', 'source', 'device', 'measured_at', 'moisture_pct', 'ph', 'ec_dS_m', 'temperature_c', 'n_ppm', 'p_ppm', 'k_ppm', 'gps_lat', 'gps_lng', 'is_demo', 'notes'],
    rows.map((m) => [m.zone.code, m.source, m.device?.deviceUid, m.measuredAt, m.moisture, m.ph, m.ec, m.temperature, m.nitrogenPpm, m.phosphorusPpm, m.potassiumPpm, m.gpsLat, m.gpsLng, m.isDemo, m.notes]),
  ));
}));

reportsRouter.get('/seasons/:seasonId/finance.csv', ah(async (req, res) => {
  const s = await ownedSeason(uid(req), req.params.seasonId);
  const full = await prisma.financialSeason.findUniqueOrThrow({ where: { id: s.id }, include: { expenses: true, harvests: true, sales: true } });
  const rows: unknown[][] = [
    ...full.expenses.map((e) => ['expense', e.date, e.category, e.description, '', '', e.amountEgp, e.isEstimate ? 'estimated' : 'actual']),
    ...full.harvests.map((h) => ['harvest', h.date, h.cropKey, '', h.quantityTon, '', '', h.isEstimate ? 'estimated' : 'actual']),
    ...full.sales.map((x) => ['sale', x.date, x.cropKey, x.buyer, x.quantityTon, x.pricePerTonEgp, x.quantityTon * x.pricePerTonEgp, x.isEstimate ? 'estimated' : 'actual']),
  ];
  sendCsv(res, `finance-${s.id}.csv`, toCsv(['type', 'date', 'category_or_crop', 'description_or_buyer', 'quantity_ton', 'price_per_ton_egp', 'amount_egp', 'basis'], rows));
}));

reportsRouter.get('/biopod/:id.csv', ah(async (req, res) => {
  const e = await ownedExperiment(uid(req), req.params.id);
  const rows = e.groups.flatMap((g) => g.observations.map((o) => [g.name, g.treatment, g.isControl, o.replicate, o.day, o.moisture, o.waterAppliedMl, o.notes]));
  sendCsv(res, `biopod-${e.id}.csv`, toCsv(['group', 'treatment', 'is_control', 'replicate', 'day', 'moisture_pct', 'water_applied_ml', 'notes'], rows));
}));

reportsRouter.get('/farms/:farmId/report.pdf', ah(async (req, res) => {
  const farm = await ownedFarm(uid(req), req.params.farmId);
  const ctx = await loadFarmContext(farm);
  const avg = averages(ctx.readings.values());
  const seasons = await prisma.financialSeason.findMany({ where: { farmId: farm.id }, include: { expenses: true, harvests: true, sales: true } });
  const experiments = await prisma.bioPodExperiment.findMany({ where: { farmId: farm.id, userId: uid(req) }, select: { id: true } });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="farm-report-${farm.id}.pdf"`);
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(res);
  const h = (t: string) => doc.moveDown(0.8).fontSize(14).fillColor('#166534').text(t).moveDown(0.3).fontSize(10).fillColor('#111');
  doc.fontSize(20).fillColor('#14532d').text(`Smart Farm report — ${farm.name}`);
  doc.fontSize(9).fillColor('#555').text(`Generated ${new Date().toISOString()}${farm.isDemo ? '  ·  DEMO FARM: values are simulated' : ''}`);
  h('Farm');
  doc.text(`Area: ${farm.areaHectares.toFixed(2)} ha · Location: ${farm.locationName ?? '-'} (${farm.latitude.toFixed(5)}, ${farm.longitude.toFixed(5)})`);
  doc.text(`Zones: ${ctx.zones.length} · Zones with measurements: ${avg.zonesMeasured}`);
  h('Soil (mean of latest reading per measured zone)');
  doc.text(`Moisture ${fmt(avg.moisture)} % · pH ${fmt(avg.ph, 2)} · EC ${fmt(avg.ec, 2)} dS/m · Soil temperature ${fmt(avg.temperature)} °C`);
  h('Weather (NASA POWER)');
  if (ctx.weather) {
    doc.text(`Last stored day: ${ctx.weather.latestDate.toISOString().slice(0, 10) ?? '-'} · fetched ${ctx.weather.lastFetchedAt.toISOString()}`);
    doc.text(`30-day mean air temp ${fmt(ctx.weather.mean30.t2m)} °C · 30-day rain ${fmt(ctx.weather.mean30.precipTotal)} mm · 7-day ET0 ${fmt(ctx.weather.et0Mean7, 2)} mm/day`);
  } else doc.text('No weather data stored.');
  h('Priority actions');
  const decisions = ctx.zones.map((z) => ({ code: z.code, d: analyzeZone(ctx, z).decision })).filter((x) => x.d.issues.length && x.d.status !== 'no_data');
  decisions.sort((a, b) => (b.d.issues[0]?.priority ?? 0) - (a.d.issues[0]?.priority ?? 0));
  if (!decisions.length) doc.text('No issues detected from available data (zones without data are not assessed).');
  for (const x of decisions.slice(0, 25)) doc.text(`• ${x.code}: ${x.d.issues[0].title.en} (${x.d.issues[0].severity}, confidence ${x.d.issues[0].confidence})`);
  h('Finance');
  if (!seasons.length) doc.text('No financial seasons recorded.');
  for (const s of seasons) {
    const f = financialSummary(s.expenses, s.harvests, s.sales);
    doc.text(`${s.name}: ACTUAL revenue ${fmt(f.actual.totalRevenue, 0)} EGP, cost ${fmt(f.actual.totalCosts, 0)} EGP, profit ${fmt(f.actual.netProfit, 0)} EGP`);
    if (f.estimated.totalCosts || f.estimated.totalRevenue) doc.fillColor('#92400e').text(`   ESTIMATED revenue ${fmt(f.estimated.totalRevenue, 0)} EGP, cost ${fmt(f.estimated.totalCosts, 0)} EGP, profit ${fmt(f.estimated.netProfit, 0)} EGP`).fillColor('#111');
  }
  if (experiments.length) {
    h('BioPod experiments');
    for (const { id } of experiments) {
      const e = await ownedExperiment(uid(req), id);
      const a = analyzeExperiment(e);
      doc.text(`${e.title}: ${e.groups.length} groups, ${a.days.length} observation days`);
      for (const c of a.comparisons) doc.text(`   ${c.group} vs ${c.vsControl}: diff ${fmt(c.difference)} — ${c.note}${c.test ? ` (p = ${c.test.p.toFixed(3)})` : ''}`);
    }
  }
  doc.moveDown(1).fontSize(8).fillColor('#666').text('Recommendations are decision support, not a substitute for local agronomist advice or laboratory analysis. AI image results describe visible symptoms only and do not measure soil nutrient concentrations.');
  doc.end();
}));
