import type { ReactNode } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, hint, icon, tone = 'slate' }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; icon?: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', green: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', blue: 'bg-sky-100 text-sky-700' };
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-semibold text-slate-900">
          {value}
          {unit && <span className="ms-1 text-sm font-normal text-slate-500">{unit}</span>}
        </div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700', green: 'bg-brand-100 text-brand-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', blue: 'bg-sky-100 text-sky-800', violet: 'bg-violet-100 text-violet-800' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="font-medium text-slate-700">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const s = { info: 'border-sky-200 bg-sky-50 text-sky-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', error: 'border-red-200 bg-red-50 text-red-900' }[tone];
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${s}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? <Alert tone="error">{error}</Alert> : null;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function SourceBadge({ source }: { source: 'ROBOT' | 'MANUAL' | 'LAB' | string }) {
  const { t } = useI18n();
  if (source === 'ROBOT') return <Badge tone="blue">{t('Robot', 'روبوت')}</Badge>;
  if (source === 'LAB') return <Badge tone="violet">{t('Laboratory', 'معمل')}</Badge>;
  return <Badge tone="amber">{t('Manual', 'يدوي')}</Badge>;
}

export function DemoBanner({ show }: { show: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return <Alert tone="warn">{t('Demo farm: all readings and financial values here are simulated for demonstration and are not real measurements.', 'مزرعة تجريبية: كل القراءات والقيم المالية هنا محاكاة للعرض وليست قياسات حقيقية.')}</Alert>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="table">
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export const STATUS_TONE = { good: 'green', attention: 'amber', critical: 'red', no_data: 'slate' } as const;
export const IRR_TONE = { urgent: 'red', irrigate: 'amber', ok: 'green', too_wet: 'blue', no_data: 'slate' } as const;
