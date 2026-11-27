import { useState } from 'react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, DemoBanner, Empty, PageHeader, Spinner, Table } from '../components/ui';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import type { Farm } from '../lib/farm';
import type { Crop, CropScore } from '../lib/types';

function Content({ farm }: { farm: Farm }) {
  const { t, lt, num, lang } = useI18n();
  const recs = useApi<{ zones: { zoneId: string; code: string; recommendations: CropScore[] }[]; totalZones: number; airTemp30: number | null; waterAvailability: string | null }>(`/farms/${farm.id}/crop-recommendations`);
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const [zone, setZone] = useState<string>('');
  if (recs.loading) return <Spinner />;
  const zones = recs.data?.zones ?? [];
  const current = zones.find((z) => z.zoneId === zone) ?? zones[0];
  const factorName: Record<string, string> = { ph: 'pH', temperature: t('Temperature', 'الحرارة'), moisture: t('Moisture', 'الرطوبة'), salinity: t('Salinity', 'الملوحة'), water: t('Water availability', 'توفر المياه') };
  return (
    <div className="space-y-5">
      <PageHeader title={t('Crop recommendation', 'توصية المحاصيل')} subtitle={t('Weighted suitability: pH 25%, temperature 25%, moisture 20%, salinity (Maas–Hoffman) 20%, water availability 10%. Missing factors are excluded and lower data coverage.', 'الملاءمة المرجحة: الحموضة 25%، الحرارة 25%، الرطوبة 20%، الملوحة (ماس-هوفمان) 20%، توفر المياه 10%. العوامل المفقودة تُستبعد وتقلل تغطية البيانات.')} />
      <DemoBanner show={farm.isDemo} />
      {!zones.length ? <Empty title={t('No measured zones yet', 'لا توجد مناطق مقاسة بعد')}>{t('Recommendations are produced only for zones with real measurements.', 'تُنتج التوصيات فقط للمناطق التي لديها قياسات حقيقية.')}</Empty> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[200px]" value={current?.zoneId} onChange={(e) => setZone(e.target.value)}>{zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{t('Zone', 'المنطقة')} {z.code}</option>)}</select>
            <span className="text-sm text-slate-500">{t(`${zones.length} of ${recs.data?.totalZones} zones measured`, `${zones.length} من ${recs.data?.totalZones} منطقة مقاسة`)} · {t('Air temp. (30 d)', 'حرارة الهواء (30 يوم)')}: {num(recs.data?.airTemp30)} °C</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {current?.recommendations.map((c, i) => (
              <Card key={c.cropKey} title={<span>{i + 1}. {lang === 'ar' ? c.nameAr : c.nameEn}</span>} actions={<Badge tone={c.suitability >= 70 ? 'green' : c.suitability >= 45 ? 'amber' : 'red'}>{c.suitability}%</Badge>}>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3 text-xs text-slate-500"><span>{t('Soil', 'التربة')}: {num(c.soilCompatibility, 0)}%</span><span>{t('Climate', 'المناخ')}: {num(c.climateCompatibility, 0)}%</span><span>{t('Data coverage', 'تغطية البيانات')}: {c.dataCoverage}%</span></div>
                  <ul className="space-y-1.5">
                    {c.components.map((x) => (
                      <li key={x.factor}>
                        <div className="flex justify-between text-xs"><span>{factorName[x.factor]} ({x.weight * 100}%)</span><span>{x.score == null ? t('no data', 'لا بيانات') : `${Math.round(x.score * 100)}%`}</span></div>
                        <div className="h-1.5 rounded bg-slate-200"><div className="h-1.5 rounded bg-brand-600" style={{ width: `${(x.score ?? 0) * 100}%` }} /></div>
                        <div className="text-[11px] text-slate-500">{lt(x.detail)}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs"><b>{t('Water need', 'الاحتياج المائي')}:</b> {c.waterRequirementsMm} mm/{t('season', 'موسم')}</div>
                  {c.limitations.length > 0 && <div><b className="text-xs">{t('Limitations', 'القيود')}</b><ul className="list-disc ps-5 text-xs text-red-700">{c.limitations.map((l, j) => <li key={j}>{lt(l)}</li>)}</ul></div>}
                  {c.actions.length > 0 && <div><b className="text-xs">{t('Suggested actions', 'إجراءات مقترحة')}</b><ul className="list-disc ps-5 text-xs">{c.actions.map((l, j) => <li key={j}>{lt(l)}</li>)}</ul></div>}
                  <p className="text-xs italic text-slate-500">{lt(c.why)}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      <Card title={t('Crop reference ranges', 'المدى المرجعي للمحاصيل')}>
        <Table head={[t('Crop', 'المحصول'), t('pH optimum', 'pH الأمثل'), t('Temp. optimum °C', 'الحرارة المثلى'), t('Moisture optimum %', 'الرطوبة المثلى'), t('EC threshold dS/m', 'حد الملوحة'), t('Water mm/season', 'المياه مم/موسم'), t('Season', 'الموسم')]}>
          {crops.data?.crops.map((c) => <tr key={c.key}><td className="font-medium">{lang === 'ar' ? c.nameAr : c.nameEn}</td><td>{c.phOptMin}–{c.phOptMax}</td><td>{c.tempOptMin}–{c.tempOptMax}</td><td>{c.moistureOptMin}–{c.moistureOptMax}</td><td>{c.ecThreshold}</td><td>{c.waterNeedMm}</td><td>{lang === 'ar' ? c.seasonAr : c.seasonEn}</td></tr>)}
        </Table>
        <p className="mt-2 text-xs text-slate-500">{crops.data?.crops[0]?.references}</p>
      </Card>
      <Alert>{t('Suitability is decision support. Confirm with local variety recommendations and a soil laboratory before planting.', 'الملاءمة للدعم في القرار. تأكد من توصيات الأصناف المحلية ومعمل التربة قبل الزراعة.')}</Alert>
    </div>
  );
}

export default function Crops() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
