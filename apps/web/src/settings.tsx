import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dirOf, tr, type Key, type Lang } from '@quran-shikkha/learning-core';
import { load, save } from './lib/storage';

export type Theme = 'light' | 'dark' | 'auto';
export type Layout = 'stacked' | 'side';

interface Settings {
  lang: Lang;
  theme: Theme;
  showPron: boolean;
  wordMeanings: boolean;
  hoverAudio: boolean;
  layout: Layout;
  fontScale: number;
}
interface Ctx extends Settings {
  set: (p: Partial<Settings>) => void;
  t: (k: Key) => string;
}

const DEFAULTS: Settings = { lang: 'bn', theme: 'light', showPron: true, wordMeanings: true, hoverAudio: true, layout: 'stacked', fontScale: 1.15 };
const C = createContext<Ctx | null>(null);

/** Optional share/test links: ?lang=en&theme=dark&layout=side. Applied for this visit only (never saved). */
function fromUrl(): Partial<Settings> {
  const q = new URLSearchParams(window.location.search);
  const out: Partial<Settings> = {};
  const lang = q.get('lang'), theme = q.get('theme'), layout = q.get('layout');
  if (lang === 'bn' || lang === 'en' || lang === 'ar') out.lang = lang;
  if (theme === 'light' || theme === 'dark' || theme === 'auto') out.theme = theme;
  if (layout === 'stacked' || layout === 'side') out.layout = layout;
  return out;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(() => ({ ...DEFAULTS, ...load<Partial<Settings>>('qs.settings', {}), ...fromUrl() }));
  const set = useCallback((p: Partial<Settings>) => setS((o) => { const n = { ...o, ...p }; save('qs.settings', n); return n; }), []);
  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty('--scale', String(s.fontScale));
    el.lang = s.lang;
    el.dir = dirOf(s.lang);
    el.dataset['theme'] = s.theme;
  }, [s.fontScale, s.lang, s.theme]);
  const value = useMemo<Ctx>(() => ({ ...s, set, t: (k) => tr(s.lang, k) }), [s, set]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useSettings(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('SettingsProvider missing');
  return v;
}
