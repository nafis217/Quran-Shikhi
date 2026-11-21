import { describe, expect, it } from 'vitest';
import { LETTERS, formsOf, letterName } from './letters';
import { PRACTICE_WORDS, isBuilt, joinedForm, letterOf, newBuild, tapTile, wordLetters } from './words';
import { isCorrect, isMatch, makeMatch, makeQuestion } from './quiz';
import { scoreTrace } from './trace';
import { tr } from '../i18n';
import { surahName } from '../surahNames';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('letters', () => {
  it('has 28 unique letters and unique ids', () => {
    expect(LETTERS).toHaveLength(28);
    expect(new Set(LETTERS.map((l) => l.ch)).size).toBe(28);
    expect(new Set(LETTERS.map((l) => l.id)).size).toBe(28);
  });
  it('exactly six letters do not join forward', () => {
    expect(LETTERS.filter((l) => !l.joinsNext).map((l) => l.ch).sort()).toEqual(['ا', 'د', 'ذ', 'ر', 'ز', 'و'].sort());
  });
  it('names are non-empty in every language and unique within a language', () => {
    for (const lang of ['bn', 'en', 'ar'] as const) {
      const names = LETTERS.map((l) => letterName(l, lang));
      expect(names.every(Boolean)).toBe(true);
      expect(new Set(names).size).toBe(28);
    }
  });
  it('forms use zero-width joiners for joining letters', () => {
    expect(formsOf(LETTERS[1]!).initial).toBe('ب‍');
    expect(formsOf(LETTERS[1]!).medial).toBe('‍ب‍');
    expect(formsOf(LETTERS[0]!).initial).toBe('ا');
  });
});

describe('words and the builder', () => {
  it('every skeleton letter is one of the 28 letters, or ة (taa marbuta, a form of taa)', () => {
    for (const w of PRACTICE_WORDS) for (const ch of wordLetters(w)) if (ch !== 'ة') expect(letterOf(ch), `${w.id}:${ch}`).toBeDefined();
  });
  it('Allah skeleton is ا ل ل ه and bismillah joins into two words', () => {
    expect(joinedForm(PRACTICE_WORDS[0]!)).toBe('الله');
    expect(joinedForm(PRACTICE_WORDS[1]!)).toBe('بسم الله');
  });
  it('tapping in the right order completes the word; wrong taps count as mistakes', () => {
    const w = PRACTICE_WORDS[0]!; // ا ل ل ه (two identical lams)
    let s = newBuild(w, seeded(3));
    const wrong = s.tiles.find((t) => t.ch === 'ه')!; // 'ا' is expected first
    s = tapTile(s, wrong.id);
    expect(s.mistakes).toBe(1); expect(s.placed).toBe(0);
    for (const ch of wordLetters(w)) s = tapTile(s, s.tiles.find((t) => t.ch === ch && !t.used)!.id);
    expect(isBuilt(s)).toBe(true); expect(s.mistakes).toBe(1);
  });
  it('a used tile cannot be tapped twice', () => {
    let s = newBuild(PRACTICE_WORDS[5]!, seeded(2));
    const first = s.tiles.find((t) => t.ch === wordLetters(PRACTICE_WORDS[5]!)[0])!;
    s = tapTile(s, first.id); const again = tapTile(s, first.id);
    expect(again).toBe(s);
  });
});

describe('quiz and match', () => {
  it('has 4 distinct options including the answer, in every language and mode', () => {
    for (const lang of ['bn', 'en', 'ar'] as const)
      for (const mode of ['letter-to-name', 'name-to-letter'] as const)
        for (let i = 1; i <= 40; i++) {
          const q = makeQuestion(mode, lang, seeded(i));
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
          expect(q.options.some((o) => isCorrect(q, o))).toBe(true);
        }
  });
  it('match builds 2 cards per pair and pairs match only across kinds', () => {
    const cards = makeMatch(6, 'bn', seeded(9));
    expect(cards).toHaveLength(12);
    const a = cards.find((c) => c.kind === 'letter')!;
    const b = cards.find((c) => c.kind === 'name' && c.pairId === a.pairId)!;
    const other = cards.find((c) => c.kind === 'name' && c.pairId !== a.pairId)!;
    expect(isMatch(a, b)).toBe(true); expect(isMatch(a, other)).toBe(false); expect(isMatch(a, a)).toBe(false);
  });
});

