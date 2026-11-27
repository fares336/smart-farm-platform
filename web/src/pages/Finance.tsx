import { useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Plus, Trash2 } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, DemoBanner, Empty, ErrorBox, Field, PageHeader, Spinner, Table } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { EXPENSE_LABEL, today } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { Crop, FinancialSummary } from '../lib/types';

interface Expense { id: string; category: string; description: string | null; amountEgp: number; date: string; isEstimate: boolean }
interface Harvest { id: string; cropKey: string; quantityTon: number; date: string; isEstimate: boolean }
interface Sale { id: string; cropKey: string; quantityTon: number; pricePerTonEgp: number; date: string; buyer: string | null; isEstimate: boolean }
interface Season { id: string; name: string; cropKey: string | null; expenses: Expense[]; harvests: Harvest[]; sales: Sale[]; summary: { actual: FinancialSummary; estimated: FinancialSummary } }
const PIE = ['#15803d', '#0284c7', '#ca8a04', '#9333ea', '#dc2626', '#0d9488', '#ea580c', '#64748b', '#be185d', '#4f46e5'];

function SummaryBlock({ s, title, tone }: { s: FinancialSummary; title: string; tone: 'green' | 'amber' }) {
  const { t, money, num } = useI18n();
  return (
    <Card title={<span>{title} <Badge tone={tone}>{tone === 'green' ? t('actual', 'فعلي') : t('estimated', 'تقديري')}</Badge></span>}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">{t('Revenue', 'الإيرادات')}</dt><dd className="text-lg font-semibold">{money(s.totalRevenue)}</dd></div>
        <div><dt className="text-slate-500">{t('Total costs', 'إجمالي التكاليف')}</dt><dd className="text-lg font-semibold">{money(s.totalCosts)}</dd></div>
        <div><dt className="text-slate-500">{t('Net profit', 'صافي الربح')}</dt><dd className={`text-lg font-semibold ${s.netProfit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{money(s.netProfit)}</dd></div>
        <div><dt className="text-slate-500">{t('Profit margin', 'هامش الربح')}</dt><dd className="text-lg font-semibold">{s.profitMarginPct != null ? `${num(s.profitMarginPct)}%` : '—'}</dd></div>
        <div><dt className="text-slate-500">{t('Harvest / sold / unsold', 'الحصاد / المباع / غير المباع')}</dt><dd>{num(s.harvestTon, 2)} / {num(s.soldTon, 2)} / {num(s.unsoldTon, 2)} {t('t', 'طن')}</dd></div>
        <div><dt className="text-slate-500">{t('Cost per ton', 'تكلفة الطن')}</dt><dd>{s.costPerTon != null ? money(s.costPerTon) : '—'}</dd></div>
      </dl>
    </Card>
  );
}

function SeasonView({ season, crops, reload }: { season: Season; crops: Crop[]; reload: () => void }) {
  const { t, lt, money, num, date, lang } = useI18n();
  const [kind, setKind] = useState<'expenses' | 'harvests' | 'sales'>('expenses');
  const [f, setF] = useState({ category: 'seeds', description: '', amountEgp: '', cropKey: season.cropKey ?? '', quantityTon: '', pricePerTonEgp: '', buyer: '', date: today(), isEstimate: false });
  const [err, setErr] = useState<string | null>(null);
  const cropName = (k: string) => { const c = crops.find((x) => x.key === k); return c ? (lang === 'ar' ? c.nameAr : c.nameEn) : k; };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body = kind === 'expenses' ? { category: f.category, description: f.description || null, amountEgp: Number(f.amountEgp), date: f.date, isEstimate: f.isEstimate }
      : kind === 'harvests' ? { cropKey: f.cropKey, quantityTon: Number(f.quantityTon), date: f.date, isEstimate: f.isEstimate }
      : { cropKey: f.cropKey, quantityTon: Number(f.quantityTon), pricePerTonEgp: Number(f.pricePerTonEgp), buyer: f.buyer || null, date: f.date, isEstimate: f.isEstimate };
    try {
      await api.post(`/seasons/${season.id}/${kind}`, body);
      setF({ ...f, amountEgp: '', quantityTon: '', pricePerTonEgp: '', description: '', buyer: '' });
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  const del = async (k: string, id: string) => { await api.del(`/seasons/${season.id}/${k}/${id}`); reload(); };
  const est = (x: { isEstimate: boolean }) => x.isEstimate ? <Badge tone="amber">{t('est.', 'تقديري')}</Badge> : <Badge tone="green">{t('actual', 'فعلي')}</Badge>;
  const pie = Object.entries(season.summary.actual.expensesByCategory).map(([k, v]) => ({ name: lt(EXPENSE_LABEL[k]) || k, value: v }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryBlock s={season.summary.actual} title={t('Actual results', 'النتائج الفعلية')} tone="green" />
        {(season.summary.estimated.totalCosts > 0 || season.summary.estimated.totalRevenue > 0 || season.summary.estimated.harvestTon > 0) ? <SummaryBlock s={season.summary.estimated} title={t('Estimated / planned', 'تقديري / مخطط')} tone="amber" /> : (
          <Card title={t('Actual costs by category', 'التكاليف الفعلية حسب البند')}>
            {pie.length ? <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label={(d) => d.name}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip formatter={(v) => money(Number(v))} /></PieChart></ResponsiveContainer> : <Empty title={t('No actual expenses', 'لا توجد مصروفات فعلية')} />}
          </Card>
        )}
      </div>
      <Card title={t('Add record', 'إضافة سجل')} actions={<a className="btn-secondary" href={`/api/reports/seasons/${season.id}/finance.csv`}><Download size={16} />CSV</a>}>
        <div className="mb-3 flex gap-2">
          {(['expenses', 'harvests', 'sales'] as const).map((k) => <button key={k} className={kind === k ? 'btn-primary' : 'btn-secondary'} onClick={() => setKind(k)}>{{ expenses: t('Expense', 'مصروف'), harvests: t('Harvest', 'حصاد'), sales: t('Sale', 'بيع') }[k]}</button>)}
        </div>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          {kind === 'expenses' ? <>
            <Field label={t('Category', 'البند')}><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.keys(EXPENSE_LABEL).map((k) => <option key={k} value={k}>{lt(EXPENSE_LABEL[k])}</option>)}</select></Field>
            <Field label={t('Amount (EGP)', 'المبلغ (جنيه)')}><input className="input" type="number" step="any" min="0" required value={f.amountEgp} onChange={(e) => setF({ ...f, amountEgp: e.target.value })} /></Field>
            <Field label={t('Description', 'الوصف')}><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          </> : <>
            <Field label={t('Crop', 'المحصول')}><select className="input" required value={f.cropKey} onChange={(e) => setF({ ...f, cropKey: e.target.value })}><option value="">—</option>{crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
            <Field label={t('Quantity (ton)', 'الكمية (طن)')}><input className="input" type="number" step="any" min="0" required value={f.quantityTon} onChange={(e) => setF({ ...f, quantityTon: e.target.value })} /></Field>
            {kind === 'sales' && <Field label={t('Price per ton (EGP)', 'سعر الطن (جنيه)')}><input className="input" type="number" step="any" min="0" required value={f.pricePerTonEgp} onChange={(e) => setF({ ...f, pricePerTonEgp: e.target.value })} /></Field>}
            {kind === 'sales' && <Field label={t('Buyer', 'المشتري')}><input className="input" value={f.buyer} onChange={(e) => setF({ ...f, buyer: e.target.value })} /></Field>}
          </>}
          <Field label={t('Date', 'التاريخ')}><input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isEstimate} onChange={(e) => setF({ ...f, isEstimate: e.target.checked })} />{t('This is an estimate (not actual)', 'هذا تقدير (ليس فعليًا)')}</label>
          <div className="flex items-end"><button className="btn-primary w-full"><Plus size={16} />{t('Add', 'إضافة')}</button></div>
        </form>
        <ErrorBox error={err} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('Expenses', 'المصروفات')} className="lg:col-span-1">
          {season.expenses.length ? <Table head={[t('Date', 'التاريخ'), t('Category', 'البند'), 'EGP', '', '']}>{season.expenses.map((x) => <tr key={x.id}><td>{date(x.date)}</td><td title={x.description ?? ''}>{lt(EXPENSE_LABEL[x.category])}</td><td>{num(x.amountEgp, 0)}</td><td>{est(x)}</td><td><button className="btn-ghost p-1 text-red-600" onClick={() => del('expenses', x.id)}><Trash2 size={14} /></button></td></tr>)}</Table> : <Empty title={t('None', 'لا يوجد')} />}
        </Card>
        <Card title={t('Harvests', 'الحصاد')}>
          {season.harvests.length ? <Table head={[t('Date', 'التاريخ'), t('Crop', 'المحصول'), t('ton', 'طن'), '', '']}>{season.harvests.map((x) => <tr key={x.id}><td>{date(x.date)}</td><td>{cropName(x.cropKey)}</td><td>{num(x.quantityTon, 2)}</td><td>{est(x)}</td><td><button className="btn-ghost p-1 text-red-600" onClick={() => del('harvests', x.id)}><Trash2 size={14} /></button></td></tr>)}</Table> : <Empty title={t('None', 'لا يوجد')} />}
        </Card>
        <Card title={t('Sales', 'المبيعات')}>
          {season.sales.length ? <Table head={[t('Date', 'التاريخ'), t('ton', 'طن'), t('EGP/t', 'جنيه/طن'), t('Total', 'الإجمالي'), '', '']}>{season.sales.map((x) => <tr key={x.id}><td>{date(x.date)}</td><td>{num(x.quantityTon, 2)}</td><td>{num(x.pricePerTonEgp, 0)}</td><td>{num(x.quantityTon * x.pricePerTonEgp, 0)}</td><td>{est(x)}</td><td><button className="btn-ghost p-1 text-red-600" onClick={() => del('sales', x.id)}><Trash2 size={14} /></button></td></tr>)}</Table> : <Empty title={t('None', 'لا يوجد')} />}
        </Card>
      </div>
    </div>
  );
}

function Content({ farm }: { farm: Farm }) {
  const { t, lang } = useI18n();
  const { data, loading, reload } = useApi<{ seasons: Season[] }>(`/farms/${farm.id}/finance/seasons`);
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cropKey, setCropKey] = useState(farm.defaultCropKey ?? '');
  if (loading || !data) return <Spinner />;
  const season = data.seasons.find((s) => s.id === sel) ?? data.seasons[data.seasons.length - 1];
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const r = await api.post<{ season: { id: string } }>(`/farms/${farm.id}/finance/seasons`, { name, cropKey: cropKey || null });
    setName('');
    setSel(r.season.id);
    reload();
  };
  const compare = data.seasons.map((s) => ({ name: s.name, revenue: s.summary.actual.totalRevenue, costs: s.summary.actual.totalCosts, profit: s.summary.actual.netProfit }));
  return (
    <div className="space-y-5">
      <PageHeader title={t('Financial management', 'الإدارة المالية')} subtitle={t('All amounts in EGP. Actual and estimated figures are always calculated separately.', 'كل المبالغ بالجنيه المصري. تُحسب الأرقام الفعلية والتقديرية بشكل منفصل دائمًا.')} />
      <DemoBanner show={farm.isDemo} />
      <Card>
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <Field label={t('New season', 'موسم جديد')}><input className="input" required placeholder={t('e.g. Winter 2026/27', 'مثال: شتوي 2026/27')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t('Crop', 'المحصول')}><select className="input" value={cropKey} onChange={(e) => setCropKey(e.target.value)}><option value="">—</option>{crops.data?.crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
          <button className="btn-primary"><Plus size={16} />{t('Create', 'إنشاء')}</button>
          {data.seasons.length > 0 && <select className="input ms-auto max-w-xs" value={season?.id} onChange={(e) => setSel(e.target.value)}>{data.seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        </form>
      </Card>
      {season ? <SeasonView key={season.id} season={season} crops={crops.data?.crops ?? []} reload={reload} /> : <Empty title={t('Create your first season to start tracking costs and revenue', 'أنشئ موسمك الأول لبدء تتبع التكاليف والإيرادات')} />}
      {data.seasons.length > 1 && (
        <Card title={t('Season comparison (actual)', 'مقارنة المواسم (فعلي)')}>
          <ResponsiveContainer width="100%" height={260}><BarChart data={compare}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" fontSize={11} reversed={lang === 'ar'} /><YAxis fontSize={11} orientation={lang === 'ar' ? 'right' : 'left'} /><Tooltip /><Legend />
            <Bar dataKey="revenue" name={t('Revenue', 'الإيرادات')} fill="#15803d" /><Bar dataKey="costs" name={t('Costs', 'التكاليف')} fill="#dc2626" /><Bar dataKey="profit" name={t('Profit', 'الربح')} fill="#0284c7" /></BarChart></ResponsiveContainer>
        </Card>
      )}
      <Alert>{t('Profit is calculated as revenue from recorded sales minus recorded expenses. Unsold harvest is not counted as revenue.', 'يُحسب الربح كإيرادات المبيعات المسجلة ناقص المصروفات المسجلة. الحصاد غير المباع لا يُحسب كإيراد.')}</Alert>
    </div>
  );
}

export default function Finance() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
