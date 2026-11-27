import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useFarm, type Farm } from '../lib/farm';
import { useApi } from '../lib/useApi';
import type { Crop } from '../lib/types';
import { Alert, Badge, Card, ErrorBox, Field, PageHeader } from '../components/ui';
import { MapPicker, type LatLng } from '../components/MapPicker';

type Mode = 'area' | 'boundary';

function FarmForm({ initial, onDone, onCancel }: { initial?: Farm; onDone: (f: Farm) => void; onCancel: () => void }) {
  const { t, lang } = useI18n();
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const [f, setF] = useState({
    name: initial?.name ?? '', locationName: initial?.locationName ?? '', latitude: initial?.latitude ?? 30.0444, longitude: initial?.longitude ?? 31.2357,
    areaHectares: initial?.areaHectares ? String(initial.areaHectares) : '', waterSource: initial?.waterSource ?? '', waterAvailability: initial?.waterAvailability ?? '',
    soilTexture: initial?.soilTexture ?? '', defaultCropKey: initial?.defaultCropKey ?? '',
  });
  const [mode, setMode] = useState<Mode>('area');
  const [pts, setPts] = useState<LatLng[]>([]);
  const [areaUnit, setAreaUnit] = useState<'ha' | 'feddan'>('feddan');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onMapClick = (p: LatLng) => {
    if (mode === 'boundary') setPts((x) => [...x, p]);
    else setF((x) => ({ ...x, latitude: +p[0].toFixed(6), longitude: +p[1].toFixed(6) }));
  };
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition((pos) => setF((x) => ({ ...x, latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) })));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = {
      name: f.name, locationName: f.locationName || null, latitude: Number(f.latitude), longitude: Number(f.longitude),
      waterSource: f.waterSource || null, waterAvailability: f.waterAvailability || null, soilTexture: f.soilTexture || null, defaultCropKey: f.defaultCropKey || null,
    };
    if (mode === 'boundary') {
      if (pts.length < 3) return setError(t('Click at least 3 boundary points on the map', 'اضغط على 3 نقاط حدود على الأقل في الخريطة'));
      const ring = pts.map(([la, ln]) => [ln, la]);
      ring.push(ring[0]);
      body.boundary = { type: 'Polygon', coordinates: [ring] };
      const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      body.latitude = +c[0].toFixed(6);
      body.longitude = +c[1].toFixed(6);
    } else if (!initial || f.areaHectares !== String(initial.areaHectares)) {
      const a = Number(f.areaHectares);
      if (!a || a <= 0) return setError(t('Enter the farm area', 'أدخل مساحة المزرعة'));
      body.areaHectares = areaUnit === 'feddan' ? +(a * 0.42).toFixed(4) : a;
    }
    setBusy(true);
    try {
      const r = initial ? await api.patch<{ farm: Farm }>(`/farms/${initial.id}`, body) : await api.post<{ farm: Farm }>('/farms', body);
      onDone(r.farm);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={initial ? t('Edit farm', 'تعديل المزرعة') : t('Register a new farm', 'تسجيل مزرعة جديدة')}>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <ErrorBox error={error} />
          <Field label={t('Farm name', 'اسم المزرعة')}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={t('Location (village / governorate)', 'الموقع (القرية / المحافظة)')}><input className="input" value={f.locationName} onChange={(e) => setF({ ...f, locationName: e.target.value })} /></Field>
          <div className="flex gap-2">
            <button type="button" className={mode === 'area' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('area')}>{t('Point + area', 'نقطة + مساحة')}</button>
            <button type="button" className={mode === 'boundary' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('boundary')}>{t('Draw boundary', 'رسم الحدود')}</button>
          </div>
          {mode === 'area' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Latitude', 'خط العرض')}><input className="input" type="number" step="any" required value={f.latitude} onChange={(e) => setF({ ...f, latitude: Number(e.target.value) })} /></Field>
                <Field label={t('Longitude', 'خط الطول')}><input className="input" type="number" step="any" required value={f.longitude} onChange={(e) => setF({ ...f, longitude: Number(e.target.value) })} /></Field>
              </div>
              <button type="button" className="btn-ghost px-0 text-brand-700" onClick={useMyLocation}>{t('Use my current location', 'استخدم موقعي الحالي')}</button>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Field label={t('Area', 'المساحة')}><input className="input" type="number" step="any" min="0" value={f.areaHectares} onChange={(e) => setF({ ...f, areaHectares: e.target.value })} required={!initial} /></Field></div>
                <Field label={t('Unit', 'الوحدة')}><select className="input" value={areaUnit} onChange={(e) => setAreaUnit(e.target.value as 'ha' | 'feddan')}><option value="feddan">{t('feddan', 'فدان')}</option><option value="ha">{t('hectare', 'هكتار')}</option></select></Field>
              </div>
              <p className="text-xs text-slate-500">{t('Without a drawn boundary a square of this area is centred on the point. Draw the boundary for accurate zones.', 'بدون رسم الحدود يتم إنشاء مربع بهذه المساحة حول النقطة. ارسم الحدود للحصول على مناطق دقيقة.')}</p>
            </>
          ) : (
            <Alert>{t(`Click the farm corners on the map in order (${pts.length} points). Area is calculated from the boundary.`, `اضغط على أركان المزرعة في الخريطة بالترتيب (${pts.length} نقاط). تُحسب المساحة من الحدود.`)} {pts.length > 0 && <button type="button" className="underline" onClick={() => setPts([])}>{t('Clear', 'مسح')}</button>}</Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Water source', 'مصدر المياه')}><input className="input" placeholder={t('Canal, well…', 'ترعة، بئر…')} value={f.waterSource} onChange={(e) => setF({ ...f, waterSource: e.target.value })} /></Field>
            <Field label={t('Water availability', 'توفر المياه')}><select className="input" value={f.waterAvailability} onChange={(e) => setF({ ...f, waterAvailability: e.target.value })}><option value="">—</option><option value="low">{t('Low', 'منخفض')}</option><option value="medium">{t('Medium', 'متوسط')}</option><option value="high">{t('High', 'مرتفع')}</option></select></Field>
            <Field label={t('Soil texture', 'قوام التربة')}><select className="input" value={f.soilTexture} onChange={(e) => setF({ ...f, soilTexture: e.target.value })}><option value="">—</option><option value="sandy">{t('Sandy', 'رملية')}</option><option value="loam">{t('Loam', 'طميية')}</option><option value="clay">{t('Clay', 'طينية')}</option><option value="calcareous">{t('Calcareous', 'جيرية')}</option></select></Field>
            <Field label={t('Main crop', 'المحصول الرئيسي')}><select className="input" value={f.defaultCropKey} onChange={(e) => setF({ ...f, defaultCropKey: e.target.value })}><option value="">—</option>{crops.data?.crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? t('Saving…', 'جارٍ الحفظ…') : t('Save farm', 'حفظ المزرعة')}</button>
            <button type="button" className="btn-secondary" onClick={onCancel}>{t('Cancel', 'إلغاء')}</button>
          </div>
        </div>
        <MapPicker center={[Number(f.latitude) || 30, Number(f.longitude) || 31]} marker={mode === 'area' ? [Number(f.latitude), Number(f.longitude)] : null} boundary={pts} onClick={onMapClick} height={480} />
      </form>
    </Card>
  );
}

