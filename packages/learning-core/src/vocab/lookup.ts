import { stripMarks } from './games';

export interface LookupEntry { ar: string; bn?: string | null; en?: string | null; source: 'daily' | 'quran' }
export interface LookupHit { ar: string; bn?: string | null; en?: string | null; source: 'daily' | 'quran' }

/** Folds spelling variants so a headline word and a dictionary word can meet: no marks, one alef, ى=ي, ة=ه. */
export function foldArabic(s: string): string {
  return stripMarks(s).replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/[^ء-ي]/g, '');
}

const PREFIXES = ['و', 'ف', 'ب', 'ل', 'ك', 'س'];

/**
 * Builds a "what does this word probably mean" lookup. Matches the word itself, then without one attached prefix
 * (و ف ب ل ك س), then without the article ال. It is a hint, not a dictionary: the UI says "likely meaning".
 * Earlier entries win, so put everyday words before Quranic words.
 */
export function makeLookup(entries: readonly LookupEntry[]): (token: string) => LookupHit | null {
  const map = new Map<string, LookupEntry>();
  for (const e of entries) { const k = foldArabic(e.ar).replace(/^ال/, ''); if (k && !map.has(k)) map.set(k, e); }
  return (token) => {
    const f = foldArabic(token);
    if (f.length < 2) return null;
    const tries = new Set<string>();
    const add = (s: string) => { if (s.length >= 2) { tries.add(s); if (s.startsWith('ال')) tries.add(s.slice(2)); } };
    add(f);
    for (const p of PREFIXES) if (f.startsWith(p)) { add(f.slice(1)); }
    for (const t of tries) { const hit = map.get(t); if (hit) return hit; }
    return null;
  };
}