describe('trace scoring', () => {
  const N = 100;
  const mask = (f: (i: number) => boolean) => Uint8Array.from({ length: N }, (_, i) => (f(i) ? 1 : 0));
  const core = mask((i) => i >= 40 && i < 60);
  const tolerant = mask((i) => i >= 30 && i < 70);
  it('passes when the ink follows the letter', () => {
    const r = scoreTrace(core, tolerant, mask((i) => i >= 38 && i < 62));
    expect(r.pass).toBe(true); expect(r.score).toBeGreaterThan(90);
  });
  it('fails on an empty drawing', () => {
    const r = scoreTrace(core, tolerant, mask(() => false));
    expect(r.pass).toBe(false); expect(r.score).toBe(0);
  });
  it('fails when the ink is far from the letter', () => {
    expect(scoreTrace(core, tolerant, mask((i) => i < 20)).pass).toBe(false);
  });
  it('fails when only a small part of the letter is covered', () => {
    expect(scoreTrace(core, tolerant, mask((i) => i >= 40 && i < 44)).pass).toBe(false);
  });
  it('fails when scribbling everywhere (low precision)', () => {
    expect(scoreTrace(core, tolerant, mask(() => true)).pass).toBe(false);
  });
  it('rejects masks of different sizes', () => {
    expect(() => scoreTrace([1], [1, 1], [1])).toThrow();
  });
});

describe('languages', () => {
  it('Arabic UI strings exist and differ from English', () => {
    expect(tr('ar', 'home')).toBe('الرئيسية');
    expect(tr('bn', 'home')).toBe('হোম');
    expect(tr('en', 'practice')).toBe('Practice Arabic');
  });
  it('surah names follow the language', () => {
    const ch = { id: 1, nameSimple: 'Al-Faatiha', nameArabic: 'سُورَةُ ٱلْفَاتِحَةِ' };
    expect(surahName('bn', ch)).toBe('আল-ফাতিহা');
    expect(surahName('en', ch)).toBe('Al-Faatiha');
    expect(surahName('ar', ch)).toBe('سُورَةُ ٱلْفَاتِحَةِ');
  });
  it('every phase-1 surah has a Bangla name', async () => {
    const { SURAH_BN } = await import('../surahNames');
    for (const id of [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)]) expect(SURAH_BN[id], String(id)).toBeTruthy();
  });
});

import { friendlyLatin } from '../pronText';
describe('friendly Latin', () => {
  it('replaces scholarly marks with plain letters', () => {
    expect(friendlyLatin('ar-raḥ-mā-ni')).toBe('ar-rah-maa-ni');
    expect(friendlyLatin('ʿa-lay-him')).toBe("'a-lay-him");
    expect(friendlyLatin('aṣ-ṣā-li-ḥā-ti')).toBe('as-saa-li-haa-ti');
    expect(friendlyLatin('qī-ʾū')).toBe("qee-'oo");
  });
  it('leaves plain letters and digraphs alone', () => {
    expect(friendlyLatin('dhi-kh-sh-th-gh')).toBe('dhi-kh-sh-th-gh');
  });
});

import { traceFeedback } from './trace';
describe('trace feedback', () => {
  const W = 20, H = 20;
  const grid = (f: (x: number, y: number) => boolean) => Uint8Array.from({ length: W * H }, (_, i) => (f(i % W, Math.floor(i / W)) ? 1 : 0));
  const core = grid((x, y) => x >= 5 && x < 15 && y >= 5 && y < 15);       // 10x10 square
  const tol = grid((x, y) => x >= 3 && x < 17 && y >= 3 && y < 17);
  it('reports nothing for a good trace', () => {
    const f = traceFeedback(core, tol, core, W);
    expect(f.missed).toBeNull(); expect(f.stray).toBeNull();
  });
  it('locates the missed part (bottom half not drawn)', () => {
    const f = traceFeedback(core, tol, grid((x, y) => x >= 5 && x < 15 && y >= 5 && y < 9), W);
    expect(f.missed).toBe('bottom');
    expect(f.overlay.some((v) => v === 1)).toBe(true);
  });
  it('locates the missed part on the left and right', () => {
    expect(traceFeedback(core, tol, grid((x, y) => x >= 10 && x < 15 && y >= 5 && y < 15), W).missed).toBe('left');
    expect(traceFeedback(core, tol, grid((x, y) => x >= 5 && x < 10 && y >= 5 && y < 15), W).missed).toBe('right');
  });
  it('flags ink far outside the letter and where it is', () => {
    const f = traceFeedback(core, tol, grid((x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15) || (x >= 18 && y >= 8 && y < 14) || y >= 18 ), W);
    expect(f.stray).not.toBeNull();
    expect(f.overlay.some((v) => v === 2)).toBe(true);
  });
  it('does not crash on an empty drawing', () => {
    const f = traceFeedback(core, tol, grid(() => false), W);
    expect(f.missed).toBeNull(); expect(f.missedShare).toBe(1);
  });
});

