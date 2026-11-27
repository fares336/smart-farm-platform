import { useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Trash2 } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, DemoBanner, Empty, ErrorBox, Field, IRR_TONE, PageHeader, Spinner, Stat, Table } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { IRR_LABEL, today } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { IrrigationAdvice } from '../lib/types';

interface Resp {
  zones: { zoneId: string; code: string; cropKey: string | null; growthStage: string | null; areaM2: number; advice: IrrigationAdvice }[];
  summary: { urgent: number; irrigate: number; ok: number; tooWet: number; noData: number; et0Mean7: number | null };
  records: { id: string; date: string; volumeM3: number; durationMin: number | null; method: string | null; zone: { code: string } | null }[];
  monthly: { month: string; volume: number; events: number }[];
}

function Content({ farm }: { farm: Farm }) {
  const { t, lt, num, date, lang } = useI18n();
  const { data, loading, error, reload } = useApi<Resp>(`/farms/${farm.id}/irrigation`);
  const [f, setF] = useState({ zoneId: '', date: today(), volumeM3: '', durationMin: '', method: '' });
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/farms/${farm.id}/irrigation-records`, { zoneId: f.zoneId || null, date: f.date, volumeM3: Number(f.volumeM3), durationMin: f.durationMin ? Number(f.durationMin) : null, method: f.method || null });
      setF({ ...f, volumeM3: '', durationMin: '' });
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  if (loading) return <Spinner />;
  if (!data) return <ErrorBox error={error} />;
  const needing = data.zones.filter((z) => z.advice.status === 'urgent' || z.advice.status === 'irrigate' || z.advice.status === 'too_wet');
  const shown = showAll ? data.zones.filter((z) => z.advice.status !== 'no_data') : needing;
  const totalNeed = needing.reduce((a, z) => a + (z.advice.status !== 'too_wet' ? z.advice.dailyNeedM3 ?? 0 : 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader title={t('Irrigation management', 'إدارة الري')} subtitle={t('Per-zone advice from measured moisture, crop coefficient (FAO-56) and ET₀.', 'توصيات لكل منطقة من الرطوبة المقاسة ومعامل المحصول (FAO-56) و ET₀.')} />
      <DemoBanner show={farm.isDemo} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={lt(IRR_LABEL.urgent)} value={data.summary.urgent} tone="red" />
        <Stat label={lt(IRR_LABEL.irrigate)} value={data.summary.irrigate} tone="amber" />
        <Stat label={lt(IRR_LABEL.ok)} value={data.summary.ok} tone="green" />
        <Stat label={lt(IRR_LABEL.too_wet)} value={data.summary.tooWet} tone="blue" />
        <Stat label={t('No Measurement Available', 'لا توجد قياسات')} value={data.summary.noData} />
      </div>
      {needing.length > 0 && totalNeed > 0 && <Alert>{t(`Estimated crop water use (ETc) of zones needing irrigation: ${num(totalNeed, 1)} m³/day. Actual application depends on irrigation efficiency.`, `الاستهلاك المائي التقديري (ETc) للمناطق التي تحتاج ري: ${num(totalNeed, 1)} م³/يوم. الكمية الفعلية تعتمد على كفاءة الري.`)}</Alert>}
      <Card title={showAll ? t('All measured zones', 'كل المناطق المقاسة') : t('Zones needing action', 'مناطق تحتاج إجراء')} actions={<button className="btn-ghost text-sm" onClick={() => setShowAll(!showAll)}>{showAll ? t('Only zones needing action', 'المناطق التي تحتاج إجراء فقط') : t('Show all measured', 'عرض كل المقاسة')}</button>}>
        {shown.length ? (
          <Table head={[t('Zone', 'المنطقة'), t('Status', 'الحالة'), t('Moisture', 'الرطوبة'), t('Target', 'المستهدف'), 'Kc', 'ETc mm/d', t('Need m³/d', 'الاحتياج م³/يوم'), t('Why', 'السبب')]}>
            {shown.map((z) => (
              <tr key={z.zoneId}>
                <td className="font-medium">{z.code}</td>
                <td><Badge tone={IRR_TONE[z.advice.status as keyof typeof IRR_TONE]}>{lt(IRR_LABEL[z.advice.status])}</Badge></td>
                <td>{num(z.advice.moisture)}%</td>
                <td>{z.advice.targetMin != null ? `${z.advice.targetMin}–${z.advice.targetMax}%` : '—'}</td>
                <td>{num(z.advice.kc, 2)}</td><td>{num(z.advice.etcMmDay, 2)}</td><td>{num(z.advice.dailyNeedM3, 2)}</td>
                <td className="max-w-md whitespace-normal text-xs text-slate-600">{z.advice.reasons.map(lt).join(' ')}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty title={data.summary.noData === data.zones.length ? t('No moisture measurements yet', 'لا توجد قياسات رطوبة بعد') : t('No zone needs irrigation now', 'لا توجد منطقة تحتاج ري الآن')} />}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('Record irrigation', 'تسجيل ري')}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><ErrorBox error={err} /></div>
            <Field label={t('Zone (optional)', 'المنطقة (اختياري)')}><select className="input" value={f.zoneId} onChange={(e) => setF({ ...f, zoneId: e.target.value })}><option value="">{t('Whole farm', 'المزرعة كلها')}</option>{data.zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.code}</option>)}</select></Field>
            <Field label={t('Date', 'التاريخ')}><input className="input" type="date" required value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label={t('Volume (m³)', 'الكمية (م³)')}><input className="input" type="number" step="any" min="0" required value={f.volumeM3} onChange={(e) => setF({ ...f, volumeM3: e.target.value })} /></Field>
            <Field label={t('Duration (min)', 'المدة (دقيقة)')}><input className="input" type="number" min="0" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></Field>
            <Field label={t('Method', 'الطريقة')}><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="">—</option><option value="flood">{t('Flood / furrow', 'غمر / خطوط')}</option><option value="drip">{t('Drip', 'تنقيط')}</option><option value="sprinkler">{t('Sprinkler', 'رش')}</option></select></Field>
            <div className="flex items-end"><button className="btn-primary w-full">{t('Save', 'حفظ')}</button></div>
          </form>
        </Card>
        <Card title={t('Water use by month (m³)', 'استهلاك المياه شهريًا (م³)')}>
          {data.monthly.length ? (
            <ResponsiveContainer width="100%" height={220}><BarChart data={data.monthly.map((m) => ({ ...m, m: new Date(m.month).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: '2-digit' }) }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="m" fontSize={10} reversed={lang === 'ar'} /><YAxis fontSize={10} orientation={lang === 'ar' ? 'right' : 'left'} /><Tooltip /><Bar dataKey="volume" name="m³" fill="#0284c7" radius={4} /></BarChart></ResponsiveContainer>
          ) : <Empty title={t('No irrigation records', 'لا توجد سجلات ري')}>{t('Water savings are only reported once comparable historical records exist.', 'يتم حساب توفير المياه فقط عند وجود سجلات تاريخية قابلة للمقارنة.')}</Empty>}
        </Card>
      </div>
      {data.records.length > 0 && (
        <Card title={t('Irrigation history', 'سجل الري')}>
          <Table head={[t('Date', 'التاريخ'), t('Zone', 'المنطقة'), 'm³', t('Minutes', 'دقائق'), t('Method', 'الطريقة'), '']}>
            {data.records.map((r) => <tr key={r.id}><td>{date(r.date)}</td><td>{r.zone?.code ?? t('Farm', 'المزرعة')}</td><td>{num(r.volumeM3, 2)}</td><td>{num(r.durationMin, 0)}</td><td>{r.method ?? '—'}</td><td><button className="btn-ghost p-1 text-red-600" onClick={async () => { await api.del(`/farms/${farm.id}/irrigation-records/${r.id}`); reload(); }}><Trash2 size={14} /></button></td></tr>)}
          </Table>
        </Card>
      )}
    </div>
  );
}

export default function Irrigation() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
