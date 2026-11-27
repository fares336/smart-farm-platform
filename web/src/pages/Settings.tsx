import { Card, Badge, PageHeader } from '../components/ui';
import { useApi } from '../lib/useApi';
import { useI18n } from '../lib/i18n';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const ai = useApi<{ disease: { provider: string; available: boolean }; nutrient: { provider: string; available: boolean } }>('/ai/status');
  const status = (s?: { provider: string; available: boolean }) => s ? <Badge tone={s.available ? 'green' : 'slate'}>{s.available ? `${s.provider} — ${t('configured', 'مُعد')}` : t('Not configured', 'غير مُعد')}</Badge> : null;
  return (
    <div className="space-y-5">
      <PageHeader title={t('Settings', 'الإعدادات')} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('Language', 'اللغة')}>
          <div className="flex gap-2">
            <button className={lang === 'en' ? 'btn-primary' : 'btn-secondary'} onClick={() => setLang('en')}>English</button>
            <button className={lang === 'ar' ? 'btn-primary' : 'btn-secondary'} onClick={() => setLang('ar')}>العربية</button>
          </div>
        </Card>
        <Card title={t('Integrations', 'التكاملات')}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>{t('Plant disease AI', 'ذكاء أمراض النبات')}</dt><dd>{status(ai.data?.disease)}</dd></div>
            <div className="flex justify-between"><dt>{t('Nutrient symptom AI', 'ذكاء أعراض نقص العناصر')}</dt><dd>{status(ai.data?.nutrient)}</dd></div>
            <div className="flex justify-between"><dt>NASA POWER</dt><dd><Badge tone="green">{t('Public API (no key)', 'واجهة عامة (بدون مفتاح)')}</Badge></dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">{t('AI providers are configured by the server administrator through environment variables (see README). Keys are never sent to the browser.', 'يتم إعداد مزودي الذكاء الاصطناعي بواسطة مدير الخادم عبر متغيرات البيئة (راجع README). لا تُرسل المفاتيح إلى المتصفح أبدًا.')}</p>
        </Card>
      </div>
    </div>
  );
}
