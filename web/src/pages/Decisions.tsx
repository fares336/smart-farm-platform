import { useState } from 'react';
import { RequireFarm } from '../components/Layout';
import { Badge, Card, DemoBanner, Empty, PageHeader, Spinner, Stat, STATUS_TONE } from '../components/ui';
import { IssueCard } from '../components/IssueCard';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import { STATUS_LABEL } from '../lib/labels';
import type { Farm } from '../lib/farm';
import type { Issue, ZoneDecision } from '../lib/types';

function Content({ farm }: { farm: Farm }) {
  const { t, lt, date } = useI18n();
  const [filter, setFilter] = useState<'issues' | 'all'>('issues');
  const { data, loading } = useApi<{ summary: { critical: number; attention: number; good: number; noData: number }; farmIssues: Issue[]; zones: ZoneDecision[]; generatedAt: string }>(`/farms/${farm.id}/decision`);
  if (loading || !data) return <Spinner />;
  const zones = filter === 'issues' ? data.zones.filter((z) => z.status === 'critical' || z.status === 'attention') : data.zones.filter((z) => z.status !== 'no_data');
  return (
    <div className="space-y-5">
      <PageHeader title={t('Smart decision support', 'دعم القرار الذكي')} subtitle={t('Combines soil readings, weather, AI findings, crop requirements, irrigation and finance into prioritized, explainable actions.', 'يجمع قراءات التربة والطقس ونتائج الذكاء الاصطناعي ومتطلبات المحاصيل والري والمالية في إجراءات مرتبة وقابلة للتفسير.')} />
      <DemoBanner show={farm.isDemo} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={lt(STATUS_LABEL.critical)} value={data.summary.critical} tone="red" />
        <Stat label={lt(STATUS_LABEL.attention)} value={data.summary.attention} tone="amber" />
        <Stat label={lt(STATUS_LABEL.good)} value={data.summary.good} tone="green" />
        <Stat label={lt(STATUS_LABEL.no_data)} value={data.summary.noData} />
      </div>
      {data.farmIssues.length > 0 && <Card title={t('Farm-level', 'على مستوى المزرعة')}><div className="space-y-2">{data.farmIssues.map((i) => <IssueCard key={i.id} issue={i} />)}</div></Card>}
      <div className="flex gap-2">
        <button className={filter === 'issues' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('issues')}>{t('Zones needing action', 'مناطق تحتاج إجراء')}</button>
        <button className={filter === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('all')}>{t('All measured zones', 'كل المناطق المقاسة')}</button>
      </div>
      {zones.length ? zones.map((z) => (
        <Card key={z.zoneCode} title={<span>{t('Zone', 'المنطقة')} {z.zoneCode}</span>} actions={<Badge tone={STATUS_TONE[z.status]}>{lt(STATUS_LABEL[z.status])}</Badge>}>
          <div className="space-y-2">{z.issues.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
          {z.missingData.length > 0 && <p className="mt-2 text-xs text-slate-500">{t('Missing data', 'بيانات ناقصة')}: {z.missingData.map(lt).join(' · ')}</p>}
        </Card>
      )) : <Empty title={data.summary.noData === data.zones.length ? t('No measurements — nothing to assess yet', 'لا توجد قياسات — لا يوجد ما يمكن تقييمه بعد') : t('No zone needs action', 'لا توجد منطقة تحتاج إجراء')} />}
      <p className="text-xs text-slate-500">{t('Generated', 'تم الإنشاء')} {date(data.generatedAt, true)}. {t('Confidence reflects the quality of the evidence: lab/sensor data is high, AI image findings are at most medium.', 'تعكس الثقة جودة الدليل: بيانات المعمل/الحساسات عالية، ونتائج الصور بالذكاء الاصطناعي متوسطة كحد أقصى.')}</p>
    </div>
  );
}

export default function Decisions() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
