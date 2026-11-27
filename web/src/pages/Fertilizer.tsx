import { useState } from 'react';
import { RequireFarm } from '../components/Layout';
import { Alert, Badge, Card, ErrorBox, Field, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useI18n, type LText } from '../lib/i18n';
import { NUTRIENT_NAMES, STAGES } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { Crop, Zone } from '../lib/types';

interface Item { nutrient: string; nutrientName: LText; evidence: LText[]; confidence: string; recommendedFertilizers: { name: LText; note?: LText }[]; reason: LText; applicationMethod: LText; timing: LText; dose: LText; requiredInfo: LText[] }
interface Result { items: Item[]; soilWarnings: LText[]; generalNotes: LText[]; missingInputs: LText[] }

function Content({ farm }: { farm: Farm }) {
  const { t, lt, lang } = useI18n();
  const crops = useApi<{ crops: Crop[] }>('/crops');
  const zones = useApi<{ zones: Zone[] }>(`/farms/${farm.id}/zones`);
  const [f, setF] = useState({ cropKey: farm.defaultCropKey ?? '', growthStage: '', zoneId: '', suspected: [] as string[] });
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setErr(null);
    try {
      const r = await api.post<{ recommendation: { results: Result } }>(`/farms/${farm.id}/fertilizer`, { cropKey: f.cropKey, growthStage: f.growthStage || null, zoneId: f.zoneId || null, suspected: f.suspected });
      setRes(r.recommendation.results);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const toggle = (k: string) => setF({ ...f, suspected: f.suspected.includes(k) ? f.suspected.filter((x) => x !== k) : [...f.suspected, k] });
  const list = (xs: LText[]) => <ul className="list-disc ps-5">{xs.map((x, i) => <li key={i}>{lt(x)}</li>)}</ul>;
  return (
    <div className="space-y-5">
      <PageHeader title={t('Fertilizer recommendations', 'توصيات التسميد')} subtitle={t('Combines crop, growth stage, zone soil readings (pH, EC), lab results and image AI findings. Exact doses are not invented.', 'يجمع المحصول ومرحلة النمو وقراءات التربة (pH، EC) ونتائج المعمل والذكاء الاصطناعي. لا يتم اختراع جرعات.')} />
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('Crop', 'المحصول')}><select className="input" value={f.cropKey} onChange={(e) => setF({ ...f, cropKey: e.target.value })}><option value="">—</option>{crops.data?.crops.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select></Field>
          <Field label={t('Growth stage', 'مرحلة النمو')}><select className="input" value={f.growthStage} onChange={(e) => setF({ ...f, growthStage: e.target.value })}><option value="">—</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{lt(s.label)}</option>)}</select></Field>
          <Field label={t('Zone (uses its soil data)', 'المنطقة (تستخدم بيانات تربتها)')}><select className="input" value={f.zoneId} onChange={(e) => setF({ ...f, zoneId: e.target.value })}><option value="">—</option>{zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.code}{z.readings.lastAt ? '' : ` (${t('no data', 'لا بيانات')})`}</option>)}</select></Field>
        </div>
        <div className="mt-4">
          <span className="label">{t('Suspected deficiencies (from your observation)', 'النقص المشتبه به (من ملاحظتك)')}</span>
          <div className="flex flex-wrap gap-2">{Object.keys(NUTRIENT_NAMES).map((k) => <button key={k} type="button" onClick={() => toggle(k)} className={f.suspected.includes(k) ? 'btn-primary px-3 py-1' : 'btn-secondary px-3 py-1'}>{lt(NUTRIENT_NAMES[k])}</button>)}</div>
        </div>
        <ErrorBox error={err} />
        <button className="btn-primary mt-4" disabled={!f.cropKey} onClick={run}>{t('Generate recommendation', 'إنشاء التوصية')}</button>
      </Card>
      {res && (
        <div className="space-y-3">
          {res.missingInputs.length > 0 && <Alert tone="warn"><b>{t('Information needed for a precise program', 'معلومات مطلوبة لبرنامج دقيق')}:</b>{list(res.missingInputs)}</Alert>}
          {res.soilWarnings.length > 0 && <Alert tone="warn">{list(res.soilWarnings)}</Alert>}
          {res.items.length === 0 && <Alert>{t('No deficiency evidence was provided (no lab result, AI finding or observation). Select suspected deficiencies or add a lab test.', 'لم يتم تقديم دليل على نقص (لا تحليل معمل ولا نتيجة ذكاء اصطناعي ولا ملاحظة). اختر النقص المشتبه أو أضف تحليلاً معمليًا.')}</Alert>}
          {res.items.map((it) => (
            <Card key={it.nutrient} title={lt(it.nutrientName)} actions={<Badge tone={it.confidence === 'high' ? 'green' : it.confidence === 'medium' ? 'amber' : 'slate'}>{t('Confidence', 'الثقة')}: {it.confidence}</Badge>}>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div><b>{t('Evidence', 'الدليل')}</b>{list(it.evidence)}</div>
                <div><b>{t('Fertilizer options', 'خيارات الأسمدة')}</b><ul className="list-disc ps-5">{it.recommendedFertilizers.map((x, i) => <li key={i}>{lt(x.name)}{x.note ? <span className="text-slate-500"> — {lt(x.note)}</span> : null}</li>)}</ul></div>
                <div><b>{t('Why', 'السبب')}:</b> {lt(it.reason)}</div>
                <div><b>{t('Method', 'الطريقة')}:</b> {lt(it.applicationMethod)}</div>
                <div><b>{t('Timing', 'التوقيت')}:</b> {lt(it.timing)}</div>
                <div className="rounded bg-amber-50 p-2 text-amber-900"><b>{t('Dose', 'الجرعة')}:</b> {lt(it.dose)}</div>
                {it.requiredInfo.length > 0 && <div className="md:col-span-2"><b>{t('Confirm before applying', 'تأكد قبل التطبيق')}</b>{list(it.requiredInfo)}</div>}
              </div>
            </Card>
          ))}
          {res.generalNotes.length > 0 && <Card title={t('Notes', 'ملاحظات')}><div className="text-sm">{list(res.generalNotes)}</div></Card>}
        </div>
      )}
    </div>
  );
}

export default function Fertilizer() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
