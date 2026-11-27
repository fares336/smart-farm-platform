import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Trash2 } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Card, DemoBanner, Empty, PageHeader, SourceBadge, Spinner, Table } from '../components/ui';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import type { Farm } from '../lib/farm';
import type { Zone } from '../lib/types';

interface M { id: string; source: string; measuredAt: string; moisture: number | null; ph: number | null; ec: number | null; temperature: number | null; nitrogenPpm: number | null; phosphorusPpm: number | null; potassiumPpm: number | null; zone: { code: string }; device: { name: string } | null; isDemo: boolean; notes: string | null }

function Content({ farm }: { farm: Farm }) {
  const { t, num, date, lang } = useI18n();
  const [zoneId, setZoneId] = useState('');
  const [source, setSource] = useState('');
  const [days, setDays] = useState(90);
  const zones = useApi<{ zones: Zone[] }>(`/farms/${farm.id}/zones`);
  const list = useApi<{ items: M[] }>(`/farms/${farm.id}/measurements${qs({ zoneId, source, limit: 300 })}`);
  const series = useApi<{ series: { day: string; moisture: number | null; ph: number | null; ec: number | null; temperature: number | null }[] }>(`/farms/${farm.id}/measurements/timeseries${qs({ zoneId, days })}`);
  const del = async (id: string) => {
    if (!confirm(t('Delete this measurement?', 'حذف هذا القياس؟'))) return;
    await api.del(`/farms/${farm.id}/measurements/${id}`);
    list.reload();
    series.reload();
  };
  const chartData = series.data?.series.map((s) => ({ ...s, day: date(s.day) })) ?? [];
  const chart = (key: 'moisture' | 'ph' | 'ec' | 'temperature', label: string, color: string) => (
    <Card title={label}>
      {chartData.some((d) => d[key] != null) ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" fontSize={10} reversed={lang === 'ar'} />
            <YAxis fontSize={10} orientation={lang === 'ar' ? 'right' : 'left'} domain={['auto', 'auto']} />
            <Tooltip />
            <Line dataKey={key} name={label} stroke={color} dot={chartData.length < 30} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      ) : <Empty title={t('No data', 'لا توجد بيانات')} />}
    </Card>
  );
  return (
    <div className="space-y-5">
      <PageHeader title={t('Soil monitoring', 'مراقبة التربة')} subtitle={t('Daily averages and every individual reading, with its source.', 'المتوسطات اليومية وكل قراءة فردية مع مصدرها.')} actions={<a className="btn-secondary" href={`/api/reports/farms/${farm.id}/measurements.csv`}><Download size={16} />CSV</a>} />
      <DemoBanner show={farm.isDemo} />
      <div className="card flex flex-wrap gap-3 p-4">
        <select className="input max-w-[180px]" value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">{t('All zones', 'كل المناطق')}</option>{zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.code}{z.readings.lastAt ? '' : ` (${t('no data', 'لا بيانات')})`}</option>)}</select>
        <select className="input max-w-[180px]" value={source} onChange={(e) => setSource(e.target.value)}><option value="">{t('All sources', 'كل المصادر')}</option><option value="ROBOT">{t('Robot', 'روبوت')}</option><option value="MANUAL">{t('Manual', 'يدوي')}</option><option value="LAB">{t('Laboratory', 'معمل')}</option></select>
        <select className="input max-w-[180px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>{t(`Last ${d} days`, `آخر ${d} يوم`)}</option>)}</select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {chart('moisture', t('Moisture (%)', 'الرطوبة (%)'), '#0284c7')}
        {chart('ph', 'pH', '#ca8a04')}
        {chart('ec', t('EC (dS/m)', 'الملوحة EC (dS/m)'), '#9333ea')}
        {chart('temperature', t('Soil temperature (°C)', 'حرارة التربة (°C)'), '#dc2626')}
      </div>
      <Card title={t('Readings', 'القراءات')}>
        {list.loading ? <Spinner /> : list.data?.items.length ? (
          <Table head={[t('Zone', 'المنطقة'), t('Source', 'المصدر'), t('Measured at', 'وقت القياس'), t('Moisture %', 'الرطوبة %'), 'pH', 'EC', t('Temp °C', 'الحرارة'), 'N/P/K ppm', '']}>
            {list.data.items.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.zone.code}</td>
                <td><SourceBadge source={m.source} /> {m.device && <span className="text-xs text-slate-500">{m.device.name}</span>}</td>
                <td>{date(m.measuredAt, true)}</td>
                <td>{num(m.moisture)}</td><td>{num(m.ph, 2)}</td><td>{num(m.ec, 2)}</td><td>{num(m.temperature)}</td>
                <td>{m.nitrogenPpm != null || m.phosphorusPpm != null || m.potassiumPpm != null ? `${num(m.nitrogenPpm)} / ${num(m.phosphorusPpm)} / ${num(m.potassiumPpm)}` : '—'}</td>
                <td><button className="btn-ghost p-1 text-red-600" onClick={() => del(m.id)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </Table>
        ) : <Empty title={t('No measurements yet', 'لا توجد قياسات بعد')} />}
      </Card>
    </div>
  );
}

export default function Soil() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
