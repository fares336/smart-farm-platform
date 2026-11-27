import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Bot, Copy, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, Empty, ErrorBox, PageHeader, SourceBadge, Spinner, Table } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { ROBOT_LABEL } from '../lib/labels';
import type { Farm } from '../lib/farm';

interface Device { id: string; name: string; deviceUid: string; apiKeyPrefix: string; status: string; lastSeenAt: string | null; lastDataAt: string | null; batteryPct: number | null; firmwareVersion: string | null; lastError: string | null; currentZone: { code: string } | null; createdAt: string }
interface DevicesResp { devices: Device[]; progress: { windowDays: number; measuredZones: string[]; measured: number; total: number }; ingestUrl: string }
interface Pairing { server: string; device_id: string; device_key: string }

function Content({ farm }: { farm: Farm }) {
  const { t, lt, num, date } = useI18n();
  const { data, loading, error, reload } = useApi<DevicesResp>(`/farms/${farm.id}/devices`);
  const [name, setName] = useState('');
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const history = useApi<{ measurements: { id: string; measuredAt: string; moisture: number | null; ph: number | null; ec: number | null; temperature: number | null; zone: { code: string } }[] }>(selected ? `/devices/${selected}` : null);

  const add = async () => {
    setErr(null);
    try {
      const r = await api.post<{ pairing: Pairing }>(`/farms/${farm.id}/devices`, { name: name || 'Robot' });
      setPairing(r.pairing);
      setName('');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const rotate = async (d: Device) => {
    if (!confirm(t('Generate a new key? The robot must be updated with the new key.', 'إنشاء مفتاح جديد؟ يجب تحديث الروبوت بالمفتاح الجديد.'))) return;
    setPairing((await api.post<{ pairing: Pairing }>(`/devices/${d.id}/rotate-key`)).pairing);
  };
  const remove = async (d: Device) => {
    if (!confirm(t('Remove this robot? Its past measurements are kept.', 'إزالة هذا الروبوت؟ ستبقى قياساته السابقة.'))) return;
    await api.del(`/devices/${d.id}`);
    reload();
  };
  const copy = (s: string) => navigator.clipboard?.writeText(s);
  if (loading) return <Spinner />;
  const p = data?.progress;
  const sample = pairing ? `curl -X POST ${data?.ingestUrl} \\\n  -H "Content-Type: application/json" \\\n  -H "X-Device-Id: ${pairing.device_id}" \\\n  -H "Authorization: Bearer ${pairing.device_key}" \\\n  -d '{"zone_id":"A1","moisture":24.5,"ph":7.6,"ec":2.1,"temperature":23.4,"message_id":"test-1"}'` : '';
  return (
    <div className="space-y-5">
      <PageHeader title={t('Robot (ESP32)', 'الروبوت (ESP32)')} subtitle={t('Each robot gets a unique device ID and secret key and sends readings over Wi-Fi (HTTPS) to this server.', 'يحصل كل روبوت على معرف فريد ومفتاح سري ويرسل القراءات عبر Wi-Fi (HTTPS) إلى هذا الخادم.')} />
      <ErrorBox error={error ?? err} />
      {p && (
        <Card title={t('Survey progress', 'تقدم المسح')}>
          <div className="mb-2 flex justify-between text-sm"><span>{t(`Zones measured by robot in the last ${p.windowDays} days`, `المناطق التي قاسها الروبوت في آخر ${p.windowDays} يوم`)}</span><span className="font-semibold">{p.measured} / {p.total} ({num((p.measured / p.total) * 100, 0)}%)</span></div>
          <div className="h-2.5 rounded-full bg-slate-200"><div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${(p.measured / p.total) * 100}%` }} /></div>
        </Card>
      )}
      <Card title={t('Link a new robot', 'ربط روبوت جديد')}>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder={t('Robot name', 'اسم الروبوت')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" onClick={add}><Plus size={16} />{t('Generate device ID & key', 'إنشاء معرف ومفتاح')}</button>
        </div>
        <ol className="mt-4 list-decimal space-y-1 ps-5 text-sm text-slate-600">
          <li>{t('Flash firmware/smartfarm_esp32/smartfarm_esp32.ino to the ESP32 using Arduino IDE (USB is only used for flashing and debugging).', 'ارفع البرنامج firmware/smartfarm_esp32/smartfarm_esp32.ino إلى ESP32 عبر Arduino IDE (يُستخدم USB للرفع والتصحيح فقط).')}</li>
          <li>{t('Set WIFI_SSID, WIFI_PASSWORD, SERVER_URL, DEVICE_ID and DEVICE_KEY in the sketch (or scan the QR code with your provisioning app).', 'اضبط WIFI_SSID و WIFI_PASSWORD و SERVER_URL و DEVICE_ID و DEVICE_KEY في البرنامج (أو امسح رمز QR).')}</li>
          <li>{t('Power the robot. Its status changes to "Connected" after the first heartbeat and "Sending data" when readings arrive.', 'شغّل الروبوت. تتغير حالته إلى "متصل" بعد أول نبضة و"يرسل البيانات" عند وصول القراءات.')}</li>
        </ol>
      </Card>
      {pairing && (
        <Card title={t('Pairing credentials — shown once', 'بيانات الربط — تظهر مرة واحدة')} actions={<button className="btn-ghost" onClick={() => setPairing(null)}>{t('Done', 'تم')}</button>}>
          <Alert tone="warn">{t('Copy the device key now. Only its hash is stored; it cannot be shown again (you can rotate it).', 'انسخ مفتاح الجهاز الآن. يُحفظ منه رمز مشفر فقط ولا يمكن عرضه مرة أخرى (يمكن تغييره).')}</Alert>
          <div className="mt-4 grid gap-4 md:grid-cols-[auto,1fr]">
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200"><QRCodeSVG value={JSON.stringify(pairing)} size={180} /></div>
            <div className="space-y-2 text-sm">
              {(['server', 'device_id', 'device_key'] as const).map((k) => (
                <div key={k} className="flex items-center gap-2"><span className="w-24 shrink-0 text-slate-500">{k}</span><code className="flex-1 break-all rounded bg-slate-100 px-2 py-1" dir="ltr">{pairing[k]}</code><button className="btn-ghost p-1" onClick={() => copy(pairing[k])}><Copy size={14} /></button></div>
              ))}
              <div className="text-slate-500">{t('Test from a computer:', 'اختبار من الكمبيوتر:')}</div>
              <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{sample}</pre>
            </div>
          </div>
        </Card>
      )}
      <Card title={t('Linked robots', 'الروبوتات المرتبطة')} actions={<button className="btn-ghost" onClick={reload}><RefreshCw size={16} /></button>}>
        {data?.devices.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.devices.map((d) => (
              <div key={d.id} className={`rounded-lg border p-4 ${selected === d.id ? 'border-brand-600' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2"><Bot className="text-slate-500" /><div><div className="font-medium">{d.name}</div><code className="text-xs text-slate-500" dir="ltr">{d.deviceUid}</code></div></div>
                  <Badge tone={d.status === 'sending_data' || d.status === 'connected' ? 'green' : d.status === 'error' ? 'red' : 'slate'}>{lt(ROBOT_LABEL[d.status])}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
                  <dt className="text-slate-500">{t('Last seen', 'آخر ظهور')}</dt><dd>{date(d.lastSeenAt, true)}</dd>
                  <dt className="text-slate-500">{t('Last data', 'آخر بيانات')}</dt><dd>{date(d.lastDataAt, true)}</dd>
                  <dt className="text-slate-500">{t('Current zone', 'المنطقة الحالية')}</dt><dd>{d.currentZone?.code ?? '—'}</dd>
                  <dt className="text-slate-500">{t('Battery', 'البطارية')}</dt><dd>{d.batteryPct != null ? `${num(d.batteryPct, 0)}%` : t('Not reported', 'غير مُبلغ')}</dd>
                  <dt className="text-slate-500">{t('Firmware', 'البرنامج الثابت')}</dt><dd>{d.firmwareVersion ?? '—'}</dd>
                </dl>
                {d.lastError && <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{d.lastError}</div>}
                <div className="mt-3 flex gap-1">
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setSelected(selected === d.id ? null : d.id)}>{t('History', 'السجل')}</button>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => rotate(d)}><KeyRound size={14} />{t('New key', 'مفتاح جديد')}</button>
                  <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => remove(d)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty title={t('No robot linked yet', 'لم يتم ربط روبوت بعد')} />}
      </Card>
      {selected && (
        <Card title={t('Robot measurement history', 'سجل قياسات الروبوت')}>
          {history.data?.measurements.length ? (
            <Table head={[t('Zone', 'المنطقة'), t('Time', 'الوقت'), t('Moisture', 'الرطوبة'), 'pH', 'EC', t('Temp', 'الحرارة'), '']}>
              {history.data.measurements.map((m) => <tr key={m.id}><td>{m.zone.code}</td><td>{date(m.measuredAt, true)}</td><td>{num(m.moisture)}</td><td>{num(m.ph, 2)}</td><td>{num(m.ec, 2)}</td><td>{num(m.temperature)}</td><td><SourceBadge source="ROBOT" /></td></tr>)}
            </Table>
          ) : <Empty title={t('No readings received from this robot', 'لم تصل قراءات من هذا الروبوت')} />}
        </Card>
      )}
    </div>
  );
}

export default function Robot() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
