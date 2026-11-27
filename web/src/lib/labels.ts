import type { LText } from './i18n';

export const STATUS_LABEL: Record<string, LText> = {
  good: { en: 'Good', ar: 'جيد' },
  attention: { en: 'Needs attention', ar: 'يحتاج انتباه' },
  critical: { en: 'Critical', ar: 'حرج' },
  no_data: { en: 'No Measurement Available', ar: 'لا توجد قياسات متاحة' },
};

export const IRR_LABEL: Record<string, LText> = {
  urgent: { en: 'Irrigate now', ar: 'ري فوري' },
  irrigate: { en: 'Irrigation recommended', ar: 'يُنصح بالري' },
  ok: { en: 'Moisture adequate', ar: 'الرطوبة كافية' },
  too_wet: { en: 'Too wet', ar: 'رطوبة زائدة' },
  no_data: { en: 'No data', ar: 'لا توجد بيانات' },
};

export const ROBOT_LABEL: Record<string, LText> = {
  connected: { en: 'Connected', ar: 'متصل' },
  disconnected: { en: 'Disconnected', ar: 'غير متصل' },
  sending_data: { en: 'Sending data', ar: 'يرسل البيانات' },
  error: { en: 'Error', ar: 'خطأ' },
};

export const STAGES: { key: string; label: LText }[] = [
  { key: 'initial', label: { en: 'Initial', ar: 'بداية النمو' } },
  { key: 'development', label: { en: 'Development', ar: 'النمو الخضري' } },
  { key: 'mid', label: { en: 'Mid-season', ar: 'منتصف الموسم' } },
  { key: 'late', label: { en: 'Late season', ar: 'نهاية الموسم' } },
];

export const EXPENSE_LABEL: Record<string, LText> = {
  seeds: { en: 'Seeds', ar: 'بذور' },
  fertilizers: { en: 'Fertilizers', ar: 'أسمدة' },
  water: { en: 'Water', ar: 'مياه' },
  electricity: { en: 'Electricity', ar: 'كهرباء' },
  labor: { en: 'Labor', ar: 'عمالة' },
  pesticides: { en: 'Pesticides', ar: 'مبيدات' },
  transportation: { en: 'Transportation', ar: 'نقل' },
  fuel: { en: 'Fuel', ar: 'وقود' },
  equipment: { en: 'Equipment', ar: 'معدات' },
  other: { en: 'Other', ar: 'أخرى' },
};

export const NUTRIENT_NAMES: Record<string, LText> = {
  N: { en: 'Nitrogen (N)', ar: 'النيتروجين (N)' },
  P: { en: 'Phosphorus (P)', ar: 'الفوسفور (P)' },
  K: { en: 'Potassium (K)', ar: 'البوتاسيوم (K)' },
  Ca: { en: 'Calcium (Ca)', ar: 'الكالسيوم (Ca)' },
  Mg: { en: 'Magnesium (Mg)', ar: 'الماغنسيوم (Mg)' },
  S: { en: 'Sulfur (S)', ar: 'الكبريت (S)' },
  Fe: { en: 'Iron (Fe)', ar: 'الحديد (Fe)' },
  Zn: { en: 'Zinc (Zn)', ar: 'الزنك (Zn)' },
  Mn: { en: 'Manganese (Mn)', ar: 'المنجنيز (Mn)' },
  B: { en: 'Boron (B)', ar: 'البورون (B)' },
  Cu: { en: 'Copper (Cu)', ar: 'النحاس (Cu)' },
};

export const today = () => new Date().toISOString().slice(0, 10);
export const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
