import { useState, type FormEvent } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Card, Empty, ErrorBox, Field, PageHeader, Spinner, Table } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';

interface Summary { n: number; mean: number | null; sd: number | null; ci95: [number, number] | null }
interface Obs { id: string; replicate: number; day: number; moisture: number; waterAppliedMl: number | null; notes: string | null }
interface Group { id: string; name: string; treatment: string | null; isControl: boolean; observations: Obs[] }
interface Exp { id: string; title: string; description: string | null; conditions: string | null; startDate: string | null; groups: Group[] }
interface Analysis {
  days: number[]; series: Record<string, number | null>[];
  groups: { id: string; name: string; isControl: boolean; finalMoisture: Summary; retentionPct: Summary; totalWaterMl: number | null }[];
  comparisons: { group: string; vsControl: string; metric: string; difference: number | null; test: { t: number; df: number; p: number } | null; note: string }[];
}
const COLORS = ['#64748b', '#16a34a', '#0284c7', '#ca8a04', '#9333ea', '#dc2626', '#0d9488'];

function NewExperiment({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ title: '', description: '', conditions: '', startDate: '' });
  const [groups, setGroups] = useState([{ name: 'Control', treatment: '', isControl: true }, { name: 'BioPod', treatment: '', isControl: false }]);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ experiment: { id: string } }>('/biopod', { ...f, startDate: f.startDate || null, groups: groups.map((g) => ({ ...g, treatment: g.treatment || null })) });
      onCreated(r.experiment.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  return (
    <Card title={t('New experiment', 'تجربة جديدة')}>
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox error={err} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('Title', 'العنوان')}><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label={t('Start date', 'تاريخ البدء')}><input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label={t('Description / hypothesis', 'الوصف / الفرضية')}><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label={t('Conditions (soil, pot size, temperature…)', 'الظروف (التربة، حجم الأصيص، الحرارة…)')}><textarea className="input" rows={2} value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} /></Field>
        </div>
        <div className="space-y-2">
          <span className="label">{t('Treatment groups', 'مجموعات المعاملة')}</span>
          {groups.map((g, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className="input max-w-[180px]" required value={g.name} onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input max-w-xs" placeholder={t('Treatment (e.g. 5 g BioPod / pot)', 'المعاملة (مثال: 5 جم BioPod / أصيص)')} value={g.treatment} onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, treatment: e.target.value } : x)))} />
              <label className="flex items-center gap-1 text-sm"><input type="radio" name="control" checked={g.isControl} onChange={() => setGroups(groups.map((x, j) => ({ ...x, isControl: j === i })))} />{t('Control', 'شاهد')}</label>
              {groups.length > 1 && <button type="button" className="btn-ghost p-1 text-red-600" onClick={() => setGroups(groups.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
            </div>
          ))}
          <button type="button" className="btn-ghost px-0 text-brand-700" onClick={() => setGroups([...groups, { name: `Group ${groups.length + 1}`, treatment: '', isControl: false }])}><Plus size={14} />{t('Add group', 'إضافة مجموعة')}</button>
        </div>
        <button className="btn-primary">{t('Create experiment', 'إنشاء التجربة')}</button>
      </form>
    </Card>
  );
}

function ExperimentView({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { t, num, lang } = useI18n();
  const { data, loading, reload } = useApi<{ experiment: Exp; analysis: Analysis }>(`/biopod/${id}`);
  const [o, setO] = useState({ groupId: '', replicate: '1', day: '0', moisture: '', waterAppliedMl: '' });
  const [err, setErr] = useState<string | null>(null);
  if (loading || !data) return <Spinner />;
  const { experiment: e, analysis: a } = data;
  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    setErr(null);
    try {
      await api.post(`/biopod/${id}/observations`, { observations: [{ groupId: o.groupId || e.groups[0].id, replicate: Number(o.replicate), day: Number(o.day), moisture: Number(o.moisture), waterAppliedMl: o.waterAppliedMl ? Number(o.waterAppliedMl) : null }] });
      setO({ ...o, moisture: '', waterAppliedMl: '', replicate: String(Number(o.replicate) + 1) });
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  const del = async () => {
    if (!confirm(t('Delete this experiment and all its observations?', 'حذف هذه التجربة وكل ملاحظاتها؟'))) return;
    await api.del(`/biopod/${id}`);
    onDeleted();
  };
  const fmtS = (s: Summary, unit = '') => (s.n === 0 ? '—' : `${num(s.mean)}${unit}${s.sd != null ? ` ± ${num(s.sd)}` : ''} (n=${s.n})`);
  return (
    <div className="space-y-4">
      <Card title={e.title} actions={<div className="flex gap-2"><a className="btn-secondary" href={`/api/reports/biopod/${id}.csv`}><Download size={16} />CSV</a><button className="btn-ghost text-red-600" onClick={del}><Trash2 size={16} /></button></div>}>
        {e.description && <p className="text-sm text-slate-600">{e.description}</p>}
        {e.conditions && <p className="mt-1 text-xs text-slate-500">{t('Conditions', 'الظروف')}: {e.conditions}</p>}
        <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
          <select className="input" value={o.groupId || e.groups[0]?.id} onChange={(ev) => setO({ ...o, groupId: ev.target.value })}>{e.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <input className="input" type="number" min={1} required placeholder={t('Replicate #', 'رقم المكرر')} value={o.replicate} onChange={(ev) => setO({ ...o, replicate: ev.target.value })} />
          <input className="input" type="number" min={0} step="any" required placeholder={t('Day', 'اليوم')} value={o.day} onChange={(ev) => setO({ ...o, day: ev.target.value })} />
          <input className="input" type="number" min={0} max={100} step="any" required placeholder={t('Moisture %', 'الرطوبة %')} value={o.moisture} onChange={(ev) => setO({ ...o, moisture: ev.target.value })} />
          <input className="input" type="number" min={0} step="any" placeholder={t('Water added (ml)', 'الماء المضاف (مل)')} value={o.waterAppliedMl} onChange={(ev) => setO({ ...o, waterAppliedMl: ev.target.value })} />
          <button className="btn-primary">{t('Add observation', 'إضافة ملاحظة')}</button>
        </form>
        <ErrorBox error={err} />
      </Card>
      {a.series.length ? (
        <Card title={t('Mean soil moisture by day (%)', 'متوسط رطوبة التربة باليوم (%)')}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={a.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" fontSize={11} reversed={lang === 'ar'} label={{ value: t('day', 'يوم'), position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis fontSize={11} orientation={lang === 'ar' ? 'right' : 'left'} />
              <Tooltip /><Legend />
              {e.groups.map((g, i) => <Line key={g.id} dataKey={g.name} stroke={COLORS[i % COLORS.length]} strokeDasharray={g.isControl ? '5 3' : undefined} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : <Empty title={t('No observations yet', 'لا توجد ملاحظات بعد')} />}
      {a.series.length > 0 && (
        <Card title={t('Statistics', 'الإحصاءات')}>
          <Table head={[t('Group', 'المجموعة'), t('Final moisture (mean ± SD)', 'الرطوبة النهائية (متوسط ± انحراف)'), t('Water retention vs day 0', 'الاحتفاظ بالمياه مقارنة باليوم 0'), t('95% CI (retention)', 'فترة ثقة 95%'), t('Water added', 'الماء المضاف')]}>
            {a.groups.map((g) => <tr key={g.id}><td>{g.name} {g.isControl && <Badge>{t('control', 'شاهد')}</Badge>}</td><td>{fmtS(g.finalMoisture, '%')}</td><td>{fmtS(g.retentionPct, '%')}</td><td>{g.retentionPct.ci95 ? `${num(g.retentionPct.ci95[0])} – ${num(g.retentionPct.ci95[1])}` : '—'}</td><td>{g.totalWaterMl != null ? `${num(g.totalWaterMl, 0)} ml` : '—'}</td></tr>)}
          </Table>
          <div className="mt-3 space-y-2">
            {a.comparisons.map((c) => (
              <Alert key={c.group} tone={c.test && c.test.p < 0.05 ? 'info' : 'warn'}>
                <b>{c.group}</b> vs {c.vsControl}: {t('difference', 'الفرق')} {num(c.difference)} {c.metric === 'retention_pct' ? t('percentage points of retention', 'نقطة مئوية في الاحتفاظ') : '%'}{c.test ? ` · t = ${num(c.test.t, 2)}, df = ${num(c.test.df, 1)}, p = ${c.test.p.toFixed(4)}` : ''}. {c.note}
              </Alert>
            ))}
            {!a.groups.some((g) => g.isControl) && <Alert tone="warn">{t('Mark one group as control to enable comparisons.', 'حدد مجموعة شاهد لتفعيل المقارنات.')}</Alert>}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function BioPod() {
  const { t, date } = useI18n();
  const list = useApi<{ experiments: { id: string; title: string; createdAt: string; _count: { groups: number } }[] }>('/biopod');
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <PageHeader title={t('BioPod research', 'أبحاث BioPod')} subtitle={t('Record replicated soil-moisture experiments. Statistics are computed only from entered observations; tests need ≥2 replicates per group.', 'سجّل تجارب رطوبة التربة بالمكررات. تُحسب الإحصاءات فقط من الملاحظات المدخلة؛ الاختبارات تحتاج مكررين على الأقل لكل مجموعة.')} actions={<button className="btn-primary" onClick={() => { setCreating(true); setSel(null); }}><Plus size={16} />{t('New experiment', 'تجربة جديدة')}</button>} />
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-2">
          {list.data?.experiments.length ? list.data.experiments.map((e) => (
            <button key={e.id} onClick={() => { setSel(e.id); setCreating(false); }} className={`card block w-full p-3 text-start ${sel === e.id ? 'ring-2 ring-brand-600' : ''}`}>
              <div className="font-medium">{e.title}</div><div className="text-xs text-slate-500">{e._count.groups} {t('groups', 'مجموعات')} · {date(e.createdAt)}</div>
            </button>
          )) : <Empty title={t('No experiments', 'لا توجد تجارب')} />}
        </div>
        <div className="lg:col-span-3">
          {creating ? <NewExperiment onCreated={(id) => { setCreating(false); setSel(id); list.reload(); }} /> : sel ? <ExperimentView key={sel} id={sel} onDeleted={() => { setSel(null); list.reload(); }} /> : <Empty title={t('Select or create an experiment', 'اختر أو أنشئ تجربة')} />}
        </div>
      </div>
    </div>
  );
}
