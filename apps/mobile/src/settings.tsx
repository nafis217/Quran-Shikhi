import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { tr, type Key, type Lang } from '@quran-shikkha/learning-core';
import { load, save } from './storage';

export type Age = 'kids' | 'teens' | 'adults';
interface S { lang: Lang; showPron: boolean; wordMeanings: boolean; fontScale: number; theme: 'light' | 'dark' | 'auto'; age: Age }
interface Ctx extends S { set: (p: Partial<S>) => void; t: (k: Key) => string; colors: Colors }
export interface Colors { surface2: string; bg: string; surface: string; text: string; muted: string; line: string; accent: string; onAccent: string; hl: string; onHl: string; warn: string; foreign: string; throat: string; heavy: string }

const light: Colors = { surface2: '#e6f2fb', bg: '#eef7fd', surface: '#ffffff', text: '#0b0b0c', muted: '#3f4a55', line: '#cfe3f2', accent: '#1b6fa8', onAccent: '#ffffff', hl: '#bfe3fa', onHl: '#000000', warn: '#e3f2fc', foreign: '#7b2cbf', throat: '#b3261e', heavy: '#8a5a00' };
const dark: Colors = { surface2: '#1a2b3b', bg: '#0d1620', surface: '#14212e', text: '#f2f7fb', muted: '#b9c7d3', line: '#2a3d4f', accent: '#7cc4f0', onAccent: '#04121c', hl: '#1f5a82', onHl: '#ffffff', warn: '#17304a', foreign: '#c9a3ff', throat: '#ff8d85', heavy: '#f0c06a' };

const C = createContext<Ctx | null>(null);
export function SettingsProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [s, setS] = useState<S>({ lang: 'bn', showPron: true, wordMeanings: true, fontScale: 1.15, theme: 'light', age: 'adults' });
  useEffect(() => { void load<Partial<S>>('qs.settings', {}).then((p) => setS((o) => ({ ...o, ...p }))); }, []);
  const set = useCallback((p: Partial<S>) => setS((o) => { const n = { ...o, ...p }; void save('qs.settings', n); return n; }), []);
  const value = useMemo<Ctx>(() => ({ ...s, set, t: (k) => tr(s.lang, k), colors: (s.theme === 'auto' ? scheme === 'dark' : s.theme === 'dark') ? dark : light }), [s, set, scheme]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSettings(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('SettingsProvider missing');
  return v;
}
