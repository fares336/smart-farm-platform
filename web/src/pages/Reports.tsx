import { Download, FileText } from 'lucide-react';
import { RequireFarm } from '../components/Layout';
import { Card, PageHeader } from '../components/ui';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';
import type { Farm } from '../lib/farm';

function Content({ farm }: { farm: Farm }) {
  const { t } = useI18n();
  const seasons = useApi<{ seasons: { id: string; name: string }[] }>(`/farms/${farm.id}/finance/seasons`);
  const exps = useApi<{ experiments: { id: string; title: string }[] }>('/biopod');
  const link = (href: string, label: string, Icon = Download) => <a key={href} className="btn-secondary justify-start" href={href}><Icon size={16} />{label}</a>;
  return (
    <div className="space-y-5">
      <PageHeader title={t('Reports', 'التقارير')} subtitle={t('Exports are generated from the data stored for this farm. PDF report text is in English.', 'تُنشأ الملفات من البيانات المخزنة لهذه المزرعة. نص تقرير PDF باللغة الإنجليزية.')} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('Farm', 'المزرعة')}><div className="grid gap-2">
          {link(`/api/reports/farms/${farm.id}/report.pdf`, t('Full farm report (PDF)', 'تقرير المزرعة الكامل (PDF)'), FileText)}
          {link(`/api/reports/farms/${farm.id}/measurements.csv`, t('All soil measurements (CSV)', 'كل قياسات التربة (CSV)'))}
        </div></Card>
        <Card title={t('Finance (CSV per season)', 'المالية (CSV لكل موسم)')}><div className="grid gap-2">
          {seasons.data?.seasons.length ? seasons.data.seasons.map((s) => link(`/api/reports/seasons/${s.id}/finance.csv`, s.name)) : <span className="text-sm text-slate-500">{t('No seasons', 'لا توجد مواسم')}</span>}
        </div></Card>
        <Card title={t('BioPod experiments (CSV)', 'تجارب BioPod (CSV)')}><div className="grid gap-2">
          {exps.data?.experiments.length ? exps.data.experiments.map((e) => link(`/api/reports/biopod/${e.id}.csv`, e.title)) : <span className="text-sm text-slate-500">{t('No experiments', 'لا توجد تجارب')}</span>}
        </div></Card>
      </div>
    </div>
  );
}

export default function Reports() {
  return <RequireFarm>{(farm) => <Content farm={farm} />}</RequireFarm>;
}
