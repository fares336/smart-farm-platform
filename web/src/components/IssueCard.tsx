import { useI18n } from '../lib/i18n';
import type { Issue } from '../lib/types';
import { Badge } from './ui';

export function IssueCard({ issue }: { issue: Issue }) {
  const { t, lt } = useI18n();
  const tone = issue.severity === 'critical' ? 'red' : issue.severity === 'warning' ? 'amber' : 'blue';
  const conf = { high: t('high', 'عالية'), medium: t('medium', 'متوسطة'), low: t('low', 'منخفضة') }[issue.confidence];
  return (
    <div className={`rounded-lg border p-3 ${tone === 'red' ? 'border-red-200 bg-red-50/50' : tone === 'amber' ? 'border-amber-200 bg-amber-50/50' : 'border-sky-200 bg-sky-50/50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{lt(issue.title)}</div>
        <div className="flex gap-1"><Badge tone={tone}>{t('Priority', 'الأولوية')} {issue.priority}</Badge><Badge>{t('Confidence', 'الثقة')}: {conf}</Badge></div>
      </div>
      {issue.evidence.length > 0 && <ul className="mt-1 list-disc ps-5 text-xs text-slate-600">{issue.evidence.map((e, i) => <li key={i}>{lt(e)}</li>)}</ul>}
      {issue.actions.length > 0 && <div className="mt-2 text-sm"><span className="font-medium">{t('Action', 'الإجراء')}: </span>{issue.actions.map(lt).join(' · ')}</div>}
      <div className="mt-1 text-xs italic text-slate-500">{lt(issue.explanation)}</div>
    </div>
  );
}
