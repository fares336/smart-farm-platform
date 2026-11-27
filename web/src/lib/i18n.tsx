import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';
export type LText = { en: string; ar: string };

interface I18n {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  /** Inline bilingual string. */
  t: (en: string, ar: string) => string;
  /** Localise a server-provided {en, ar} text. */
  lt: (x: LText | null | undefined) => string;
  num: (n: number | null | undefined, digits?: number) => string;
  money: (n: number | null | undefined) => string;
  date: (d: string | Date | null | undefined, withTime?: boolean) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('sf_lang') as Lang) || (navigator.language.startsWith('ar') ? 'ar' : 'en'));
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem('sf_lang', lang);
  }, [lang, dir]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const value = useMemo<I18n>(() => {
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    return {
      lang, dir, setLang,
      t: (en, ar) => (lang === 'ar' ? ar : en),
      lt: (x) => (x ? x[lang] ?? x.en : ''),
      num: (n, digits = 1) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })),
      money: (n) => (n == null ? '—' : `${n.toLocaleString(locale, { maximumFractionDigits: 0 })} ${lang === 'ar' ? 'ج.م' : 'EGP'}`),
      date: (d, withTime) => (d ? new Date(d).toLocaleString(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—'),
    };
  }, [lang, dir, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside provider');
  return c;
}
