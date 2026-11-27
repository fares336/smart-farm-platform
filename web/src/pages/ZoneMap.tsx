import { useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { RequireFarm } from '../components/Layout';
import { DemoBanner, ErrorBox, PageHeader, Spinner } from '../components/ui';
import { ZoneDetail } from '../components/ZoneDetail';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { IRR_LABEL, STATUS_LABEL } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { Zone } from '../lib/types';

type Layer = 'status' | 'moisture' | 'ph' | 'ec' | 'irrigation';

const NO_DATA = '#cbd5e1';
function ramp(v: number, stops: [number, string][]) {
  for (let i = stops.length - 1; i >= 0; i--) if (v >= stops[i][0]) return stops[i][1];
  return stops[0][1];
}
const COLORS: Record<Layer, (z: Zone) => string> = {
  status: (z) => ({ good: '#16a34a', attention: '#f59e0b', critical: '#dc2626', no_data: NO_DATA })[z.status],
  moisture: (z) => (z.readings.moisture ? ramp(z.readings.moisture.value, [[0, '#b45309'], [15, '#f59e0b'], [22, '#a3e635'], [30, '#22c55e'], [40, '#0ea5e9'], [55, '#1d4ed8']]) : NO_DATA),
  ph: (z) => (z.readings.ph ? ramp(z.readings.ph.value, [[0, '#dc2626'], [5.5, '#f59e0b'], [6, '#16a34a'], [7.5, '#a3e635'], [8, '#f59e0b'], [8.5, '#7c3aed']]) : NO_DATA),
  ec: (z) => (z.readings.ec ? ramp(z.readings.ec.value, [[0, '#16a34a'], [2, '#a3e635'], [4, '#f59e0b'], [8, '#ea580c'], [12, '#dc2626']]) : NO_DATA),
  irrigation: (z) => ({ urgent: '#dc2626', irrigate: '#f59e0b', ok: '#16a34a', too_wet: '#0ea5e9', no_data: NO_DATA } as Record<string, string>)[z.irrigationStatus] ?? NO_DATA,
};

function Content({ farm }: { farm: Farm }) {
  const { t, lt, num } = useI18n();
  const { data, loading, error, reload } = useApi<{ zones: Zone[]; boundary: GeoJSON.Polygon | null }>(`/farms/${farm.id}/zones`);
  const [layer, setLayer] = useState<Layer>('status');
  const [view, setView] = useState<'map' | 'grid'>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const fc = useMemo(() => (data ? { type: 'FeatureCollection' as const, features: data.zones.map((z) => ({ type: 'Feature' as const, geometry: z.polygon, properties: z })) } : null), [data]);
  if (loading && !data) return <Spinner />;
  if (error || !data || !fc) return <ErrorBox error={error} />;
  const measured = data.zones.filter((z) => z.readings.lastAt).length;
  const tip = (z: Zone) => {
    const r = z.readings;
    if (!r.lastAt) return `<b>${z.code}</b><br/>${t('No Measurement Available', 'لا توجد قياسات متاحة')}`;
    return `<b>${z.code}</b> — ${lt(STATUS_LABEL[z.status])}<br/>${t('Moisture', 'الرطوبة')}: ${num(r.moisture?.value)}% · pH ${num(r.ph?.value, 2)} · EC ${num(r.ec?.value, 2)}<br/>${lt(IRR_LABEL[z.irrigationStatus])}${z.topCrop ? `<br/>${t('Top crop', 'أفضل محصول')}: ${t(z.topCrop.nameEn, z.topCrop.nameAr)} (${z.topCrop.suitability}%)` : ''}`;
  };
  const layers: { key: Layer; label: string }[] = [
    { key: 'status', label: t('Status', 'الحالة') }, { key: 'moisture', label: t('Moisture', 'الرطوبة') }, { key: 'ph', label: 'pH' }, { key: 'ec', label: t('Salinity (EC)', 'الملوحة EC') }, { key: 'irrigation', label: t('Irrigation', 'الري') },
  ];
  const center: [number, number] = [farm.latitude, farm.longitude];
  return (
    <div className="space-y-4">
      <PageHeader title={t('Zone map', 'خريطة المناطق')} subtitle={t(`${measured} of ${data.zones.length} zones have measurements. Grey = No Measurement Available.`, `${measured} من ${data.zones.length} منطقة لديها قياسات. الرمادي = لا توجد قياسات.`)} actions={<>
        {layers.map((l) => <button key={l.key} className={layer === l.key ? 'btn-primary px-3 py-1.5' : 'btn-secondary px-3 py-1.5'} onClick={() => setLayer(l.key)}>{l.label}</button>)}
        <button className="btn-ghost px-3 py-1.5" onClick={() => setView(view === 'map' ? 'grid' : 'map')}>{view === 'map' ? t('Grid view', 'عرض الشبكة') : t('Map view', 'عرض الخريطة')}</button>
      </>} />
      <DemoBanner show={farm.isDemo} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={selected ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {view === 'map' ? (
            <MapContainer key={`${farm.id}`} bounds={L.geoJSON(fc).getBounds()} style={{ height: 620 }} scrollWheelZoom>
              <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
              <GeoJSON
                key={`${layer}-${data.zones.map((z) => z.status + z.readings.lastAt).join('').length}-${selected}`}
                data={fc}
                style={(f) => {
                  const z = f!.properties as Zone;
                  return { color: z.id === selected ? '#facc15' : '#ffffff', weight: z.id === selected ? 3 : 0.6, fillColor: COLORS[layer](z), fillOpacity: z.readings.lastAt ? 0.7 : 0.35 };
                }}
                onEachFeature={(f, l) => {
                  const z = f.properties as Zone;
                  l.bindTooltip(tip(z), { sticky: true });
                  l.on('click', () => setSelected(z.id));
                }}
              />
            </MapContainer>
          ) : (
            <div className="card overflow-x-auto p-3">
              <div className="grid min-w-[640px] gap-0.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))', direction: 'ltr' }}>
                {data.zones.map((z) => (
                  <button key={z.id} onClick={() => setSelected(z.id)} title={tip(z).replace(/<[^>]+>/g, ' ')} className={`aspect-square rounded text-[9px] font-medium text-slate-900/80 ${z.id === selected ? 'ring-2 ring-yellow-400' : ''}`} style={{ background: COLORS[layer](z) }}>{z.code}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: NO_DATA }} />{t('No Measurement Available', 'لا توجد قياسات متاحة')}</span>
            {layer === 'status' && Object.entries({ good: '#16a34a', attention: '#f59e0b', critical: '#dc2626' }).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: c }} />{lt(STATUS_LABEL[k])}</span>)}
            <span>{t('Center', 'المركز')}: {center[0].toFixed(4)}, {center[1].toFixed(4)}</span>
          </div>
        </div>
        {selected && <ZoneDetail zoneId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
      </div>
    </div>
  );
}

export default function ZoneMap() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
