import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, ErrorBox, Field, PageHeader, Spinner, Table } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { EXPENSE_LABEL } from '../lib/labels';
import type { Farm } from '../lib/farm';

interface Price { id: string; name: string; category: string; unit: string; priceEgp: number; isEstimate: boolean; source: string | null; priceDate: string; scope: 'farm' | 'default' }

function Content({ farm }: { farm: Farm }) {
  const { t, lt, num, date } = useI18n();
  const { data, loading, reload } = useApi<{ prices: Price[]; disclaimer: string }>(`/farms/${farm.id}/finance/prices`);
  const [edit, setEdit] = useState<{ id: string; priceEgp: string } | null>(null);
  const [f, setF] = useState({ name: '', category: 'fertilizers', unit: '', priceEgp: '', source: '' });
  const [err, setErr] = useState<string | null>(null);
  if (loading || !data) return <Spinner />;
  const save = async () => {
    if (!edit) return;
    await api.patch(`/farms/${farm.id}/finance/prices/${edit.id}`, { priceEgp: Number(edit.priceEgp), isEstimate: false, source: 'Edited by farmer' });
    setEdit(null);
    reload();
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/farms/${farm.id}/finance/prices`, { ...f, priceEgp: Number(f.priceEgp), isEstimate: false, source: f.source || 'Entered by farmer' });
      setF({ ...f, name: '', unit: '', priceEgp: '', source: '' });
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader title={t('Market & input prices', 'أسعار السوق والمدخلات')} subtitle={t('Editable prices used for planning. Your edits apply only to this farm.', 'أسعار قابلة للتعديل للتخطيط. تعديلاتك تخص هذه المزرعة فقط.')} />
      <Alert tone="warn">{t('Default prices are rough, unverified estimates — not confirmed current market prices. Replace them with your local prices.', 'الأسعار الافتراضية تقديرات تقريبية غير مؤكدة — وليست أسعار سوق حالية مؤكدة. استبدلها بأسعارك المحلية.')}</Alert>
      <Card>
        <Table head={[t('Item', 'البند'), t('Category', 'الفئة'), t('Unit', 'الوحدة'), t('Price (EGP)', 'السعر (جنيه)'), t('Status', 'الحالة'), t('Updated', 'التحديث'), '']}>
          {data.prices.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td><td>{lt(EXPENSE_LABEL[p.category]) || p.category}</td><td>{p.unit}</td>
              <td>{edit?.id === p.id ? <input className="input w-28" type="number" min="0" step="any" autoFocus value={edit.priceEgp} onChange={(e) => setEdit({ ...edit, priceEgp: e.target.value })} /> : num(p.priceEgp, 2)}</td>
              <td>{p.isEstimate ? <Badge tone="amber">{t('Estimate', 'تقديري')}</Badge> : <Badge tone="green">{t('Your price', 'سعرك')}</Badge>}</td>
              <td className="text-xs text-slate-500">{date(p.priceDate)}</td>
              <td className="flex gap-1">
                {edit?.id === p.id ? <><button className="btn-ghost p-1 text-brand-700" onClick={save}><Check size={14} /></button><button className="btn-ghost p-1" onClick={() => setEdit(null)}><X size={14} /></button></> : <button className="btn-ghost p-1" onClick={() => setEdit({ id: p.id, priceEgp: String(p.priceEgp) })}><Pencil size={14} /></button>}
                <button className="btn-ghost p-1 text-red-600" onClick={async () => { await api.del(`/farms/${farm.id}/finance/prices/${p.id}`); reload(); }}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={t('Add a price', 'إضافة سعر')}>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2"><Field label={t('Item', 'البند')}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label={t('Category', 'الفئة')}><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.keys(EXPENSE_LABEL).map((k) => <option key={k} value={k}>{lt(EXPENSE_LABEL[k])}</option>)}</select></Field>
          <Field label={t('Unit', 'الوحدة')}><input className="input" required value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label={t('Price (EGP)', 'السعر (جنيه)')}><input className="input" type="number" min="0" step="any" required value={f.priceEgp} onChange={(e) => setF({ ...f, priceEgp: e.target.value })} /></Field>
          <div className="flex items-end"><button className="btn-primary w-full"><Plus size={16} />{t('Add', 'إضافة')}</button></div>
        </form>
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}

export default function Prices() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
