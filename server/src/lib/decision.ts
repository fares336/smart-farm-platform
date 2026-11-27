import type { Crop } from '@prisma/client';
import { L, type LText } from './i18n.js';
import type { IrrigationAdvice } from './irrigation.js';
import type { ZoneReadings } from '../services/zoneState.js';

export type Confidence = 'high' | 'medium' | 'low';

export interface Issue {
  id: string;
  title: LText;
  priority: number;
  severity: 'critical' | 'warning' | 'info';
  confidence: Confidence;
  evidence: LText[];
  actions: LText[];
  explanation: LText;
}

export interface ZoneDecision {
  zoneCode: string;
  status: 'good' | 'attention' | 'critical' | 'no_data';
  issues: Issue[];
  missingData: LText[];
}

export interface ZoneContext {
  zoneCode: string;
  readings: ZoneReadings;
  crop: Crop | null;
  weather: { maxTemp3: number; rain3: number; mean30T?: number | null } | null;
  irrigation: IrrigationAdvice | null;
  nutrientFindings: { nutrient: string; confidence: number | null; at: Date }[];
  diseases: { name: string; confidence: number | null; at: Date }[];
  now?: Date;
  staleDays?: number;
}

const DAY = 86_400_000;

export function decideZone(ctx: ZoneContext): ZoneDecision {
  const now = ctx.now ?? new Date();
  const staleDays = ctx.staleDays ?? 30;
  const r = ctx.readings;
  const issues: Issue[] = [];
  const missing: LText[] = [];
  const isFresh = (at?: Date) => !!at && now.getTime() - at.getTime() <= staleDays * DAY;
  const measConf = (at?: Date): Confidence => (isFresh(at) ? 'high' : 'low');

  if (!r.moisture) missing.push(L('Soil moisture', 'رطوبة التربة'));
  if (!r.ph) missing.push(L('Soil pH', 'حموضة التربة'));
  if (!r.ec) missing.push(L('Soil EC', 'التوصيل الكهربي'));
  if (!r.temperature) missing.push(L('Soil temperature', 'حرارة التربة'));
  if (!ctx.crop) missing.push(L('Crop assigned to zone', 'المحصول المزروع بالمنطقة'));
  if (!ctx.weather) missing.push(L('Weather data (NASA POWER)', 'بيانات الطقس (NASA POWER)'));

  if (!r.lastAt) {
    return {
      zoneCode: ctx.zoneCode,
      status: 'no_data',
      issues: [{
        id: 'no_data', title: L('No measurements for this zone', 'لا توجد قياسات لهذه المنطقة'), priority: 50, severity: 'info', confidence: 'high',
        evidence: [L('No robot, manual or lab readings recorded', 'لم تسجل أي قراءات من الروبوت أو يدويًا أو معمليًا')],
        actions: [L('Send the robot to this zone or enter a manual measurement', 'أرسل الروبوت لهذه المنطقة أو أدخل قياسًا يدويًا')],
        explanation: L('Recommendations need real measurements; nothing is assumed.', 'التوصيات تحتاج قياسات فعلية؛ لا يتم افتراض أي قيم.'),
      }],
      missingData: missing,
    };
  }

  const ecThr = ctx.crop?.ecThreshold ?? 4;
  const hot = ctx.weather != null && ctx.weather.maxTemp3 >= 35;
  const salineHigh = r.ec != null && r.ec.value > ecThr;

  if (r.moisture && ctx.irrigation && (ctx.irrigation.status === 'urgent' || ctx.irrigation.status === 'irrigate')) {
    const urgent = ctx.irrigation.status === 'urgent';
    const ev = [...ctx.irrigation.reasons];
    if (hot) ev.push(L(`Max air temperature reached ${ctx.weather!.maxTemp3.toFixed(1)}°C in the last 3 days (higher water demand)`, `وصلت درجة الحرارة العظمى إلى ${ctx.weather!.maxTemp3.toFixed(1)}°م خلال آخر 3 أيام (احتياج مائي أعلى)`));
    issues.push({
      id: 'water_deficit', title: L('Water deficit', 'نقص المياه'), priority: (urgent ? 90 : 70) + (hot ? 8 : 0), severity: urgent ? 'critical' : 'warning', confidence: measConf(r.moisture.at),
      evidence: ev,
      actions: [L('Irrigate this zone; prefer early morning or evening', 'اروِ هذه المنطقة ويفضل الصباح الباكر أو المساء'), ...(salineHigh ? [L('Include a leaching fraction since EC is high', 'أضف كمية غسيل لأن التوصيل الكهربي مرتفع')] : [])],
      explanation: L('Soil moisture is below what the crop needs, so plants may be stressed.', 'رطوبة التربة أقل مما يحتاجه المحصول، لذلك قد تتعرض النباتات للإجهاد.'),
    });
  }
  if (ctx.irrigation?.status === 'too_wet') {
    issues.push({
      id: 'waterlogging', title: L('Excess soil water', 'زيادة مياه التربة'), priority: 60, severity: 'warning', confidence: measConf(r.moisture?.at),
      evidence: ctx.irrigation.reasons, actions: [L('Pause irrigation and inspect drainage', 'أوقف الري وافحص الصرف')],
      explanation: L('Too much water reduces root oxygen and nutrient uptake.', 'زيادة المياه تقلل أكسجين الجذور وامتصاص العناصر.'),
    });
  }

  if (r.ec && salineHigh) {
    const ev = [L(`Measured EC ${r.ec.value} dS/m exceeds the ${ctx.crop ? `${ctx.crop.nameEn} ` : ''}tolerance threshold of ${ecThr} dS/m`, `التوصيل المقاس ${r.ec.value} يتجاوز حد التحمل ${ecThr} ديسي سيمنز/م`)];
    if (r.moisture && r.moisture.value < (ctx.crop?.moistureOptMin ?? 35)) ev.push(L('Low moisture concentrates salts in the root zone', 'انخفاض الرطوبة يركّز الأملاح في منطقة الجذور'));
    issues.push({
      id: 'salinity', title: L('Salinity risk', 'خطر الملوحة'), priority: 80, severity: r.ec.value > ecThr * 2 ? 'critical' : 'warning', confidence: r.ec.source === 'LAB' ? 'high' : 'medium',
      evidence: ev,
      actions: [L('Confirm with lab ECe and SAR tests', 'تأكد بتحليل ECe وSAR معمليًا'), L('Apply leaching irrigation if drainage is adequate', 'نفّذ ري غسيل إذا كان الصرف جيدًا'), L('Consider salt-tolerant crops (see crop recommendations)', 'فكّر في محاصيل متحملة للملوحة (انظر توصيات المحاصيل)')],
      explanation: L('High salt makes it harder for roots to take up water, even when soil is wet. Probe EC is an indicator; lab ECe is the reference.', 'ارتفاع الأملاح يصعّب امتصاص الجذور للمياه حتى لو كانت التربة رطبة. قراءة المجس مؤشر، والمرجع هو ECe المعملي.'),
    });
  }

  if (r.ph && ctx.crop && (r.ph.value < ctx.crop.phOptMin || r.ph.value > ctx.crop.phOptMax)) {
    const high = r.ph.value > ctx.crop.phOptMax;
    issues.push({
      id: 'ph', title: high ? L('Alkaline soil for this crop', 'تربة قلوية بالنسبة لهذا المحصول') : L('Acidic soil for this crop', 'تربة حامضية بالنسبة لهذا المحصول'),
      priority: 55, severity: 'warning', confidence: measConf(r.ph.at),
      evidence: [L(`pH ${r.ph.value} vs optimum ${ctx.crop.phOptMin}–${ctx.crop.phOptMax} for ${ctx.crop.nameEn}`, `الحموضة ${r.ph.value} مقابل المدى الأمثل ${ctx.crop.phOptMin}–${ctx.crop.phOptMax}`)],
      actions: high
        ? [L('Use acidifying fertilizers and chelated micronutrients (Fe-EDDHA, Zn)', 'استخدم أسمدة حامضية التأثير وعناصر صغرى مخلبية'), L('Confirm with lab pH and CaCO3 test', 'تأكد بتحليل الحموضة وكربونات الكالسيوم معمليًا')]
        : [L('Confirm with lab pH and lime requirement test', 'تأكد بتحليل الحموضة واحتياج الجير معمليًا')],
      explanation: high
        ? L('At high pH, iron, zinc and phosphorus become less available to plants.', 'في الحموضة العالية تقل إتاحة الحديد والزنك والفوسفور للنبات.')
        : L('At low pH, calcium, magnesium and phosphorus may be less available.', 'في الحموضة المنخفضة قد تقل إتاحة الكالسيوم والمغنيسيوم والفوسفور.'),
    });
  }

  for (const f of ctx.nutrientFindings.slice(0, 3)) {
    const ev = [L(`Image analysis suggested possible ${f.nutrient} deficiency${f.confidence != null ? ` (model confidence ${Math.round(f.confidence * 100)}%)` : ''}`, `أشار تحليل الصورة إلى احتمال نقص ${f.nutrient}${f.confidence != null ? ` (ثقة النموذج ${Math.round(f.confidence * 100)}%)` : ''}`)];
    let conf: Confidence = 'low';
    const actions = [L('Confirm with leaf tissue or soil lab analysis before fertilizing', 'تأكد بتحليل أوراق أو تربة معمليًا قبل التسميد'), L('See Fertilizer Recommendations page', 'راجع صفحة توصيات الأسمدة')];
    if (f.nutrient === 'K' && salineHigh) {
      ev.push(L('High EC: salt injury can produce the same leaf-edge scorch as K deficiency', 'التوصيل المرتفع: ضرر الأملاح قد يسبب نفس احتراق الحواف مثل نقص البوتاسيوم'));
      actions.unshift(L('Rule out salinity first (ECe/SAR)', 'استبعد الملوحة أولًا (ECe/SAR)'));
    }
    if (['Fe', 'Zn', 'Mn', 'P'].includes(f.nutrient) && r.ph && r.ph.value > 7.8) {
      ev.push(L(`Soil pH ${r.ph.value} supports reduced ${f.nutrient} availability`, `الحموضة ${r.ph.value} تدعم انخفاض إتاحة ${f.nutrient}`));
      conf = 'medium';
    }
    issues.push({
      id: `nutrient_${f.nutrient}`, title: L(`Possible ${f.nutrient} deficiency`, `احتمال نقص ${f.nutrient}`), priority: 45 + (conf === 'medium' ? 10 : 0), severity: 'warning', confidence: conf,
      evidence: ev, actions,
      explanation: L('Photos show symptoms only; they do not measure nutrients in soil.', 'الصور تُظهر الأعراض فقط ولا تقيس العناصر في التربة.'),
    });
  }

  const d = ctx.diseases[0];
  if (d && (d.confidence == null || d.confidence >= 0.3)) {
    issues.push({
      id: 'disease', title: L(`Possible disease: ${d.name}`, `مرض محتمل: ${d.name}`), priority: 75, severity: 'warning', confidence: 'low',
      evidence: [L(`AI image diagnosis on ${d.at.toISOString().slice(0, 10)}${d.confidence != null ? ` (model score ${Math.round(d.confidence * 100)}%)` : ''}`, `تشخيص صورة بالذكاء الاصطناعي بتاريخ ${d.at.toISOString().slice(0, 10)}`)],
      actions: [L('Inspect plants in the field and confirm with an agricultural extension officer', 'افحص النباتات في الحقل وتأكد مع مرشد زراعي'), L('Follow the treatment shown in the Plant Health report', 'اتبع العلاج الموضح في تقرير صحة النبات')],
      explanation: L('AI scores are not calibrated probabilities; field confirmation is needed.', 'درجات الذكاء الاصطناعي ليست احتمالات مؤكدة؛ يلزم التأكد في الحقل.'),
    });
  }

  if (!isFresh(r.lastAt)) {
    issues.push({
      id: 'stale', title: L('Measurements are outdated', 'القياسات قديمة'), priority: 40, severity: 'info', confidence: 'high',
      evidence: [L(`Last reading on ${r.lastAt.toISOString().slice(0, 10)} (older than ${staleDays} days)`, `آخر قراءة بتاريخ ${r.lastAt.toISOString().slice(0, 10)} (أقدم من ${staleDays} يومًا)`)],
      actions: [L('Re-measure this zone', 'أعد قياس هذه المنطقة')],
      explanation: L('Old readings may not reflect current conditions.', 'القراءات القديمة قد لا تعبر عن الحالة الحالية.'),
    });
  }

  issues.sort((a, b) => b.priority - a.priority);
  const status = issues.some((i) => i.severity === 'critical') ? 'critical' : issues.some((i) => i.severity === 'warning') ? 'attention' : 'good';
  return { zoneCode: ctx.zoneCode, status, issues, missingData: missing };
}
