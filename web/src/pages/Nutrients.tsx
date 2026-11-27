import { useState } from 'react';
import { Alert, Badge, Card, ErrorBox, PageHeader } from '../components/ui';
import { ImageAnalyze, Unavailable } from '../components/ImageAnalyze';
import { useI18n, type LText } from '../lib/i18n';
import { useApi } from '../lib/useApi';
import { NUTRIENT_NAMES } from '../lib/labels';

interface Finding { nutrient: string; confidence: number | null; visibleSymptoms?: string; possibleCauses?: string; affectedCrops?: string; treatment?: string; fertilizers?: string; additionalTests?: string }
interface Analysis { status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED'; provider: string; errorMessage: string | null; results: { findings: Finding[]; differentials?: string[]; notes?: string } | null }
interface RefInfo { name: LText; symptoms: LText; causes: LText[]; fertilizers: { name: LText }[]; confirmTests: LText[]; lookalikes: LText[] }

export default function Nutrients() {
  const { t, lt } = useI18n();
  const [res, setRes] = useState<{ analysis: Analysis } | null>(null);
  const status = useApi<{ nutrient: { available: boolean } }>('/ai/status');
  const ref = useApi<{ nutrients: Record<string, RefInfo> }>('/ai/nutrient-reference');
  const a = res?.analysis;
  return (
    <div className="space-y-5">
      <PageHeader title={t('AI nutrient deficiency analysis', 'تحليل نقص العناصر بالذكاء الاصطناعي')} subtitle={t('Analyzes visible leaf symptoms of N, P, K, Ca, Mg, S, Fe, Zn, Mn, B and Cu deficiency.', 'يحلل أعراض الأوراق الظاهرة لنقص N و P و K و Ca و Mg و S و Fe و Zn و Mn و B و Cu.')} />
      <Alert tone="warn">{t('Important: a photo shows visible symptoms only. It cannot measure the concentration of nutrients in the soil. Use a soil or leaf-tissue laboratory test to confirm before fertilizing.', 'مهم: الصورة تُظهر الأعراض الظاهرة فقط ولا يمكنها قياس تركيز العناصر في التربة. استخدم تحليل تربة أو أنسجة نبات في المعمل للتأكد قبل التسميد.')}</Alert>
      {status.data && !status.data.nutrient.available && <Unavailable />}
      <ImageAnalyze<{ analysis: Analysis }> endpoint="/ai/nutrients" onResult={setRes} />
      {a?.status === 'UNAVAILABLE' && <Unavailable />}
      {a?.status === 'FAILED' && <ErrorBox error={t('The AI provider request failed. No result is shown. ', 'فشل طلب مزود الذكاء الاصطناعي. لا تُعرض نتيجة. ') + (a.errorMessage ?? '')} />}
      {a?.status === 'COMPLETED' && a.results && (
        <div className="space-y-3">
          {a.results.findings.map((f, i) => (
            <Card key={i} title={`${lt(NUTRIENT_NAMES[f.nutrient]) || f.nutrient} — ${t('possible visible deficiency', 'نقص ظاهري محتمل')}`} actions={f.confidence != null ? <Badge tone="amber">{Math.round(f.confidence * 100)}%</Badge> : undefined}>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                {([['visibleSymptoms', t('Visible symptoms', 'الأعراض الظاهرة')], ['possibleCauses', t('Possible causes', 'الأسباب المحتملة')], ['treatment', t('Treatment', 'العلاج')], ['fertilizers', t('Suitable fertilizers', 'الأسمدة المناسبة')], ['additionalTests', t('Confirm with', 'التأكيد عن طريق')]] as const).map(([k, label]) => f[k] ? <div key={k}><dt className="font-medium">{label}</dt><dd className="text-slate-600">{f[k]}</dd></div> : null)}
              </dl>
            </Card>
          ))}
          {a.results.differentials?.length ? <Alert>{t('Could also be', 'قد يكون أيضًا')}: {a.results.differentials.join(' · ')}</Alert> : null}
        </div>
      )}
      <Card title={t('Reference: deficiency symptoms', 'مرجع: أعراض نقص العناصر')}>
        <div className="grid gap-3 md:grid-cols-2">
          {ref.data && Object.entries(ref.data.nutrients).map(([k, n]) => (
            <details key={k} className="rounded-lg border border-slate-200 p-3 text-sm">
              <summary className="cursor-pointer font-medium">{lt(n.name)}</summary>
              <p className="mt-2"><b>{t('Symptoms', 'الأعراض')}:</b> {lt(n.symptoms)}</p>
              <p className="mt-1"><b>{t('Causes', 'الأسباب')}:</b> {n.causes.map(lt).join(' · ')}</p>
              <p className="mt-1"><b>{t('Fertilizers', 'الأسمدة')}:</b> {n.fertilizers.map((f) => lt(f.name)).join(' · ')}</p>
              <p className="mt-1 text-slate-500"><b>{t('Confirm', 'التأكيد')}:</b> {n.confirmTests.map(lt).join(' · ')}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
