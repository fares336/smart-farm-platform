import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import type { Farm } from '../lib/farm';
import type { WeatherSummary } from '../lib/types';

interface Rec { date: string; t2m: number | null; t2mMax: number | null; t2mMin: number | null; rh2m: number | null; precipMm: number | null; et0Mm: number | null; windMs: number | null }

function Content({ farm }: { farm: Farm }) {
  const { t, num, date, lang } = useI18n();
  const { data, loading, error, reload } = useApi<{ summary: WeatherSummary | null; records: Rec[]; refreshError: string | null; note: string }>(`/farms/${farm.id}/weather`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refresh = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/farms/${farm.id}/weather/refresh`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Spinner />;
  const s = data?.summary;
  const rows = data?.records.map((r) => ({ ...r, d: date(r.date) })) ?? [];
  return (
    <div className="space-y-5">
      <PageHeader title={t('Weather & climate', 'الطقس والمناخ')} subtitle={t('Source: NASA POWER daily agro-climatology for the farm coordinates.', 'المصدر: بيانات NASA POWER اليومية لإحداثيات المزرعة.')} actions={<button className="btn-secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />{t('Refresh', 'تحديث')}</button>} />
      <ErrorBox error={error ?? err} />
      {data?.refreshError && <Alert tone="warn">{t('Latest refresh failed; showing previously stored data: ', 'فشل آخر تحديث؛ يتم عرض البيانات المخزنة سابقًا: ')}{data.refreshError}</Alert>}
      <Alert>{t('NASA POWER is satellite/model-based with a delay of a few days — it is not a live station observation.', 'بيانات NASA POWER مبنية على الأقمار الصناعية والنماذج بتأخير عدة أيام — وليست رصدًا حيًا من محطة.')}</Alert>
      {!s ? <Empty title={t('No weather data stored yet', 'لا توجد بيانات طقس مخزنة بعد')} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('Mean air temperature', 'متوسط حرارة الهواء')} value={num(s.latest.t2m)} unit="°C" hint={`${num(s.latest.t2mMin)} – ${num(s.latest.t2mMax)} °C`} />
            <Stat label={t('Relative humidity', 'الرطوبة النسبية')} value={num(s.latest.rh2m, 0)} unit="%" />
            <Stat label={t('Rainfall (30 days)', 'الأمطار (30 يوم)')} value={num(s.mean30.precipTotal)} unit="mm" />
            <Stat label={t('Reference ET₀ (7-day mean)', 'البخر-نتح المرجعي ET₀ (7 أيام)')} value={num(s.et0Mean7, 2)} unit="mm/d" hint="Hargreaves–Samani" />
          </div>
          <p className="text-xs text-slate-500">{t('Latest data day', 'آخر يوم بيانات')}: {date(s.latestDate)} · {t('last fetched', 'آخر جلب')}: {date(s.lastFetchedAt, true)}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t('Temperature (°C)', 'الحرارة (°C)')}>
              <ResponsiveContainer width="100%" height={240}><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="d" fontSize={10} reversed={lang === 'ar'} /><YAxis fontSize={10} orientation={lang === 'ar' ? 'right' : 'left'} /><Tooltip />
                <Line dataKey="t2mMax" name={t('Max', 'العظمى')} stroke="#dc2626" dot={false} /><Line dataKey="t2m" name={t('Mean', 'المتوسط')} stroke="#f59e0b" dot={false} /><Line dataKey="t2mMin" name={t('Min', 'الصغرى')} stroke="#0284c7" dot={false} /></LineChart></ResponsiveContainer>
            </Card>
            <Card title={t('Rainfall & ET₀ (mm/day)', 'الأمطار و ET₀ (مم/يوم)')}>
              <ResponsiveContainer width="100%" height={240}><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="d" fontSize={10} reversed={lang === 'ar'} /><YAxis fontSize={10} orientation={lang === 'ar' ? 'right' : 'left'} /><Tooltip />
                <Bar dataKey="precipMm" name={t('Rain', 'الأمطار')} fill="#0284c7" /><Bar dataKey="et0Mm" name="ET₀" fill="#16a34a" /></BarChart></ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function Weather() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
