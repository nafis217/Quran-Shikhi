import { describe, expect, it } from 'vitest';
import { compareRecitation, letterFindings, normalize, vowelSignature, type WordStatus } from '../src/aligner.ts';
import { buildFrequencyTrack } from '../src/frequency.ts';
import { parseMedia } from '../src/media.ts';
import { parseNews } from '../src/news.ts';
import { roundHalfEven, sm2Next } from '../src/sm2.ts';
import { detectPlaceholder, normalizeKey } from '../src/text.ts';
import type { AyahDto, WordDto } from '../src/types.ts';
import media from '../../../backend/src/QuranShikkha.Api/Content/media.json';

// ---- ported from the C# tests (same inputs, same expectations) ----
const EXP = ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَٰلَمِينَ'];
const statuses = (r: ReturnType<typeof compareRecitation>) => r.words.map((w) => w.status);

describe('RecitationAligner', () => {
  it('perfect recitation without vowel marks scores 100', () => {
    const r = compareRecitation(EXP, 'الحمد لله رب العالمين');
    expect(r.score).toBe(100); expect(statuses(r).every((s) => s === 'Correct')).toBe(true); expect(r.extraWords).toBe(0);
  });
  it('tolerates letter variants recognizers write inconsistently', () => {
    expect(compareRecitation(['ٱلْعَٰلَمِينَ', 'أَنْعَمْتَ'], 'العلمين انعمت').score).toBe(100);
  });
  it('a skipped word is reported missing', () => {
    const r = compareRecitation(EXP, 'الحمد لله العالمين');
    expect(r.words[2]!.status).toBe('Missing'); expect(r.words[2]!.heard).toBeNull(); expect(r.score).toBe(75);
  });
  it('a mispronounced word is flagged with what was heard', () => {
    const r = compareRecitation(EXP, 'الحمد لله ربي العالمين');
    expect(r.words[2]!.status).toBe('Close'); expect(r.words[2]!.heard).toBe('ربي');
    const r2 = compareRecitation(EXP, 'الحمد لله كتاب العالمين');
    expect(r2.words[2]!.status).toBe('Wrong'); expect(r2.score).toBeLessThan(r.score);
  });
  it('extra words are counted but do not break alignment', () => {
    const r = compareRecitation(EXP, 'الحمد لله رب رب العالمين');
    expect(r.extraWords).toBe(1); expect(r.words[3]!.status).toBe('Correct');
  });
  it('silence or noise scores zero with every word missing', () => {
    const r = compareRecitation(EXP, 'hello 123');
    expect(r.score).toBe(0); expect(statuses(r).every((s) => s === 'Missing')).toBe(true);
  });
  it('expected text is returned unchanged for display', () => expect(compareRecitation(EXP, 'العالمين').words[3]!.expected).toBe('ٱلْعَٰلَمِينَ'));
  it('normalize strips marks and folds variants', () => {
    expect(normalize('ٱلرَّحْمَٰنِ')).toBe(normalize('الرحمن'));
    expect(normalize('إِيَّاكَ')).toBe(normalize('اياك'));
  });
});

