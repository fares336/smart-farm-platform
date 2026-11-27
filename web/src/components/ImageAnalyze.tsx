import { useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { useFarm } from '../lib/farm';
import { STAGES } from '../lib/labels';
import type { Crop, Zone } from '../lib/types';
import { Alert, Card, ErrorBox, Field } from './ui';

export function ImageAnalyze<T>({ endpoint, onResult, children }: { endpoint: string; onResult: (r: T) => void; children?: ReactNode }) {
  const { t, lt, lang } = useI18n();
  const { farm } = useFarm();
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const zones = useApi<{ zones: Zone[] }>(farm ? `/farms/${farm.id}/zones` : null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropKey, setCropKey] = useState('');
  const [stage, setStage] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append('image', file);
    if (farm) fd.append('farmId', farm.id);
    if (zoneId) fd.append('zoneId', zoneId);
    if (cropKey) fd.append('cropKey', cropKey);
    if (stage) fd.append('growthStage', stage);
    try {
      onResult(await api.post<T>(endpoint, fd));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 hover:border-brand-500">
          {preview ? <img src={preview} alt="" className="max-h-64 rounded-lg object-contain" /> : <><Upload className="mb-2" />{t('Upload a clear photo of the affected leaves (JPEG/PNG/WebP, max 8 MB)', 'ارفع صورة واضحة للأوراق المصابة (JPEG/PNG/WebP بحد أقصى 8 ميجا)')}</>}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        <div className="space-y-3">
          <ErrorBox error={err} />
          <Field label={t('Crop', 'المحصول')}><select className="input" value={cropKey} onChange={(e) => setCropKey(e.target.value)}><option value="">—</option>{crops.data?.crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
          <Field label={t('Growth stage', 'مرحلة النمو')}><select className="input" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">—</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{lt(s.label)}</option>)}</select></Field>
          {farm && <Field label={t('Zone (links result to the map)', 'المنطقة (لربط النتيجة بالخريطة)')}><select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">—</option>{zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.code}</option>)}</select></Field>}
          {children}
          <button className="btn-primary w-full" disabled={!file || busy} onClick={run}>{busy ? t('Analyzing…', 'جارٍ التحليل…') : t('Analyze image', 'تحليل الصورة')}</button>
        </div>
      </div>
    </Card>
  );
}

export function Unavailable() {
  const { t } = useI18n();
  return <Alert tone="warn">{t('AI analysis is not available: no AI provider is configured on the server. The image was stored, but no diagnosis is shown because the system never invents results. Ask the administrator to set AI_DISEASE_PROVIDER / AI_NUTRIENT_PROVIDER (see README).', 'تحليل الذكاء الاصطناعي غير متاح: لم يتم إعداد مزود على الخادم. تم حفظ الصورة، لكن لا يُعرض تشخيص لأن النظام لا يخترع نتائج. اطلب من المدير ضبط AI_DISEASE_PROVIDER / AI_NUTRIENT_PROVIDER (راجع README).')}</Alert>;
}
