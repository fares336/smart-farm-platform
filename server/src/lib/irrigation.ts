import type { Crop } from '@prisma/client';
import { L, type LText } from './i18n.js';

/** FAO-56 eq. 21 extraterrestrial radiation, MJ m-2 day-1. */
export function extraterrestrialRadiation(latDeg: number, date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const J = Math.floor((date.getTime() - start) / 86_400_000);
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * J);
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * J - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/** Hargreaves–Samani reference evapotranspiration (mm/day), FAO-56 eq. 52. */
export function hargreavesEt0(tMean: number, tMax: number, tMin: number, latDeg: number, date: Date) {
  const ra = extraterrestrialRadiation(latDeg, date);
  const et0 = 0.0023 * (tMean + 17.8) * Math.sqrt(Math.max(0, tMax - tMin)) * ra * 0.408;
  return Math.max(0, et0);
}

export type GrowthStage = 'initial' | 'development' | 'mid' | 'late';

export function cropKc(crop: Pick<Crop, 'kcIni' | 'kcMid' | 'kcEnd'>, stage: GrowthStage | null | undefined) {
  switch (stage) {
    case 'initial':
      return crop.kcIni;
    case 'development':
      return (crop.kcIni + crop.kcMid) / 2;
    case 'late':
      return crop.kcEnd;
    default:
      return crop.kcMid;
  }
}

export type IrrigationStatus = 'urgent' | 'irrigate' | 'ok' | 'too_wet' | 'no_data';

export interface IrrigationAdvice {
  status: IrrigationStatus;
  moisture: number | null;
  targetMin: number | null;
  targetMax: number | null;
  kc: number | null;
  et0MmDay: number | null;
  etcMmDay: number | null;
  dailyNeedM3: number | null;
  reasons: LText[];
}

export function irrigationAdvice(args: {
  moisture: number | null;
  crop: Crop | null;
  stage?: GrowthStage | null;
  et0MmDay: number | null;
  zoneAreaM2: number;
  recentRainMm?: number | null;
}): IrrigationAdvice {
  const { moisture, crop, stage, et0MmDay, zoneAreaM2, recentRainMm } = args;
  const reasons: LText[] = [];
  const kc = crop ? cropKc(crop, stage) : null;
  const etc = kc != null && et0MmDay != null ? kc * et0MmDay : null;
  const dailyNeedM3 = etc != null ? (etc * zoneAreaM2) / 1000 : null;
  if (etc != null && kc != null && et0MmDay != null) {
    reasons.push(L(`Crop water use ≈ Kc ${kc.toFixed(2)} × ET0 ${et0MmDay.toFixed(1)} mm/day = ${etc.toFixed(1)} mm/day (FAO-56)`, `استهلاك المحصول للمياه ≈ Kc ${kc.toFixed(2)} × ET0 ${et0MmDay.toFixed(1)} مم/يوم = ${etc.toFixed(1)} مم/يوم (FAO-56)`));
  }
  if (moisture == null) {
    reasons.unshift(L('No soil moisture measurement for this zone', 'لا توجد قراءة رطوبة لهذه المنطقة'));
    return { status: 'no_data', moisture, targetMin: crop?.moistureOptMin ?? null, targetMax: crop?.moistureOptMax ?? null, kc, et0MmDay, etcMmDay: etc, dailyNeedM3, reasons };
  }
  const tMin = crop?.moistureOptMin ?? 35;
  const tMax = crop?.moistureOptMax ?? 65;
  const hardMin = crop?.moistureMin ?? 25;
  if (!crop) reasons.push(L('No crop assigned to zone; using generic 35–65% target', 'لم يتم تحديد محصول للمنطقة؛ تم استخدام مدى عام 35–65%'));
  let status: IrrigationStatus;
  if (moisture < hardMin) {
    status = 'urgent';
    reasons.unshift(L(`Moisture ${moisture}% is below the stress limit ${hardMin}%`, `الرطوبة ${moisture}% أقل من حد الإجهاد ${hardMin}%`));
  } else if (moisture < tMin) {
    status = 'irrigate';
    reasons.unshift(L(`Moisture ${moisture}% is below the target range ${tMin}–${tMax}%`, `الرطوبة ${moisture}% أقل من المدى المستهدف ${tMin}–${tMax}%`));
  } else if (moisture > tMax + 15) {
    status = 'too_wet';
    reasons.unshift(L(`Moisture ${moisture}% is well above the target; pause irrigation and check drainage`, `الرطوبة ${moisture}% أعلى بكثير من المستهدف؛ أوقف الري وافحص الصرف`));
  } else {
    status = 'ok';
    reasons.unshift(L(`Moisture ${moisture}% is within or near the target range ${tMin}–${tMax}%`, `الرطوبة ${moisture}% ضمن أو قرب المدى المستهدف ${tMin}–${tMax}%`));
  }
  if (recentRainMm != null && recentRainMm > 5 && (status === 'irrigate' || status === 'urgent')) {
    reasons.push(L(`${recentRainMm.toFixed(1)} mm of rain recorded in the last 3 days; re-measure before irrigating`, `تم تسجيل ${recentRainMm.toFixed(1)} مم أمطار خلال آخر 3 أيام؛ أعد القياس قبل الري`));
  }
  return { status, moisture, targetMin: tMin, targetMax: tMax, kc, et0MmDay, etcMmDay: etc, dailyNeedM3, reasons };
}