describe('vowel check', () => {
  const MODEL = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
  it('correct vowelled reading is fully correct despite spelling conventions', () => {
    const r = compareRecitation(EXP, MODEL);
    expect(r.vowelsChecked).toBe(true); expect(r.score).toBe(100); expect(statuses(r).every((s) => s === 'Correct')).toBe(true);
  });
  it('a changed vowel is flagged even though the letters match', () => {
    const r = compareRecitation(EXP, 'الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ');
    expect(r.words[0]!.status).toBe('Vowel'); expect(r.words[1]!.status).toBe('Correct');
    expect(r.score).toBeGreaterThanOrEqual(90); expect(r.score).toBeLessThanOrEqual(95);
  });
  it('a missing shaddah is flagged', () => expect(compareRecitation(EXP, 'الْحَمْدُ لِلَّهِ رَبِ الْعَالَمِينَ').words[2]!.status).toBe('Vowel'));
  it('final vowel of the last word is not penalised when stopping', () =>
    expect(compareRecitation(EXP, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينْ').words[3]!.status).toBe('Correct'));
  it('transcripts without vowels skip the vowel check', () => {
    const r = compareRecitation(EXP, 'الحمد لله رب العالمين'); expect(r.vowelsChecked).toBe(false); expect(r.score).toBe(100);
  });
  it.each([['الْحَمْدُ', false, 'a.u'], ['الْحَمْدُ', true, 'a'], ['رَبِّ', false, 'a.Si'], ['كِتَابٌ', false, 'i.a.U'], ['كِتَابٌ', true, 'i.a']] as const)(
    'signature %s drop=%s -> %s', (w, drop, exp) => expect(vowelSignature(w, drop)).toBe(exp));
});

describe('findings', () => {
  it('ayn heard as haa is that exact substitution', () => {
    const w = compareRecitation(EXP, 'الْحَمْدُ لِلَّهِ رَبِّ الْحَالَمِينَ').words[3]!;
    expect(w.status).not.toBe('Correct');
    expect(w.findings!.some((f) => f.type === 'Substitute' && f.expected === 'ع' && f.heard === 'ح')).toBe(true);
  });
  it('haa heard as ya+haa gives a substitution or an extra letter', () => {
    const w = compareRecitation(EXP, 'الْحَمْدُ لِلَّيْحِ رَبِّ الْعَالَمِينَ').words[1]!;
    expect(w.findings!.some((f) => f.type === 'Substitute' || f.type === 'Extra')).toBe(true);
  });
  it('missing letter is reported', () => expect(letterFindings('رحمن', 'رحم').some((x) => x.type === 'Missing' && x.expected === 'ن')).toBe(true));
  it('vowel finding names the letter and both vowels', () => {
    const w = compareRecitation(EXP, 'الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ').words[0]!;
    expect(w.status).toBe('Vowel' satisfies WordStatus);
    expect(w.findings).toHaveLength(1);
    expect(w.findings![0]).toMatchObject({ type: 'Vowel', letter: 'د', expected: 'u', heard: 'a' });
  });
  it('correct words have no findings', () =>
    expect(compareRecitation(EXP, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ').words.every((w) => w.findings === null)).toBe(true));
});

describe('SM-2', () => {
  it('first, second, third successes follow 1, 6, then ease multiple', () => {
    let s = { ease: 2.5, intervalDays: 0, repetitions: 0 };
    s = sm2Next(s, 5); expect(s.intervalDays).toBe(1);
    s = sm2Next(s, 5); expect(s.intervalDays).toBe(6);
    s = sm2Next(s, 5); expect(s.intervalDays).toBeGreaterThanOrEqual(15);
  });
  it('failure resets repetitions and lowers ease but not below the floor', () => {
    expect(sm2Next({ ease: 1.35, intervalDays: 20, repetitions: 5 }, 1)).toEqual({ ease: 1.3, intervalDays: 1, repetitions: 0 });
  });
  it.each([-1, 6, 2.5])('rejects bad quality %s', (q) => expect(() => sm2Next({ ease: 2.5, intervalDays: 0, repetitions: 0 }, q)).toThrow());
  it('rounds half to even like the original', () => { expect(roundHalfEven(2.5)).toBe(2); expect(roundHalfEven(3.5)).toBe(4); expect(roundHalfEven(2.6)).toBe(3); });
});

describe('tafsir placeholder', () => {
  it('detects the marker', () => expect(detectPlaceholder('আল্লাহ বলেন, (আরবি) এর অর্থ')).toBe(true));
  it('clean text and null are not flagged', () => { expect(detectPlaceholder('সাধারণ লেখা')).toBe(false); expect(detectPlaceholder(null)).toBe(false); });
});

const W = (key: string, ar: string, type = 'word', bn: string | null = null, en: string | null = null): WordDto =>
  ({ key, position: 1, arabicText: ar, audioPath: null, meaningBn: bn, meaningEn: en, translitLatin: null, charType: type });

describe('frequency track', () => {
  it('groups by unvoweled form and computes coverage', () => {
    const ayahs: AyahDto[] = [
      { key: '1:1', surah: 1, ayah: 1, words: [W('1:1:1', 'ٱللَّهِ'), W('1:1:2', 'رَبِّ'), W('1:1:3', '١', 'end')] },
      { key: '1:2', surah: 1, ayah: 2, words: [W('1:2:1', 'ٱللَّهَ'), W('1:2:2', 'رَبَّ'), W('1:2:3', 'نُورٌ')] },
    ];
    const t = buildFrequencyTrack(ayahs, 10, 'test');
    expect(t.totalWordTokens).toBe(5); expect(t.distinctWords).toBe(3); expect(t.words[0]!.count).toBe(2);
    expect(t.words[1]!.cumulativeCoveragePercent).toBe(80); expect(t.coveragePercent).toBe(100);
  });
  it('each word gets its most common meaning in both languages', () => {
    const M = (k: string, bn: string, en: string) => W(k, 'رَبِّ', 'word', bn, en);
    const t = buildFrequencyTrack([{ key: '1:1', surah: 1, ayah: 1, words: [M('1:1:1', 'প্রতিপালকের', 'of the Lord'), M('1:1:2', 'রব', 'Lord'), M('1:1:3', 'রব', 'Lord')] }], 5, 't');
    expect(t.words[0]!.meaningBn).toBe('রব'); expect(t.words[0]!.meaningEn).toBe('Lord');
  });
  it('display text is never altered, only the grouping key', () =>
    expect(buildFrequencyTrack([{ key: '1:1', surah: 1, ayah: 1, words: [W('1:1:1', 'ٱللَّهِ')] }], 5, 't').words[0]!.arabicText).toBe('ٱللَّهِ'));
  it('empty input gives zero coverage, not a crash', () => expect(buildFrequencyTrack([], 300, 't').coveragePercent).toBe(0));
  it('normalizeKey drops harakat and folds alef wasla', () => expect(normalizeKey('ٱللَّهِ')).toBe('الله'));
});

describe('media list', () => {
  it('keeps valid youtube items and drops anything else', () => {
    const items = parseMedia({ items: [
      { id: 'a', platform: 'youtube', videoId: 'AbCdEfGhIjK', title: 'Good', channel: 'C', age: 'kids', topic: 't' },
      { id: 'b', platform: 'youtube', videoId: 'too-short', title: 'Bad id', channel: 'C', age: 'kids', topic: 't' },
      { id: 'c', platform: 'youtube', videoId: 'AbCdEfGhIjK"><script>', title: 'Injected', channel: 'C', age: 'kids', topic: 't' },
      { id: 'd', platform: 'facebook', videoId: 'AbCdEfGhIjK', title: 'Other site', channel: 'C', age: 'kids', topic: 't' },
      { id: 'e', platform: 'youtube', videoId: 'AbCdEfGhIjK', title: 'Bad age', channel: 'C', age: 'toddlers', topic: 't' },
      { id: 'f', platform: 'youtube', videoId: 'zzzzzzzzzzz', title: '', channel: 'C', age: 'adults', topic: 't' },
    ] });
    expect(items).toHaveLength(1); expect(items[0]!.id).toBe('a');
  });
  it('the shipped list loads and covers both age groups', () => {
    const all = parseMedia(media);
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.some((m) => m.age === 'kids') && all.some((m) => m.age === 'adults')).toBe(true);
    expect(new Set(all.map((m) => m.videoId)).size).toBe(all.length);
  });
});

describe('news parsing', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title><![CDATA[عنوان <b>مهم</b> اليوم]]></title><link>https://example.org/a</link><pubDate>Sat, 21 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>no link</title><link></link></item>
    <item><title>js link</title><link>javascript:alert(1)</link></item>
    <item><title>Tom &amp; Jerry</title><link>https://example.org/b</link></item>
  </channel></rss>`;
  it('parses headlines, handles CDATA and html, and skips bad links', () => {
    const items = parseNews(xml, 'Test');
    expect(items.map((i) => i.title)).toEqual(['عنوان مهم اليوم', 'Tom & Jerry']);
    expect(items[0]!.link).toBe('https://example.org/a');
    expect(items[0]!.published).toBe('2026-11-21T10:00:00.000Z');
    expect(items[1]!.published).toBeNull();
  });
  it('refuses DOCTYPE / entity tricks', () => expect(parseNews('<!DOCTYPE x [<!ENTITY a "b">]><rss><item><title>x</title><link>https://a.b</link></item></rss>', 'T')).toEqual([]));
  it('caps the list at 25 and long titles at 220 characters', () => {
    const many = '<rss>' + Array.from({ length: 40 }, (_, i) => `<item><title>${'x'.repeat(300)}${i}</title><link>https://a.b/${i}</link></item>`).join('') + '</rss>';
    const items = parseNews(many, 'T'); expect(items).toHaveLength(25); expect(items[0]!.title.length).toBe(220);
  });
});
