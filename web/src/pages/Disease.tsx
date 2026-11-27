import { useState } from 'react';
import { Alert, Badge, Card, ErrorBox, PageHeader } from '../components/ui';
import { ImageAnalyze, Unavailable } from '../components/ImageAnalyze';
import { useI18n } from '../lib/i18n';
import { useApi } from '../lib/useApi';

interface Candidate { name: string; confidence: number | null; symptoms?: string; causes?: string; treatment?: string; prevention?: string; advice?: string }
interface Report { status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED'; provider: string; errorMessage: string | null; results: { candidates: Candidate[]; isHealthy?: boolean; notes?: string } | null; createdAt: string }

export default function Disease() {
  const { t, date } = useI18n();
  const [res, setRes] = useState<{ report: Report; available: boolean; error?: string } | null>(null);
  const status = useApi<{ disease: { available: boolean; provider: string } }>('/ai/status');
  const history = useApi<{ images: { id: string; createdAt: string; cropKey: string | null; zone: { code: string } | null; diseaseReports: Report[] }[] }>('/ai/history?purpose=disease');
  const r = res?.report;
  return (
    <div className="space-y-5">
      <PageHeader title={t('AI plant disease diagnosis', 'تشخيص أمراض النبات بالذكاء الاصطناعي')} subtitle={t('Up to three possible diagnoses with confidence. Results are an aid — confirm with an agronomist or plant clinic before spraying.', 'حتى ثلاثة تشخيصات محتملة مع نسبة الثقة. النتائج مساعدة — تأكد مع مهندس زراعي أو عيادة نبات قبل الرش.')} />
      {status.data && !status.data.disease.available && <Unavailable />}
      <ImageAnalyze<{ report: Report; available: boolean; error?: string }> endpoint="/ai/disease" onResult={(x) => { setRes(x); history.reload(); }} />
      {r?.status === 'UNAVAILABLE' && <Unavailable />}
      {r?.status === 'FAILED' && <ErrorBox error={t('The AI provider request failed. No result is shown. ', 'فشل طلب مزود الذكاء الاصطناعي. لا تُعرض نتيجة. ') + (r.errorMessage ?? '')} />}
      {r?.status === 'COMPLETED' && r.results && (
        <div className="space-y-3">
          {r.results.isHealthy && <Alert>{t('The model considers the plant likely healthy.', 'يرى النموذج أن النبات غالبًا سليم.')}</Alert>}
          {r.results.candidates.length === 0 && <Alert tone="warn">{t('No disease candidates returned.', 'لم يُرجع النموذج أي تشخيص.')}</Alert>}
          {r.results.candidates.map((c, i) => (
            <Card key={i} title={`${i + 1}. ${c.name}`} actions={c.confidence != null ? <Badge tone={c.confidence >= 0.7 ? 'green' : c.confidence >= 0.4 ? 'amber' : 'slate'}>{Math.round(c.confidence * 100)}%</Badge> : <Badge>{t('confidence n/a', 'الثقة غير متاحة')}</Badge>}>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                {([['symptoms', t('Symptoms', 'الأعراض')], ['causes', t('Causes', 'الأسباب')], ['treatment', t('Treatment', 'العلاج')], ['prevention', t('Prevention', 'الوقاية')], ['advice', t('Advice', 'نصائح')]] as const).map(([k, label]) => c[k] ? <div key={k}><dt className="font-medium">{label}</dt><dd className="text-slate-600">{c[k]}</dd></div> : null)}
              </dl>
            </Card>
          ))}
          <p className="text-xs text-slate-500">{t('Provider', 'المزود')}: {r.provider}. {t('Confidence values come from the model and are not calibrated probabilities.', 'قيم الثقة من النموذج وليست احتمالات معايرة.')}</p>
        </div>
      )}
      {!!history.data?.images.length && (
        <Card title={t('Previous analyses', 'تحليلات سابقة')}>
          <ul className="divide-y divide-slate-100 text-sm">
            {history.data.images.map((img) => {
              const rep = img.diseaseReports[0];
              return <li key={img.id} className="flex items-center gap-3 py-2"><img src={`/api/ai/images/${img.id}`} alt="" className="h-12 w-12 rounded object-cover" /><div className="flex-1"><div>{rep?.status === 'COMPLETED' ? rep.results?.candidates[0]?.name ?? t('No candidate', 'لا تشخيص') : rep?.status === 'UNAVAILABLE' ? t('Not analyzed (AI unavailable)', 'لم يُحلل (الذكاء غير متاح)') : t('Failed', 'فشل')}</div><div className="text-xs text-slate-500">{date(img.createdAt, true)}{img.zone ? ` · ${img.zone.code}` : ''}</div></div></li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