import { explainFinding } from './explain';
describe('explainFinding', () => {
  it('explains ʿayn heard as ḥaa with both places and the pair tip (the real learner mistake)', () => {
    const en = explainFinding({ type: 'Substitute', expected: 'ع', heard: 'ح' }, 'en');
    expect(en).toContain('instead of'); expect(en).toContain('voiced');
    expect(explainFinding({ type: 'Substitute', expected: 'ع', heard: 'ح' }, 'bn')).toContain('আইন');
    expect(explainFinding({ type: 'Substitute', expected: 'ع', heard: 'ح' }, 'ar')).toContain('العين');
  });
  it('explains haa heard differently, between different places', () => {
    expect(explainFinding({ type: 'Substitute', expected: 'ه', heard: 'ي' }, 'en')).toContain('bottom of the throat');
  });
  it('says when two letters share a place', () => {
    expect(explainFinding({ type: 'Substitute', expected: 'ع', heard: 'ح' }, 'en')).toContain('middle of the throat');
    expect(explainFinding({ type: 'Substitute', expected: 'ص', heard: 'س' }, 'en')).toContain('heavy');
  });
  it('explains vowel mistakes with vowel names in every language', () => {
    const f = { type: 'Vowel', letter: 'د', expected: 'u', heard: 'a' };
    expect(explainFinding(f, 'en')).toContain('damma'); expect(explainFinding(f, 'bn')).toContain('পেশ'); expect(explainFinding(f, 'ar')).toContain('ضمة');
  });
  it('explains missing shaddah as no shaddah', () => {
    expect(explainFinding({ type: 'Vowel', letter: 'ب', expected: 'Si', heard: 'i' }, 'en')).toContain('shaddah');
  });
  it('handles missing and extra letters and unknown types without crashing', () => {
    expect(explainFinding({ type: 'Missing', expected: 'ن' }, 'en')).toContain('not heard');
    expect(explainFinding({ type: 'Extra', heard: 'ي' }, 'bn')).toContain('বাড়তি');
    expect(explainFinding({ type: 'Whatever' }, 'en')).toBe('');
    expect(explainFinding({ type: 'Substitute', expected: 'x', heard: 'y' }, 'en')).toContain('instead of');
  });
});

import { AYAH_COUNTS, JUZ_STARTS, juzOf, juzSegments } from '../juz';
describe('juz and surah tables', () => {
  it('the Quran has 114 surahs and 6,236 ayahs', () => {
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(6236);
  });
  it('30 juz that together cover every ayah exactly once, in order', () => {
    expect(JUZ_STARTS).toHaveLength(30);
    let total = 0;
    const seen: string[] = [];
    for (let j = 1; j <= 30; j++) for (const s of juzSegments(j)) { total += s.to - s.from + 1; seen.push(`${s.surah}:${s.from}`); }
    expect(total).toBe(6236);
    expect(new Set(seen).size).toBe(seen.length);
  });
  it('known boundaries', () => {
    expect(juzSegments(1)).toEqual([{ surah: 1, from: 1, to: 7 }, { surah: 2, from: 1, to: 141 }]);
    expect(juzSegments(30)[0]).toEqual({ surah: 78, from: 1, to: 40 });
    expect(juzSegments(30).at(-1)).toEqual({ surah: 114, from: 1, to: 6 });
    expect(juzOf(2, 142)).toBe(2); expect(juzOf(2, 141)).toBe(1); expect(juzOf(114, 6)).toBe(30); expect(juzOf(1, 1)).toBe(1);
  });
  it('a juz that starts mid-surah and ends at the start of another', () => {
    expect(juzSegments(2).map((s) => s.surah)).toEqual([2]);
    expect(juzSegments(2)[0]).toEqual({ surah: 2, from: 142, to: 252 });
  });
  it('out-of-range juz is empty', () => { expect(juzSegments(0)).toEqual([]); expect(juzSegments(31)).toEqual([]); });
});
