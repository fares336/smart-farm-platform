import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Crop reference ranges.
 * - Salinity threshold/slope (ECe, dS/m): Ayers & Westcot, FAO Irrigation and Drainage Paper 29 Rev.1 (1985), Table 4 (Maas & Hoffman 1977).
 * - Crop coefficients Kc: Allen et al., FAO Irrigation and Drainage Paper 56 (1998), Table 12.
 * - Seasonal water need (mm): FAO Irrigation Water Management Training Manual 3, Table 5 (Brouwer & Heibloem 1986).
 * - pH / temperature / volumetric moisture ranges: general FAO ECOCROP & extension guidance; adjust locally.
 */
const REF = 'FAO-29 (salinity), FAO-56 (Kc), FAO Training Manual 3 (water need), FAO ECOCROP (pH/temperature)';
const crops = [
  { key: 'wheat', nameEn: 'Wheat', nameAr: 'القمح', ph: [5.5, 6.0, 7.5, 8.5], t: [3, 15, 24, 32], m: [15, 22, 32], ec: [6.0, 7.1], kc: [0.7, 1.15, 0.3], w: '450-650', sEn: 'Winter (Nov–May)', sAr: 'شتوي (نوفمبر–مايو)' },
  { key: 'rice', nameEn: 'Rice', nameAr: 'الأرز', ph: [4.5, 5.5, 7.0, 8.2], t: [12, 22, 32, 38], m: [35, 45, 60], ec: [3.0, 12.0], kc: [1.05, 1.2, 0.9], w: '900-2000', sEn: 'Summer (May–Sep)', sAr: 'صيفي (مايو–سبتمبر)' },
  { key: 'maize', nameEn: 'Maize', nameAr: 'الذرة', ph: [5.0, 5.8, 7.2, 8.0], t: [10, 20, 30, 38], m: [18, 25, 35], ec: [1.7, 12.0], kc: [0.3, 1.2, 0.6], w: '500-800', sEn: 'Summer (May–Sep)', sAr: 'صيفي (مايو–سبتمبر)' },
  { key: 'tomato', nameEn: 'Tomato', nameAr: 'الطماطم', ph: [5.0, 6.0, 7.0, 8.0], t: [10, 18, 27, 35], m: [20, 25, 35], ec: [2.5, 9.9], kc: [0.6, 1.15, 0.8], w: '400-800', sEn: 'Several seasons', sAr: 'عدة عروات' },
  { key: 'potato', nameEn: 'Potato', nameAr: 'البطاطس', ph: [4.8, 5.2, 6.5, 7.8], t: [7, 15, 22, 28], m: [20, 25, 35], ec: [1.7, 12.0], kc: [0.5, 1.15, 0.75], w: '500-700', sEn: 'Winter / Nili', sAr: 'شتوي / نيلي' },
  { key: 'cotton', nameEn: 'Cotton', nameAr: 'القطن', ph: [5.5, 6.0, 7.5, 8.5], t: [15, 22, 32, 40], m: [15, 20, 30], ec: [7.7, 5.2], kc: [0.35, 1.18, 0.7], w: '700-1300', sEn: 'Summer (Mar–Oct)', sAr: 'صيفي (مارس–أكتوبر)' },
  { key: 'beans', nameEn: 'Beans', nameAr: 'الفول/الفاصوليا', ph: [5.5, 6.0, 7.5, 8.2], t: [8, 15, 25, 32], m: [18, 22, 32], ec: [1.0, 19.0], kc: [0.4, 1.15, 0.35], w: '300-500', sEn: 'Winter', sAr: 'شتوي' },
  { key: 'sugarcane', nameEn: 'Sugarcane', nameAr: 'قصب السكر', ph: [5.0, 6.0, 7.5, 8.5], t: [15, 24, 34, 40], m: [25, 30, 45], ec: [1.7, 5.9], kc: [0.4, 1.25, 0.75], w: '1500-2500', sEn: 'Perennial', sAr: 'معمر' },
  { key: 'onion', nameEn: 'Onion', nameAr: 'البصل', ph: [5.5, 6.0, 7.0, 8.0], t: [7, 13, 24, 30], m: [18, 22, 32], ec: [1.2, 16.0], kc: [0.7, 1.05, 0.75], w: '350-550', sEn: 'Winter', sAr: 'شتوي' },
  { key: 'pepper', nameEn: 'Pepper', nameAr: 'الفلفل', ph: [5.5, 6.0, 7.0, 8.0], t: [12, 20, 28, 35], m: [20, 25, 35], ec: [1.5, 14.0], kc: [0.6, 1.05, 0.9], w: '600-900', sEn: 'Summer', sAr: 'صيفي' },
];

/** Rough planning estimates only; flagged isEstimate and expected to be edited by the farmer. */
const prices = [
  { itemKey: 'urea_46', name: 'Urea 46% N (50 kg bag)', category: 'fertilizers', unit: 'bag 50 kg', priceEgp: 1000 },
  { itemKey: 'an_33', name: 'Ammonium nitrate 33.5% (50 kg bag)', category: 'fertilizers', unit: 'bag 50 kg', priceEgp: 950 },
  { itemKey: 'ssp_15', name: 'Single superphosphate 15% (50 kg bag)', category: 'fertilizers', unit: 'bag 50 kg', priceEgp: 450 },
  { itemKey: 'sop_50', name: 'Potassium sulfate 50% (50 kg bag)', category: 'fertilizers', unit: 'bag 50 kg', priceEgp: 2500 },
  { itemKey: 'wheat_seed', name: 'Certified wheat seed', category: 'seeds', unit: 'ardeb 150 kg', priceEgp: 3500 },
  { itemKey: 'diesel', name: 'Diesel fuel', category: 'fuel', unit: 'litre', priceEgp: 15 },
  { itemKey: 'labor_day', name: 'Farm labour', category: 'labor', unit: 'worker-day', priceEgp: 250 },
  { itemKey: 'electricity_kwh', name: 'Agricultural electricity', category: 'electricity', unit: 'kWh', priceEgp: 2 },
];

async function main() {
  for (const c of crops) {
    const data = {
      key: c.key, nameEn: c.nameEn, nameAr: c.nameAr,
      phMin: c.ph[0], phOptMin: c.ph[1], phOptMax: c.ph[2], phMax: c.ph[3],
      tempMin: c.t[0], tempOptMin: c.t[1], tempOptMax: c.t[2], tempMax: c.t[3],
      moistureMin: c.m[0], moistureOptMin: c.m[1], moistureOptMax: c.m[2],
      ecThreshold: c.ec[0], ecSlope: c.ec[1], kcIni: c.kc[0], kcMid: c.kc[1], kcEnd: c.kc[2],
      waterNeedMm: c.w, seasonEn: c.sEn, seasonAr: c.sAr, references: REF,
    };
    await prisma.crop.upsert({ where: { key: c.key }, create: data, update: data });
  }
  for (const p of prices) {
    const existing = await prisma.marketPrice.findFirst({ where: { farmId: null, itemKey: p.itemKey } });
    if (!existing) await prisma.marketPrice.create({ data: { ...p, isEstimate: true, source: 'Unverified planning estimate – replace with your local price' } });
  }
  console.log(`Seeded ${crops.length} crops and ${prices.length} default price estimates`);
}

main().finally(() => prisma.$disconnect());
