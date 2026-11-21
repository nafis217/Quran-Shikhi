import { describe, expect, it } from 'vitest';
import { VOCAB } from '@quran-shikkha/learning-core';
import { transliterateWord } from '../src/index';

/** The everyday words are not Quran text, but the same engine writes their pronunciation guide. */
describe('pronunciation guide for the daily vocabulary', () => {
  it('produces a non-empty Bangla and Latin guide with syllables for every word of every phrase, without crashing', () => {
    for (const w of VOCAB) for (const token of w.ar.split(/\s+/).filter(Boolean)) {
      const r = transliterateWord(token);
      expect(r.bangla, `${w.id}:${token}`).not.toBe('');
      expect(r.latin, `${w.id}:${token}`).not.toBe('');
      expect(r.syllables.length).toBeGreaterThan(0);
    }
  });
  it('a few well-known words read as expected', () => {
    const lat = (ar: string) => transliterateWord(ar).syllables.map((s) => s.latin).join('-');
    expect(lat('كِتَاب')).toBe('ki-tāb');
    expect(lat('شُكْرًا')).toBe('shuk-ran');
    expect(lat('مَاء')).toBe('mā');
    expect(lat('بَيْت')).toBe('bayt');
    expect(lat('قِطَّة')).toBe('qiṭ-ṭah');
    expect(lat('فَرَاشَة')).toBe('fa-rā-shah');
    expect(lat('مَدْرَسَة')).toBe('mad-ra-sah');
    expect(lat('ٱلصَّلَوٰةَ').endsWith('ta')).toBe(true); // with its vowel mark the Quranic spelling keeps the "t"
  });
});
