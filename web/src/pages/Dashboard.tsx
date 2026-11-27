import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bot, CloudSun, Coins, Droplets, FlaskConical, Grid3x3, Map, Thermometer, Waves } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, DemoBanner, Empty, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { IRR_LABEL, ROBOT_LABEL } from '../lib/labels';
import type { FinancialSummary, WeatherSummary } from '../lib/types';
import type { Farm } from '../lib/farm';

interface DashboardData {
  totals: { areaHectares: number; zones: number; zonesMeasured: number };
  soil: { moisture: number | null; ph: number | null; ec: number | null; temperature: number | null };
  weather: WeatherSummary | null;
  robots: { id: string; name: string; deviceUid: string; status: string; lastDataAt: string | null; batteryPct: number | null }[];
  cropRecommendations: { key: string; nameEn: string; nameAr: string; zones: number; avgScore: number }[];
  irrigation: Record<string, number>;
  finance: { actual: FinancialSummary; estimated: FinancialSummary };
}

function Content({ farm }: { farm: Farm }) {
  const { t, num, money, date, lang } = useI18n();
  const { data, error, loading } = useApi<DashboardData>(`/farms/${farm.id}/dashboard`);
  const series = useApi<{ series: { day: string; moisture: number | null; ph: number | null; ec: number | null; n: number }[] }>(`/farms/${farm.id}/measurements/timeseries?days=60`);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const noSoil = data.totals.zonesMeasured === 0;
  const fin = data.finance.actual;
  const hasActualFin = fin.totalRevenue > 0 || fin.totalCosts > 0;
  const irrData = Object.entries(data.irrigation).map(([k, v]) => ({ name: IRR_LABEL[k]?.[lang] ?? k, zones: v }));
  return (
    <div className="space-y-6">
      <PageHeader title={farm.name} subtitle={`${farm.locationName ?? ''} · ${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`} actions={<Link to="/app/map" className="btn-primary"><Map size={16} />{t('Open zone map', 'افتح خريطة المناطق')}</Link>} />
      <DemoBanner show={farm.isDemo} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('Farm area', 'مساحة المزرعة')} value={num(data.totals.areaHectares, 2)} unit={t('ha', 'هكتار')} hint={`${num(data.totals.areaHectares * 2.381, 1)} ${t('feddan', 'فدان')}`} icon={<Map size={18} />} tone="green" />
        <Stat label={t('Zones measured', 'المناطق المقاسة')} value={`${data.totals.zonesMeasured} / ${data.totals.zones}`} hint={noSoil ? t('No measurements yet', 'لا توجد قياسات بعد') : undefined} icon={<Grid3x3 size={18} />} />
        <Stat label={t('Avg. soil moisture', 'متوسط رطوبة التربة')} value={num(data.soil.moisture)} unit={data.soil.moisture != null ? '%' : undefined} icon={<Droplets size={18} />} tone="blue" />
        <Stat label={t('Avg. soil pH', 'متوسط حموضة التربة')} value={num(data.soil.ph, 2)} icon={<FlaskConical size={18} />} tone="amber" />
        <Stat label={t('Avg. EC (salinity)', 'متوسط الملوحة EC')} value={num(data.soil.ec, 2)} unit={data.soil.ec != null ? 'dS/m' : undefined} icon={<Waves size={18} />} />
        <Stat label={t('Avg. soil temperature', 'متوسط حرارة التربة')} value={num(data.soil.temperature)} unit={data.soil.temperature != null ? '°C' : undefined} icon={<Thermometer size={18} />} tone="red" />
        <Stat label={t('Air temperature (NASA POWER)', 'حرارة الهواء (NASA POWER)')} value={num(data.weather?.latest.t2m)} unit={data.weather ? '°C' : undefined} hint={data.weather ? `${t('Day', 'يوم')} ${date(data.weather.latestDate)}` : t('Not available', 'غير متاح')} icon={<CloudSun size={18} />} tone="blue" />
        <Stat label={t('Actual net profit', 'صافي الربح الفعلي')} value={hasActualFin ? money(fin.netProfit) : '—'} hint={hasActualFin ? `${t('Revenue', 'الإيرادات')} ${money(fin.totalRevenue)} · ${t('Costs', 'التكاليف')} ${money(fin.totalCosts)}` : t('No actual records', 'لا توجد سجلات فعلية')} icon={<Coins size={18} />} tone={fin.netProfit < 0 ? 'red' : 'green'} />
      </div>
      {noSoil && <Alert tone="info">{t('No soil measurements yet. Connect your robot or add a manual/lab reading to see soil metrics and recommendations.', 'لا توجد قياسات تربة بعد. اربط الروبوت أو أضف قراءة يدوية/معملية لعرض مؤشرات التربة والتوصيات.')} <Link to="/app/robot" className="font-medium underline">{t('Robot setup', 'إعداد الروبوت')}</Link> · <Link to="/app/manual" className="font-medium underline">{t('Manual entry', 'إدخال يدوي')}</Link></Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t('Soil trend (daily average, all zones)', 'اتجاه التربة (متوسط يومي لكل المناطق)')} className="lg:col-span-2">
          {series.data?.series.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.data.series.map((s) => ({ ...s, day: date(s.day) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" fontSize={11} reversed={lang === 'ar'} />
                <YAxis yAxisId="l" fontSize={11} orientation={lang === 'ar' ? 'right' : 'left'} />
                <YAxis yAxisId="r" fontSize={11} orientation={lang === 'ar' ? 'left' : 'right'} />
                <Tooltip />
                <Line yAxisId="l" type="monotone" dataKey="moisture" name={t('Moisture %', 'الرطوبة %')} stroke="#0284c7" dot={false} connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="ph" name="pH" stroke="#ca8a04" dot={false} connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="ec" name="EC" stroke="#9333ea" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty title={t('No measurement history', 'لا يوجد سجل قياسات')} />}
        </Card>
        <Card title={t('Robots', 'الروبوتات')} actions={<Link to="/app/robot" className="text-sm text-brand-700 hover:underline">{t('Manage', 'إدارة')}</Link>}>
          {data.robots.length ? (
            <ul className="space-y-3">
              {data.robots.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Bot size={18} className="text-slate-500" /><div><div className="text-sm font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.lastDataAt ? date(r.lastDataAt, true) : t('No data received', 'لم تصل بيانات')}{r.batteryPct != null ? ` · ${num(r.batteryPct, 0)}%` : ''}</div></div></div>
                  <Badge tone={r.status === 'sending_data' || r.status === 'connected' ? 'green' : r.status === 'error' ? 'red' : 'slate'}>{ROBOT_LABEL[r.status]?.[lang]}</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty title={t('No robot linked', 'لا يوجد روبوت مرتبط')} action={<Link to="/app/robot" className="btn-secondary">{t('Add robot', 'إضافة روبوت')}</Link>} />}
        </Card>
        <Card title={t('Top recommended crops', 'أفضل المحاصيل الموصى بها')} actions={<Link to="/app/crops" className="text-sm text-brand-700 hover:underline">{t('Details', 'التفاصيل')}</Link>}>
          {data.cropRecommendations.length ? (
            <ul className="space-y-2">
              {data.cropRecommendations.map((c) => (
                <li key={c.key} className="flex items-center justify-between text-sm"><span className="font-medium">{lang === 'ar' ? c.nameAr : c.nameEn}</span><span className="text-slate-500">{t(`best in ${c.zones} zones · avg ${num(c.avgScore, 0)}%`, `الأفضل في ${c.zones} منطقة · متوسط ${num(c.avgScore, 0)}%`)}</span></li>
              ))}
            </ul>
          ) : <Empty title={t('Needs soil measurements', 'تحتاج قياسات تربة')} />}
        </Card>
        <Card title={t('Irrigation status (zones)', 'حالة الري (المناطق)')} actions={<Link to="/app/irrigation" className="text-sm text-brand-700 hover:underline">{t('Details', 'التفاصيل')}</Link>}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={irrData} layout="vertical">
              <XAxis type="number" fontSize={11} allowDecimals={false} reversed={lang === 'ar'} />
              <YAxis type="category" dataKey="name" width={130} fontSize={11} orientation={lang === 'ar' ? 'right' : 'left'} />
              <Tooltip />
              <Bar dataKey="zones" fill="#15803d" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={t('Weather', 'الطقس')} actions={<Link to="/app/weather" className="text-sm text-brand-700 hover:underline">{t('Details', 'التفاصيل')}</Link>}>
          {data.weather ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">{t('Max / min', 'العظمى / الصغرى')}</dt><dd className="font-medium">{num(data.weather.latest.t2mMax)} / {num(data.weather.latest.t2mMin)} °C</dd></div>
              <div><dt className="text-slate-500">{t('Humidity', 'الرطوبة')}</dt><dd className="font-medium">{num(data.weather.latest.rh2m, 0)}%</dd></div>
              <div><dt className="text-slate-500">{t('Rain (30 d)', 'الأمطار (30 يوم)')}</dt><dd className="font-medium">{num(data.weather.mean30.precipTotal)} mm</dd></div>
              <div><dt className="text-slate-500">ET₀ (7 d)</dt><dd className="font-medium">{num(data.weather.et0Mean7, 2)} mm/d</dd></div>
              <div className="col-span-2 text-xs text-slate-500">{t('Data day', 'يوم البيانات')}: {date(data.weather.latestDate)} · {t('fetched', 'جُلبت')} {date(data.weather.lastFetchedAt, true)}</div>
            </dl>
          ) : <Empty title={t('Weather not available', 'الطقس غير متاح')} />}
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
