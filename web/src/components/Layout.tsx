import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bot, Brain, Bug, CloudSun, Coins, Droplets, FileText, FlaskConical, Gauge, Grid3x3, Languages, Leaf, LogOut, Map, Menu, PenLine,
  Settings, Sprout, Tag, TestTubes, User, Wheat, X,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useFarm } from '../lib/farm';

interface NavItem { to: string; en: string; ar: string; icon: ReactNode }

const NAV: { en: string; ar: string; items: NavItem[] }[] = [
  { en: 'Overview', ar: 'نظرة عامة', items: [
    { to: '/app', en: 'Dashboard', ar: 'لوحة التحكم', icon: <Gauge size={18} /> },
    { to: '/app/farms', en: 'Farms', ar: 'المزارع', icon: <Map size={18} /> },
    { to: '/app/map', en: 'Zone map', ar: 'خريطة المناطق', icon: <Grid3x3 size={18} /> },
  ] },
  { en: 'Soil & robot', ar: 'التربة والروبوت', items: [
    { to: '/app/soil', en: 'Soil monitoring', ar: 'مراقبة التربة', icon: <BarChart3 size={18} /> },
    { to: '/app/robot', en: 'Robot', ar: 'الروبوت', icon: <Bot size={18} /> },
    { to: '/app/manual', en: 'Manual entry', ar: 'إدخال يدوي', icon: <PenLine size={18} /> },
  ] },
  { en: 'AI analysis', ar: 'تحليل الذكاء الاصطناعي', items: [
    { to: '/app/disease', en: 'Plant disease', ar: 'أمراض النبات', icon: <Bug size={18} /> },
    { to: '/app/nutrients', en: 'Nutrient deficiency', ar: 'نقص العناصر', icon: <TestTubes size={18} /> },
    { to: '/app/fertilizer', en: 'Fertilizer', ar: 'التسميد', icon: <Sprout size={18} /> },
  ] },
  { en: 'Planning', ar: 'التخطيط', items: [
    { to: '/app/crops', en: 'Crop recommendation', ar: 'توصية المحاصيل', icon: <Wheat size={18} /> },
    { to: '/app/weather', en: 'Weather', ar: 'الطقس', icon: <CloudSun size={18} /> },
    { to: '/app/irrigation', en: 'Irrigation', ar: 'الري', icon: <Droplets size={18} /> },
    { to: '/app/biopod', en: 'BioPod research', ar: 'أبحاث BioPod', icon: <FlaskConical size={18} /> },
  ] },
  { en: 'Business', ar: 'الأعمال', items: [
    { to: '/app/finance', en: 'Finance', ar: 'الإدارة المالية', icon: <Coins size={18} /> },
    { to: '/app/prices', en: 'Market prices', ar: 'أسعار السوق', icon: <Tag size={18} /> },
    { to: '/app/decisions', en: 'Decision support', ar: 'دعم القرار', icon: <Brain size={18} /> },
    { to: '/app/reports', en: 'Reports', ar: 'التقارير', icon: <FileText size={18} /> },
  ] },
];

export function Layout() {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const { farms, farm, select } = useFarm();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const sidebar = (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="flex items-center gap-2 px-2">
        <div className="rounded-lg bg-brand-700 p-1.5 text-white"><Leaf size={20} /></div>
        <span className="text-lg font-bold text-brand-900">{t('Smart Farm', 'المزرعة الذكية')}</span>
      </div>
      {NAV.map((g) => (
        <div key={g.en}>
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(g.en, g.ar)}</div>
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/app'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${isActive ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {i.icon}
              {t(i.en, i.ar)}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="mt-auto border-t border-slate-200 pt-3">
        <NavLink to="/app/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"><User size={18} />{t('Profile', 'الملف الشخصي')}</NavLink>
        <NavLink to="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"><Settings size={18} />{t('Settings', 'الإعدادات')}</NavLink>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-white shadow-xl">
            <button className="btn-ghost absolute end-2 top-2 p-2" onClick={() => setOpen(false)} aria-label="close"><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu size={20} /></button>
          {farms.length > 0 ? (
            <select className="input max-w-xs" value={farm?.id ?? ''} onChange={(e) => select(e.target.value)} aria-label={t('Farm', 'المزرعة')}>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}{f.isDemo ? ` (${t('demo', 'تجريبية')})` : ''}</option>)}
            </select>
          ) : (
            <span className="text-sm text-slate-500">{t('No farm yet', 'لا توجد مزرعة بعد')}</span>
          )}
          <div className="ms-auto flex items-center gap-2">
            <button className="btn-secondary px-3" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Languages size={16} />{lang === 'ar' ? 'English' : 'العربية'}</button>
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.name}</span>
            <button className="btn-ghost px-2" onClick={async () => { await logout(); nav('/'); }} title={t('Log out', 'تسجيل الخروج')}><LogOut size={18} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}

export function RequireFarm({ children }: { children: (farm: NonNullable<ReturnType<typeof useFarm>['farm']>) => ReactNode }) {
  const { farm, loading } = useFarm();
  const { t } = useI18n();
  const nav = useNavigate();
  if (loading) return <div className="py-10 text-center text-slate-500">{t('Loading…', 'جارٍ التحميل…')}</div>;
  if (!farm)
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <Map className="mx-auto mb-3 text-brand-700" size={36} />
        <h2 className="text-lg font-semibold">{t('Register your first farm', 'سجّل مزرعتك الأولى')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('Add a farm with its location and area (or boundary). It will be divided into 256 zones automatically.', 'أضف مزرعة بموقعها ومساحتها (أو حدودها). سيتم تقسيمها تلقائيًا إلى 256 منطقة.')}</p>
        <button className="btn-primary mt-4" onClick={() => nav('/app/farms?new=1')}>{t('Add farm', 'إضافة مزرعة')}</button>
      </div>
    );
  return <>{children(farm)}</>;
}
