import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Languages, Leaf } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Alert, ErrorBox, Field } from '../components/ui';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-soil-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-900"><span className="rounded-lg bg-brand-700 p-1.5 text-white"><Leaf size={18} /></span>{t('Smart Farm', 'المزرعة الذكية')}</Link>
          <button className="btn-ghost px-2" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Languages size={16} />{lang === 'ar' ? 'English' : 'العربية'}</button>
        </div>
        <div className="card p-6">
          <h1 className="mb-4 text-xl font-bold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      nav(loc.state?.from ?? '/app');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title={t('Log in', 'تسجيل الدخول')}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label={t('Email', 'البريد الإلكتروني')}><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={t('Password', 'كلمة المرور')}><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('Signing in…', 'جارٍ الدخول…') : t('Log in', 'دخول')}</button>
        <div className="flex justify-between text-sm">
          <Link className="text-brand-700 hover:underline" to="/forgot-password">{t('Forgot password?', 'نسيت كلمة المرور؟')}</Link>
          <Link className="text-brand-700 hover:underline" to="/signup">{t('Create account', 'إنشاء حساب')}</Link>
        </div>
      </form>
    </Shell>
  );
}

export function Signup() {
  const { t } = useI18n();
  const { signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) return setError(t('Passwords do not match', 'كلمتا المرور غير متطابقتين'));
    setBusy(true);
    setError(null);
    try {
      await signup(f.name, f.email, f.password);
      nav('/app/farms?new=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title={t('Create your account', 'أنشئ حسابك')}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label={t('Full name', 'الاسم الكامل')}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('Email', 'البريد الإلكتروني')}><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={t('Password', 'كلمة المرور')} hint={t('At least 8 characters, including a letter and a number', '8 أحرف على الأقل، تتضمن حرفًا ورقمًا')}><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label={t('Confirm password', 'تأكيد كلمة المرور')}><input className="input" type="password" required autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('Creating…', 'جارٍ الإنشاء…') : t('Sign up', 'إنشاء الحساب')}</button>
        <p className="text-center text-sm">{t('Already have an account?', 'لديك حساب بالفعل؟')} <Link className="text-brand-700 hover:underline" to="/login">{t('Log in', 'تسجيل الدخول')}</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<{ message: string; devResetUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setDone(await api.post('/auth/forgot-password', { email }));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Shell title={t('Reset your password', 'استعادة كلمة المرور')}>
      {done ? (
        <div className="space-y-3">
          <Alert>{t('If this email is registered, a reset link has been sent.', 'إذا كان البريد مسجلاً، فقد تم إرسال رابط إعادة التعيين.')}</Alert>
          {done.devResetUrl && <Alert tone="warn">{t('Development mode (no SMTP configured): ', 'وضع التطوير (لا يوجد SMTP): ')}<a className="break-all underline" href={done.devResetUrl}>{done.devResetUrl}</a></Alert>}
          <Link to="/login" className="btn-secondary w-full">{t('Back to login', 'العودة لتسجيل الدخول')}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox error={error} />
          <Field label={t('Email', 'البريد الإلكتروني')}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full">{t('Send reset link', 'إرسال رابط الاستعادة')}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password });
      nav('/login');
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Shell title={t('Choose a new password', 'اختر كلمة مرور جديدة')}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label={t('New password', 'كلمة المرور الجديدة')}><input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn-primary w-full">{t('Update password', 'تحديث كلمة المرور')}</button>
      </form>
    </Shell>
  );
}
