import { useState, type FormEvent } from 'react';
import { Alert, Card, ErrorBox, Field, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

export default function Profile() {
  const { t, date } = useI18n();
  const { user, refresh } = useAuth();
  const [p, setP] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const saveProfile = (e: FormEvent) => { e.preventDefault(); run(async () => { await api.patch('/auth/me', { name: p.name, phone: p.phone || null }); await refresh(); }, t('Profile updated', 'تم تحديث الملف')); };
  const savePw = (e: FormEvent) => { e.preventDefault(); run(async () => { await api.post('/auth/change-password', pw); setPw({ currentPassword: '', newPassword: '' }); }, t('Password changed', 'تم تغيير كلمة المرور')); };
  return (
    <div className="space-y-5">
      <PageHeader title={t('Profile', 'الملف الشخصي')} subtitle={`${user?.email} · ${t('member since', 'عضو منذ')} ${date(user?.createdAt)}`} />
      <ErrorBox error={err} />
      {msg && <Alert>{msg}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('Personal information', 'المعلومات الشخصية')}>
          <form onSubmit={saveProfile} className="space-y-3">
            <Field label={t('Name', 'الاسم')}><input className="input" required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label={t('Phone', 'الهاتف')}><input className="input" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
            <button className="btn-primary">{t('Save', 'حفظ')}</button>
          </form>
        </Card>
        <Card title={t('Change password', 'تغيير كلمة المرور')}>
          <form onSubmit={savePw} className="space-y-3">
            <Field label={t('Current password', 'كلمة المرور الحالية')}><input className="input" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label={t('New password', 'كلمة المرور الجديدة')}><input className="input" type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <button className="btn-primary">{t('Change password', 'تغيير كلمة المرور')}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
