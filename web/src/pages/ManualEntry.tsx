import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RequireFarm } from '../components/Layout';
import { Alert, Card, ErrorBox, Field, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { nowLocal } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { Zone } from '../lib/types';

const num = (s: string) => (s.trim() === '' ? null : Number(s));

function Content({ farm }: { farm: Farm }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const zones = useApi<{ zones: Zone[] }>(`/farms/${farm.id}/zones`);
  const empty = { moisture: '', ph: '', ec: '', temperature: '', nitrogenPpm: '', phosphorusPpm: '', potassiumPpm: '', organicMatterPct: '', notes: '' };
  const [zoneId, setZoneId] = useState(params.get('zone') ?? '');
  const [source, setSource] = useState<'MANUAL' | 'LAB'>('MANUAL');
  const [at, setAt] = useState(nowLocal());
  const [v, setV] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api.post(`/farms/${farm.id}/measurements`, {
        zoneId, source, measuredAt: new Date(at).toISOString(),
        moisture: num(v.moisture), ph: num(v.ph), ec: num(v.ec), temperature: num(v.temperature),
        nitrogenPpm: num(v.nitrogenPpm), phosphorusPpm: num(v.phosphorusPpm), potassiumPpm: num(v.potassiumPpm), organicMatterPct: num(v.organicMatterPct), notes: v.notes || null,
      });
      const code = zones.data?.zones.find((z) => z.id === zoneId)?.code;
      setOk(t(`Saved for zone ${code}.`, `تم الحفظ للمنطقة ${code}.`));
      setV(empty);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const input = (k: keyof typeof empty, label: string, hint: string, step = 'any', min = 0, max?: number) => (
    <Field label={label} hint={hint}><input className="input" type="number" step={step} min={min} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
  );
  return (
    <div className="space-y-5">
      <PageHeader title={t('Manual soil measurement', 'إدخال قياس تربة يدوي')} subtitle={t('Readings are stored with their source (manual or laboratory) and never overwrite robot data.', 'تُحفظ القراءات مع مصدرها (يدوي أو معمل) ولا تستبدل بيانات الروبوت.')} />
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <ErrorBox error={error} />
          {ok && <Alert>{ok}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('Zone', 'المنطقة')}><select className="input" required value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">{t('Select zone', 'اختر المنطقة')}</option>{zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.code}</option>)}</select></Field>
            <Field label={t('Source', 'المصدر')}><select className="input" value={source} onChange={(e) => setSource(e.target.value as 'MANUAL' | 'LAB')}><option value="MANUAL">{t('Manual (field meter)', 'يدوي (جهاز حقلي)')}</option><option value="LAB">{t('Laboratory analysis', 'تحليل معملي')}</option></select></Field>
            <Field label={t('Date & time measured', 'تاريخ ووقت القياس')}><input className="input" type="datetime-local" required value={at} max={nowLocal()} onChange={(e) => setAt(e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {input('moisture', t('Moisture (%)', 'الرطوبة (%)'), '0–100', 'any', 0, 100)}
            {input('ph', 'pH', '0–14', 'any', 0, 14)}
            {input('ec', 'EC (dS/m)', t('Saturated paste / 1:1 as reported', 'حسب طريقة القياس'), 'any', 0, 30)}
            {input('temperature', t('Soil temperature (°C)', 'حرارة التربة (°C)'), '-20–70', 'any', -20, 70)}
          </div>
          {source === 'LAB' && (
            <div className="grid gap-4 sm:grid-cols-4">
              {input('nitrogenPpm', 'N (ppm)', t('Available N', 'النيتروجين الميسر'))}
              {input('phosphorusPpm', 'P (ppm)', t('Olsen P', 'فوسفور أولسن'))}
              {input('potassiumPpm', 'K (ppm)', t('Exchangeable K', 'البوتاسيوم المتبادل'))}
              {input('organicMatterPct', t('Organic matter (%)', 'المادة العضوية (%)'), '0–100', 'any', 0, 100)}
            </div>
          )}
          <Field label={t('Notes', 'ملاحظات')}><textarea className="input" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <p className="text-xs text-slate-500">{t('Leave fields empty if not measured — empty values are stored as missing, not zero.', 'اترك الحقول فارغة إذا لم تُقس — تُحفظ كقيم مفقودة وليست صفرًا.')}</p>
          <button className="btn-primary">{t('Save measurement', 'حفظ القياس')}</button>
        </form>
      </Card>
    </div>
  );
}

export default function ManualEntry() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
