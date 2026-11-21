import { describe, expect, it } from 'vitest';
import { CATEGORIES, VOCAB, categoryName, meaningOf, vocabById, wordsOf } from './vocab';
import { isVocabMatch, makeVocabMatch, makeVocabQuestion, optionLabel, toBuildWord, wordOfTheDay, type VocabQuizKind } from './games';
import { foldArabic, makeLookup } from './lookup';

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const HARAKAT = /[ً-ْٰ]/;

describe('vocabulary data', () => {
  it('has a substantial list with unique ids', () => {
    expect(VOCAB.length).toBeGreaterThanOrEqual(200);
    expect(new Set(VOCAB.map((w) => w.id)).size).toBe(VOCAB.length);
  });
  it('every word has Arabic with vowel marks, a Bangla meaning, an English meaning and a picture', () => {
    for (const w of VOCAB) {
      expect(HARAKAT.test(w.ar), `${w.id} lacks harakat`).toBe(true);
      expect(w.bn.trim(), w.id).not.toBe(''); expect(w.en.trim(), w.id).not.toBe(''); expect(w.emoji, w.id).not.toBe('');
    }
  });
  it('no two picture words share a picture, so a picture never has two right answers', () => {
    const seen = new Map<string, string>();
    for (const w of VOCAB.filter((x) => x.visual)) { expect(seen.has(w.emoji), `${w.id} repeats ${seen.get(w.emoji)}`).toBe(false); seen.set(w.emoji, w.id); }
  });
  it('categories cover every word, each with at least 8 words, named in three languages', () => {
    expect(CATEGORIES).toHaveLength(14);
    for (const c of CATEGORIES) { expect(wordsOf(c.id).length, c.id).toBeGreaterThanOrEqual(8); for (const l of ['bn', 'en', 'ar'] as const) expect(categoryName(c.id, l)).toBeTruthy(); }
    expect(CATEGORIES.reduce((n, c) => n + wordsOf(c.id).length, 0)).toBe(VOCAB.length);
  });
  it('meaning follows the language and ids resolve', () => {
    const w = vocabById('animals.cat')!;
    expect(meaningOf(w, 'bn')).toBe('বিড়াল'); expect(meaningOf(w, 'en')).toBe('Cat'); expect(w.ar).toBe('قِطَّة');
  });
  it('phrases and days are marked as having no picture', () => {
    expect(wordsOf('phrases').every((w) => !w.visual)).toBe(true);
    expect(wordsOf('days').every((w) => !w.visual)).toBe(true);
    expect(wordsOf('animals').every((w) => w.visual)).toBe(true);
  });
});

describe('vocabulary games', () => {
  const kinds: VocabQuizKind[] = ['picture-to-word', 'word-to-picture', 'listen-to-picture', 'meaning-to-word', 'word-to-meaning'];
  it('every question has distinct options and exactly one right answer, in every language', () => {
    for (const lang of ['bn', 'en', 'ar'] as const)
      for (const kind of kinds)
        for (let i = 1; i <= 25; i++) {
          const q = makeVocabQuestion(kind, VOCAB, lang, seeded(i));
          expect(q.options.length).toBeGreaterThanOrEqual(2); expect(q.options.length).toBeLessThanOrEqual(4);
          const labels = q.options.map((o) => optionLabel(kind, o, lang));
          expect(new Set(labels).size).toBe(labels.length);
          expect(q.options.filter((o) => o.id === q.target.id)).toHaveLength(1);
        }
  });
  it('picture questions never use words without a picture', () => {
    for (let i = 1; i <= 40; i++) expect(makeVocabQuestion('picture-to-word', VOCAB, 'en', seeded(i)).options.every((o) => o.visual)).toBe(true);
  });
  it('refuses a pool that is too small', () => {
    expect(() => makeVocabQuestion('picture-to-word', wordsOf('phrases'), 'en')).toThrow();
  });
  it('memory match builds two cards per picture word', () => {
    const cards = makeVocabMatch(6, wordsOf('animals'), seeded(3));
    expect(cards).toHaveLength(12);
    const a = cards.find((c) => c.kind === 'picture')!, b = cards.find((c) => c.kind === 'word' && c.pairId === a.pairId)!;
    expect(isVocabMatch(a, b)).toBe(true); expect(isVocabMatch(a, a)).toBe(false);
    expect(makeVocabMatch(6, wordsOf('days'))).toHaveLength(0);
  });
  it('word of the day is stable within a day and changes between days', () => {
    const d = new Date(Date.UTC(2026, 10, 21, 3)), d2 = new Date(Date.UTC(2026, 10, 21, 23));
    expect(wordOfTheDay(d).id).toBe(wordOfTheDay(d2).id);
    const ids = new Set(Array.from({ length: 30 }, (_, i) => wordOfTheDay(new Date(Date.UTC(2026, 10, 1 + i))).id));
    expect(ids.size).toBeGreaterThan(15);
  });
  it('spelling puzzle uses only Arabic letters, without marks', () => {
    const p = toBuildWord(vocabById('animals.cat')!);
    expect(p.parts).toEqual([['ق', 'ط', 'ة']]);
    for (const w of VOCAB) for (const ch of toBuildWord(w).parts.flat()) expect(/[ء-يٱ]/.test(ch), `${w.id}:${ch}`).toBe(true);
    expect(toBuildWord(vocabById('phrases.how-are-you')!).parts).toHaveLength(2);
  });
});

describe('word lookup for news', () => {
  const lookup = makeLookup([
    { ar: 'كِتَاب', en: 'Book', bn: 'বই', source: 'daily' },
    { ar: 'ٱلسَّمَآءُ', en: 'the sky', bn: 'আকাশ', source: 'quran' },
    { ar: 'مَاء', en: 'Water', bn: 'পানি', source: 'daily' },
  ]);
  it('folds marks and spelling variants', () => { expect(foldArabic('ٱلْكِتَابُ')).toBe('الكتاب'); expect(foldArabic('مَدْرَسَةٌ')).toBe('مدرسه'); });
  it('finds a word with the article and with an attached prefix', () => {
    expect(lookup('الكتاب')?.en).toBe('Book');
    expect(lookup('بالكتاب')?.en).toBe('Book');
    expect(lookup('وكتاب')?.en).toBe('Book');
    expect(lookup('السماء')?.source).toBe('quran');
  });
  it('returns null for unknown or too-short tokens', () => { expect(lookup('زبرجد')).toBeNull(); expect(lookup('و')).toBeNull(); expect(lookup('123')).toBeNull(); });
});