export default function Farms() {
  const { t, num, date } = useI18n();
  const { farms, reload, select, farm: current } = useFarm();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Farm | 'new' | null>(params.get('new') ? 'new' : null);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  useEffect(() => { if (params.get('new')) setEditing('new'); }, [params]);

  const done = async (f: Farm) => {
    await reload();
    select(f.id);
    setEditing(null);
    setParams({});
    nav('/app/map');
  };
  const remove = async (f: Farm) => {
    if (!confirm(t(`Delete "${f.name}" and all of its data? This cannot be undone.`, `حذف "${f.name}" وكل بياناتها؟ لا يمكن التراجع.`))) return;
    await api.del(`/farms/${f.id}`);
    await reload();
  };
  const demo = async () => {
    setError(null);
    try {
      const r = await api.post<{ farm: Farm }>('/demo/farm');
      await done(r.farm);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('Farms', 'المزارع')} subtitle={t('Each farm is private to your account and divided into 256 zones.', 'كل مزرعة خاصة بحسابك ومقسمة إلى 256 منطقة.')} actions={!editing && <>
        <button className="btn-secondary" onClick={demo}><Sparkles size={16} />{t('Create demo farm', 'إنشاء مزرعة تجريبية')}</button>
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} />{t('Add farm', 'إضافة مزرعة')}</button>
      </>} />
      <ErrorBox error={error} />
      {editing && <FarmForm initial={editing === 'new' ? undefined : editing} onDone={done} onCancel={() => { setEditing(null); setParams({}); }} />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {farms.map((f) => (
          <div key={f.id} className={`card p-5 ${current?.id === f.id ? 'ring-2 ring-brand-600' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{f.name} {f.isDemo && <Badge tone="amber">{t('Demo', 'تجريبية')}</Badge>}</h3>
                <p className="text-sm text-slate-500">{f.locationName ?? '—'}</p>
              </div>
              <div className="flex">
                <button className="btn-ghost p-2" onClick={() => setEditing(f)} title={t('Edit', 'تعديل')}><Pencil size={16} /></button>
                <button className="btn-ghost p-2 text-red-600" onClick={() => remove(f)} title={t('Delete', 'حذف')}><Trash2 size={16} /></button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-500">{t('Area', 'المساحة')}</dt><dd>{num(f.areaHectares, 2)} {t('ha', 'هكتار')} ({num(f.areaHectares * 2.381, 1)} {t('fed.', 'فدان')})</dd></div>
              <div><dt className="text-slate-500">{t('Created', 'تاريخ الإنشاء')}</dt><dd>{date(f.createdAt)}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">{t('Coordinates', 'الإحداثيات')}</dt><dd className="font-mono text-xs">{f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}</dd></div>
            </dl>
            <button className="btn-secondary mt-4 w-full" onClick={() => { select(f.id); nav('/app'); }}>{t('Open', 'فتح')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
