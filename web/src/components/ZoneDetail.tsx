import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { IRR_LABEL, STAGES, STATUS_LABEL } from '../lib/labels';
import type { Crop, CropScore, IrrigationAdvice, ZoneDecision, ZoneReadings } from '../lib/types';
import { Badge, Empty, IRR_TONE, SourceBadge, Spinner, STATUS_TONE } from './ui';
import { IssueCard } from './IssueCard';

interface ZoneDetailData {
  zone: { id: string; code: string; areaM2: number; cropKey: string | null; growthStage: string | null; centroidLat: number; centroidLng: number };
  readings: ZoneReadings; recommendations: CropScore[]; irrigation: IrrigationAdvice; decision: ZoneDecision; crop: Crop | null;
  history: { id: string; source: string; measuredAt: string; moisture: number | null; ph: number | null; ec: number | null; temperature: number | null; device: { name: string } | null }[];
  nutrients: { lab: { nitrogenPpm: number | null; phosphorusPpm: number | null; potassiumPpm: number | null; measuredAt: string } | null; imageFindings: { nutrient: string; confidence: number | null }[] };
}

export function ZoneDetail({ zoneId, onClose, onChanged }: { zoneId: string; onClose: () => void; onChanged: () => void }) {
  const { t, lt, num, date, lang } = useI18n();
  const { data, loading, error, reload } = useApi<ZoneDetailData>(`/zones/${zoneId}`);
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const [saving, setSaving] = useState(false);
  const update = async (patch: { cropKey?: string | null; growthStage?: string | null }) => {
    setSaving(true);
    await api.patch(`/zones/${zoneId}`, patch);
    setSaving(false);
    reload();
    onChanged();
  };
  return (
    <div className="card max-h-[80vh] overflow-y-auto p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('Zone', 'المنطقة')} {data?.zone.code}</h2>
        <button className="btn-ghost p-1.5" onClick={onClose}><X size={18} /></button>
      </div>
      {loading && <Spinner />}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {data && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[data.decision.status]}>{lt(STATUS_LABEL[data.decision.status])}</Badge>
            <Badge tone={IRR_TONE[data.irrigation.status as keyof typeof IRR_TONE] ?? 'slate'}>{lt(IRR_LABEL[data.irrigation.status])}</Badge>
            <span className="text-xs text-slate-500">{num(data.zone.areaM2, 0)} m² · {data.zone.centroidLat.toFixed(5)}, {data.zone.centroidLng.toFixed(5)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" disabled={saving} value={data.zone.cropKey ?? ''} onChange={(e) => update({ cropKey: e.target.value || null })}>
              <option value="">{t('Crop: farm default', 'المحصول: الافتراضي للمزرعة')}</option>
              {crops.data?.crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}
            </select>
            <select className="input" disabled={saving} value={data.zone.growthStage ?? ''} onChange={(e) => update({ growthStage: e.target.value || null })}>
              <option value="">{t('Growth stage: unknown', 'مرحلة النمو: غير معروفة')}</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{lt(s.label)}</option>)}
            </select>
          </div>
          {!data.readings.lastAt ? (
            <Empty title={t('No Measurement Available', 'لا توجد قياسات متاحة')}>{t('This zone has not been measured yet. Nothing is estimated from neighbouring zones.', 'لم يتم قياس هذه المنطقة بعد. لا يتم تقدير أي قيمة من المناطق المجاورة.')}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {([['moisture', t('Moisture', 'الرطوبة'), '%'], ['ph', 'pH', ''], ['ec', 'EC', 'dS/m'], ['temperature', t('Soil temp.', 'حرارة التربة'), '°C']] as const).map(([k, label, unit]) => {
                const r = data.readings[k];
                return (
                  <div key={k} className="rounded-lg border border-slate-200 p-2">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-lg font-semibold">{r ? `${num(r.value, 2)} ${unit}` : '—'}</div>
                    {r && <div className="flex items-center gap-1 text-[11px] text-slate-500"><SourceBadge source={r.source} />{date(r.at, true)}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {data.nutrients.lab && (
            <div className="rounded-lg bg-violet-50 p-3">
              <div className="font-medium text-violet-900">{t('Latest lab test', 'آخر تحليل معملي')} · {date(data.nutrients.lab.measuredAt)}</div>
              <div>N {num(data.nutrients.lab.nitrogenPpm)} · P {num(data.nutrients.lab.phosphorusPpm)} · K {num(data.nutrients.lab.potassiumPpm)} ppm</div>
            </div>
          )}
          {data.decision.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">{t('Recommended actions', 'الإجراءات الموصى بها')}</h3>
              {data.decision.issues.map((i) => <IssueCard key={i.id} issue={i} />)}
            </div>
          )}
          {data.recommendations.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">{t('Crop suitability', 'ملاءمة المحاصيل')}</h3>
              <ul className="space-y-1">
                {data.recommendations.map((c) => (
                  <li key={c.cropKey} className="flex items-center justify-between"><span>{lang === 'ar' ? c.nameAr : c.nameEn}</span><span className="text-slate-500">{c.suitability}% · {t('data', 'البيانات')} {c.dataCoverage}%</span></li>
                ))}
              </ul>
              <Link to="/app/crops" className="text-xs text-brand-700 hover:underline">{t('See explanation', 'عرض التفسير')}</Link>
            </div>
          )}
          <div>
            <h3 className="mb-2 font-semibold">{t('Irrigation', 'الري')}</h3>
            <ul className="list-disc space-y-1 ps-5 text-slate-600">{data.irrigation.reasons.map((r, i) => <li key={i}>{lt(r)}</li>)}</ul>
          </div>
          {data.history.length > 1 && (
            <div>
              <h3 className="mb-2 font-semibold">{t('History', 'السجل')}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={[...data.history].reverse().map((h) => ({ ...h, at: date(h.measuredAt) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="at" fontSize={10} reversed={lang === 'ar'} />
                  <YAxis fontSize={10} orientation={lang === 'ar' ? 'right' : 'left'} />
                  <Tooltip />
                  <Line dataKey="moisture" name={t('Moisture', 'الرطوبة')} stroke="#0284c7" dot connectNulls />
                  <Line dataKey="ec" name="EC" stroke="#9333ea" dot connectNulls />
                  <Line dataKey="ph" name="pH" stroke="#ca8a04" dot connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <Link to={`/app/manual?zone=${data.zone.id}`} className="btn-secondary w-full">{t('Add measurement for this zone', 'إضافة قياس لهذه المنطقة')}</Link>
        </div>
      )}
    </div>
  );
}
