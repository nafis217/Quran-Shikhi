import { describe, expect, it } from 'vitest';
import { transliterateWord } from '../src/index';

/** Opt-in: LIVE_API=http://localhost:5038 pnpm test. Runs the engine over every word of the whole Quran (all 114 surahs). */
const base = process.env['LIVE_API'];
const d = base ? describe : describe.skip;

d('live smoke: whole Quran', () => {
  it('no crashes, no empty output, no unmapped letters', async () => {
    const surahs = Array.from({ length: 114 }, (_, i) => i + 1);
    const problems: string[] = [];
    let words = 0;
    for (const s of surahs) {
      const ayahs = (await (await fetch(`${base}/api/v1/surahs/${s}/ayahs`)).json()) as { key: string; words: { arabicText: string; charType: string }[] }[];
      for (const a of ayahs) for (const w of a.words) {
        if (w.charType !== 'word') continue;
        words++;
        const r = transliterateWord(w.arabicText);
        if (!r.bangla) problems.push(`${a.key} empty: ${w.arabicText}`);
        const letters = [...w.arabicText].filter((c) => /[ء-يٱ]/.test(c)).length;
        if (r.syllables.length === 0 && letters > 0) problems.push(`${a.key} no syllables`);
      }
    }
    console.log(`checked ${words} words, ${problems.length} problems`, problems.slice(0, 15));
    expect(problems).toEqual([]);
  }, 600000);
});
