import type { Crop } from '@prisma/client';
import { L, type LText } from './i18n.js';

export interface CropInputs {
  ph?: number | null;
  moisture?: number | null;
  ec?: number | null;
  soilTemp?: number | null;
  airTemp?: number | null;
  waterAvailability?: 'low' | 'medium' | 'high' | null;
}

export interface ComponentScore {
  factor: 'ph' | 'temperature' | 'moisture' | 'salinity' | 'water';
  score: number | null;
  weight: number;
  detail: LText;
}

export interface CropScore {
  cropKey: string;
  nameEn: string;
  nameAr: string;
  suitability: number;
  dataCoverage: number;
  components: ComponentScore[];
  soilCompatibility: number | null;
  climateCompatibility: number | null;
  waterRequirementsMm: string;
  limitations: LText[];
  actions: LText[];
  why: LText;
}

const WEIGHTS = { ph: 0.25, temperature: 0.25, moisture: 0.2, salinity: 0.2, water: 0.1 } as const;

/** 1 inside the optimum, linear decline to 0 at the absolute limits. */
export function trapezoid(v: number, min: number, optMin: number, optMax: number, max: number) {
  if (v < min || v > max) return 0;
  if (v >= optMin && v <= optMax) return 1;
  if (v < optMin) return (v - min) / (optMin - min);
  return (max - v) / (max - optMax);
}

/** Maas–Hoffman relative yield (0..1) from salinity threshold (dS/m) and slope (% per dS/m). */
export function maasHoffman(ec: number, threshold: number, slope: number) {
  if (ec <= threshold) return 1;
  return Math.max(0, 1 - (slope * (ec - threshold)) / 100);
}

export function waterNeedLevel(range: string): 'low' | 'medium' | 'high' {
  const nums = range.split('-').map(Number).filter((n) => !Number.isNaN(n));
  const mid = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 600;
  if (mid < 550) return 'low';
  if (mid <= 900) return 'medium';
  return 'high';
}

