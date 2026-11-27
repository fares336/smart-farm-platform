import { L, type LText } from './i18n.js';
import { NUTRIENTS, type NutrientKey } from './nutrients.js';

export interface FertilizerInputs {
  cropKey: string;
  growthStage?: string | null;
  farmAreaHa?: number | null;
  ph?: number | null;
  ec?: number | null;
  lab?: { nitrogenPpm?: number | null; phosphorusPpm?: number | null; potassiumPpm?: number | null } | null;
  suspected: { nutrient: NutrientKey; source: 'image_ai' | 'user' | 'lab'; confidence?: number | null }[];
}

export interface FertilizerItem {
  nutrient: NutrientKey;
  nutrientName: LText;
  evidence: LText[];
  confidence: 'low' | 'medium' | 'high';
  recommendedFertilizers: { name: LText; note?: LText }[];
  reason: LText;
  applicationMethod: LText;
  timing: LText;
  dose: LText;
  requiredInfo: LText[];
}

export interface FertilizerResult {
  items: FertilizerItem[];
  soilWarnings: LText[];
  generalNotes: LText[];
  missingInputs: LText[];
}

const DOSE_TEXT = L(
  'Exact rate not calculated: it requires a soil test, yield target, crop stage and the official local fertilizer guide (e.g. Egyptian Ministry of Agriculture / extension service).',
  'لم يتم حساب الجرعة الدقيقة: تتطلب تحليل تربة، والإنتاجية المستهدفة، ومرحلة النمو، ودليل التسميد المحلي الرسمي (مثل وزارة الزراعة المصرية/الإرشاد الزراعي).',
);

/** Indicative interpretation of common lab tests; methods and thresholds vary by lab. */
function labFlags(lab: FertilizerInputs['lab']): { nutrient: NutrientKey; text: LText }[] {
  const out: { nutrient: NutrientKey; text: LText }[] = [];
  if (lab?.phosphorusPpm != null && lab.phosphorusPpm < 10)
    out.push({ nutrient: 'P', text: L(`Lab P ${lab.phosphorusPpm} ppm is low by common Olsen-P guidance (<10 ppm)`, `فوسفور المعمل ${lab.phosphorusPpm} جزء في المليون منخفض وفق دليل أولسن الشائع (<10)`) });
  if (lab?.potassiumPpm != null && lab.potassiumPpm < 120)
    out.push({ nutrient: 'K', text: L(`Lab K ${lab.potassiumPpm} ppm is low by common exchangeable-K guidance (<120 ppm)`, `بوتاسيوم المعمل ${lab.potassiumPpm} منخفض وفق الدليل الشائع (<120)`) });
  return out;
}

