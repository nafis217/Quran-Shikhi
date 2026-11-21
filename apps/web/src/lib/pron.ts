import { transliterateWord, type WordResult } from '@quran-shikkha/pronunciation-engine';

const cache = new Map<string, WordResult>();
/** Memoised: one engine run per distinct word. */
export function pron(arabic: string): WordResult {
  let r = cache.get(arabic);
  if (!r) { r = transliterateWord(arabic); cache.set(arabic, r); }
  return r;
}