const LEVEL = { low: 0, medium: 1, high: 2 } as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function scoreCrop(crop: Crop, input: CropInputs): CropScore {
  const components: ComponentScore[] = [];
  const limitations: LText[] = [];
  const actions: LText[] = [];

  if (input.ph != null) {
    const s = trapezoid(input.ph, crop.phMin, crop.phOptMin, crop.phOptMax, crop.phMax);
    components.push({ factor: 'ph', score: s, weight: WEIGHTS.ph, detail: L(`pH ${input.ph} vs optimum ${crop.phOptMin}–${crop.phOptMax}`, `الحموضة ${input.ph} مقابل المدى الأمثل ${crop.phOptMin}–${crop.phOptMax}`) });
    if (input.ph < crop.phOptMin) {
      limitations.push(L('Soil is more acidic than optimal', 'التربة أكثر حموضة من المدى الأمثل'));
      actions.push(L('Confirm pH with a lab test; liming may be needed per lab advice', 'تأكد من الحموضة بتحليل معملي؛ قد تحتاج إلى إضافة الجير حسب توصية المعمل'));
    } else if (input.ph > crop.phOptMax) {
      limitations.push(L('Soil is more alkaline than optimal (reduced P, Fe, Zn availability)', 'التربة أكثر قلوية من المدى الأمثل (انخفاض إتاحة الفوسفور والحديد والزنك)'));
      actions.push(L('Use acidifying fertilizers / sulfur and chelated micronutrients per agronomist advice', 'استخدم أسمدة حامضية التأثير أو الكبريت وعناصر صغرى مخلبية حسب توصية المهندس الزراعي'));
    }
  } else components.push({ factor: 'ph', score: null, weight: WEIGHTS.ph, detail: L('No pH measurement', 'لا توجد قراءة حموضة') });

  const temp = input.airTemp ?? input.soilTemp;
  if (temp != null) {
    const s = trapezoid(temp, crop.tempMin, crop.tempOptMin, crop.tempOptMax, crop.tempMax);
    const src = input.airTemp != null ? L('mean air temp (NASA POWER, last 30 days)', 'متوسط حرارة الهواء (NASA POWER آخر 30 يومًا)') : L('soil temperature', 'حرارة التربة');
    components.push({ factor: 'temperature', score: s, weight: WEIGHTS.temperature, detail: L(`${r1(temp)}°C ${src.en} vs optimum ${crop.tempOptMin}–${crop.tempOptMax}°C`, `${r1(temp)}°م ${src.ar} مقابل المدى الأمثل ${crop.tempOptMin}–${crop.tempOptMax}°م`) });
    if (s < 0.5) limitations.push(L('Current temperatures are outside the comfortable range for this crop; check planting season', 'درجات الحرارة الحالية خارج المدى المناسب لهذا المحصول؛ راجع موعد الزراعة'));
  } else components.push({ factor: 'temperature', score: null, weight: WEIGHTS.temperature, detail: L('No temperature data', 'لا توجد بيانات حرارة') });

  if (input.moisture != null) {
    const upper = Math.min(100, crop.moistureOptMax + 25);
    const s = trapezoid(input.moisture, crop.moistureMin * 0.5, crop.moistureOptMin, crop.moistureOptMax, upper);
    components.push({ factor: 'moisture', score: s, weight: WEIGHTS.moisture, detail: L(`Moisture ${input.moisture}% vs optimum ${crop.moistureOptMin}–${crop.moistureOptMax}%`, `الرطوبة ${input.moisture}% مقابل المدى الأمثل ${crop.moistureOptMin}–${crop.moistureOptMax}%`) });
    if (input.moisture < crop.moistureOptMin) actions.push(L('Irrigation needed to reach the optimal moisture range', 'يلزم الري للوصول إلى مدى الرطوبة الأمثل'));
    if (input.moisture > crop.moistureOptMax) limitations.push(L('Soil is wetter than optimal; check drainage', 'التربة أكثر رطوبة من اللازم؛ افحص الصرف'));
  } else components.push({ factor: 'moisture', score: null, weight: WEIGHTS.moisture, detail: L('No moisture measurement', 'لا توجد قراءة رطوبة') });

  if (input.ec != null) {
    const s = maasHoffman(input.ec, crop.ecThreshold, crop.ecSlope);
    components.push({ factor: 'salinity', score: s, weight: WEIGHTS.salinity, detail: L(`EC ${input.ec} dS/m vs tolerance threshold ${crop.ecThreshold} dS/m (expected relative yield ${Math.round(s * 100)}%)`, `التوصيل الكهربي ${input.ec} ديسي سيمنز/م مقابل حد التحمل ${crop.ecThreshold} (الإنتاجية النسبية المتوقعة ${Math.round(s * 100)}%)`) });
    if (input.ec > crop.ecThreshold) {
      limitations.push(L('Salinity above crop tolerance threshold', 'الملوحة أعلى من حد تحمل المحصول'));
      actions.push(L('Confirm with a saturated-paste ECe lab test; consider leaching if drainage allows', 'تأكد بتحليل ECe لمستخلص العجينة المشبعة؛ فكّر في غسيل التربة إذا سمح الصرف'));
    }
  } else components.push({ factor: 'salinity', score: null, weight: WEIGHTS.salinity, detail: L('No EC measurement', 'لا توجد قراءة توصيل كهربي') });

  const need = waterNeedLevel(crop.waterNeedMm);
  if (input.waterAvailability) {
    const gap = LEVEL[need] - LEVEL[input.waterAvailability];
    const s = gap <= 0 ? 1 : gap === 1 ? 0.6 : 0.2;
    components.push({ factor: 'water', score: s, weight: WEIGHTS.water, detail: L(`Seasonal need ${crop.waterNeedMm} mm (${need}) vs farm water availability: ${input.waterAvailability}`, `الاحتياج الموسمي ${crop.waterNeedMm} مم مقابل توفر المياه بالمزرعة`) });
    if (gap > 0) limitations.push(L('Crop water demand exceeds stated water availability', 'احتياج المحصول للمياه أعلى من المياه المتاحة'));
  } else components.push({ factor: 'water', score: null, weight: WEIGHTS.water, detail: L('Farm water availability not set', 'لم يتم تحديد توفر المياه بالمزرعة') });

  const known = components.filter((c) => c.score != null);
  const wSum = known.reduce((a, c) => a + c.weight, 0);
  let suitability = wSum > 0 ? known.reduce((a, c) => a + (c.score as number) * c.weight, 0) / wSum : 0;
  if (known.some((c) => c.score === 0)) suitability = Math.min(suitability, 0.3);

  const avg = (fs: ComponentScore['factor'][]) => {
    const xs = components.filter((c) => fs.includes(c.factor) && c.score != null).map((c) => c.score as number);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) : null;
  };

  const best = [...known].sort((a, b) => (b.score as number) - (a.score as number))[0];
  const worst = [...known].sort((a, b) => (a.score as number) - (b.score as number))[0];
  const why = known.length
    ? L(
        `Score is the weighted average of ${known.length} measured factors. Strongest: ${best.factor}; weakest: ${worst.factor}.`,
        `الدرجة هي متوسط مرجح لعدد ${known.length} عوامل مقاسة. الأقوى: ${best.factor}، الأضعف: ${worst.factor}.`,
      )
    : L('No measurements available for this zone.', 'لا توجد قياسات لهذه المنطقة.');

  return {
    cropKey: crop.key,
    nameEn: crop.nameEn,
    nameAr: crop.nameAr,
    suitability: Math.round(suitability * 100),
    dataCoverage: Math.round(wSum * 100),
    components,
    soilCompatibility: avg(['ph', 'salinity', 'moisture']),
    climateCompatibility: avg(['temperature']),
    waterRequirementsMm: crop.waterNeedMm,
    limitations,
    actions,
    why,
  };
}

export function recommendCrops(crops: Crop[], input: CropInputs, top = 3) {
  return crops
    .map((c) => scoreCrop(c, input))
    .sort((a, b) => b.suitability - a.suitability || b.dataCoverage - a.dataCoverage)
    .slice(0, top);
}
