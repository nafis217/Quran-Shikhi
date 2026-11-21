import { normalizeKey } from './text.ts';
import type { AyahDto, FrequencyTrackDto, FrequentWordDto, WordDto } from './types.ts';

interface Agg { count: number; example: WordDto; bn: Map<string, number>; en: Map<string, number> }
const top = (m: Map<string, number>): string | null => {
  let best: string | null = null, bc = -1;
  for (const [k, v] of m) if (v > bc || (v === bc && best !== null && k < best)) { best = k; bc = v; }
  return best;
};
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // UTF-16 code-unit order, like StringComparer.Ordinal
const round2 = (x: number) => Math.round(x * 100 + Number.EPSILON) / 100;

/** Most frequent words with their most COMMON meaning, computed from data. No coverage number is hard-coded. */
export function buildFrequencyTrack(ayahs: Iterable<AyahDto>, size: number, scope: string): FrequencyTrackDto {
  const counts = new Map<string, Agg>();
  let total = 0;
  for (const a of ayahs) for (const w of a.words) {
    if (w.charType !== 'word') continue; // skip verse-end markers
    total++;
    const k = normalizeKey(w.arabicText);
    let g = counts.get(k);
    if (!g) counts.set(k, (g = { count: 0, example: w, bn: new Map(), en: new Map() }));
    g.count++;
    if (w.meaningBn && w.meaningBn.trim()) g.bn.set(w.meaningBn, (g.bn.get(w.meaningBn) ?? 0) + 1);
    if (w.meaningEn && w.meaningEn.trim()) g.en.set(w.meaningEn, (g.en.get(w.meaningEn) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((x, y) => y[1].count - x[1].count || ordinal(x[0], y[0])).slice(0, size);
  const words: FrequentWordDto[] = [];
  let cum = 0, rank = 1;
  for (const [, g] of ordered) {
    cum += g.count;
    words.push({ rank: rank++, arabicText: g.example.arabicText, count: g.count, cumulativeCoveragePercent: total === 0 ? 0 : round2((100 * cum) / total), exampleKey: g.example.key, meaningBn: top(g.bn), audioPath: g.example.audioPath, meaningEn: top(g.en) });
  }
  return { totalWordTokens: total, distinctWords: counts.size, words, coveragePercent: words.length === 0 ? 0 : words[words.length - 1]!.cumulativeCoveragePercent, scope };
}

/** The first `size` words (1..1000) of a full track, with the coverage of exactly those words. */
export function sliceTrack(t: FrequencyTrackDto, size: number): FrequencyTrackDto {
  const words = t.words.slice(0, Math.min(1000, Math.max(1, size)));
  return { ...t, words, coveragePercent: words.length === 0 ? 0 : words[words.length - 1]!.cumulativeCoveragePercent };
}