export function recommendFertilizer(input: FertilizerInputs): FertilizerResult {
  const soilWarnings: LText[] = [];
  const missingInputs: LText[] = [];
  const generalNotes: LText[] = [
    L('Fertilizer recommendations are general guidance based on FAO / IPNI 4R principles (right source, rate, time, place).', 'التوصيات إرشادات عامة مبنية على مبادئ FAO و4R (المصدر والمعدل والتوقيت والمكان الصحيح).'),
    L('Sodium is not a fertilizer. High sodium indicates a possible salinity/sodicity problem that needs SAR/ESP testing.', 'الصوديوم ليس سمادًا. ارتفاعه يشير لمشكلة ملوحة أو صودية محتملة تحتاج تحليل SAR/ESP.'),
  ];
  if (input.ph == null) missingInputs.push(L('Soil pH', 'حموضة التربة'));
  if (input.ec == null) missingInputs.push(L('Soil EC', 'التوصيل الكهربي للتربة'));
  if (!input.lab || (input.lab.nitrogenPpm == null && input.lab.phosphorusPpm == null && input.lab.potassiumPpm == null))
    missingInputs.push(L('Laboratory soil analysis (N, P, K)', 'تحليل تربة معملي (ن، فو، بو)'));
  if (!input.growthStage) missingInputs.push(L('Growth stage', 'مرحلة النمو'));
  if (!input.farmAreaHa) missingInputs.push(L('Area to be fertilized', 'المساحة المراد تسميدها'));

  const highPh = input.ph != null && input.ph > 7.8;
  const lowPh = input.ph != null && input.ph < 5.5;
  const saline = input.ec != null && input.ec > 4;
  if (highPh) soilWarnings.push(L(`pH ${input.ph} is alkaline: P, Fe, Zn, Mn and B availability is reduced.`, `الحموضة ${input.ph} قلوية: تقل إتاحة الفوسفور والحديد والزنك والمنجنيز والبورون.`));
  if (lowPh) soilWarnings.push(L(`pH ${input.ph} is acidic: Ca, Mg and P availability may be reduced.`, `الحموضة ${input.ph} حامضية: قد تقل إتاحة الكالسيوم والمغنيسيوم والفوسفور.`));
  if (saline) soilWarnings.push(L(`EC ${input.ec} dS/m suggests salinity. Salt stress can mimic nutrient deficiency; avoid chloride fertilizers and confirm with ECe/SAR tests.`, `التوصيل ${input.ec} يشير إلى ملوحة. إجهاد الأملاح قد يشبه نقص العناصر؛ تجنب الأسمدة الكلوريدية وتأكد بتحليل ECe/SAR.`));

  const map = new Map<NutrientKey, { evidence: LText[]; score: number }>();
  const add = (n: NutrientKey, e: LText, s: number) => {
    const cur = map.get(n) ?? { evidence: [], score: 0 };
    cur.evidence.push(e);
    cur.score += s;
    map.set(n, cur);
  };
  for (const s of input.suspected) {
    if (s.source === 'image_ai')
      add(s.nutrient, L(`Image analysis suggests possible ${s.nutrient} deficiency symptoms${s.confidence != null ? ` (model confidence ${Math.round(s.confidence * 100)}%)` : ''}`, `تحليل الصورة يشير إلى أعراض محتملة لنقص ${s.nutrient}${s.confidence != null ? ` (ثقة النموذج ${Math.round(s.confidence * 100)}%)` : ''}`), 1);
    else if (s.source === 'user') add(s.nutrient, L(`Farmer-reported symptoms of ${s.nutrient} deficiency`, `أعراض نقص ${s.nutrient} أبلغ عنها المزارع`), 1);
  }
  for (const f of labFlags(input.lab)) add(f.nutrient, f.text, 2);
  for (const [n, v] of map) {
    const info = NUTRIENTS[n];
    if ((highPh && info.highPhRisk) || (lowPh && info.lowPhRisk)) {
      v.evidence.push(L('Soil pH is consistent with reduced availability of this nutrient', 'حموضة التربة تتوافق مع انخفاض إتاحة هذا العنصر'));
      v.score += 0.5;
    }
  }

  const items: FertilizerItem[] = [...map.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([n, v]) => {
      const info = NUTRIENTS[n];
      let ferts = info.fertilizers;
      if (saline) ferts = ferts.filter((f) => !/chloride/i.test(f.name.en));
      if (lowPh) ferts = ferts.filter((f) => !/sulfate \(20\.6|elemental sulfur/i.test(f.name.en));
      const confidence: FertilizerItem['confidence'] = v.score >= 2.5 ? 'high' : v.score >= 1.5 ? 'medium' : 'low';
      return {
        nutrient: n,
        nutrientName: info.name,
        evidence: v.evidence,
        confidence,
        recommendedFertilizers: ferts,
        reason: L(`Typical symptom: ${info.symptoms.en}`, `العرض المعتاد: ${info.symptoms.ar}`),
        applicationMethod: info.application,
        timing: info.timing,
        dose: DOSE_TEXT,
        requiredInfo: [...info.confirmTests, ...(saline && n === 'K' ? [L('Exclude salt injury before adding K', 'استبعد ضرر الأملاح قبل إضافة البوتاسيوم')] : [])],
      };
    });

  return { items, soilWarnings, generalNotes, missingInputs };
}
