import { describe, expect, it } from 'vitest';
import { annotateAyah, transliterateWord } from '../src/index';

const bn = (w: string) => transliterateWord(w).syllables.map((s) => s.bn);
const lat = (w: string) => transliterateWord(w).syllables.map((s) => s.latin);

describe('conventions (synthetic words)', () => {
  it('tanween adds a final n (kitābun / kitāban / kitābin)', () => {
    expect(lat('كِتَابٌ')).toEqual(['ki', 'tā', 'bun']);
    expect(lat('كِتَابًا')).toEqual(['ki', 'tā', 'ban']); // alef after fathatan is silent
    expect(lat('كِتَابٍ')).toEqual(['ki', 'tā', 'bin']);
  });
  it('shaddah doubles the letter across a syllable break', () => {
    expect(lat('رَبَّ')).toEqual(['rab', 'ba']);
  });
  it('sukun consonant closes the syllable', () => {
    expect(lat('مَنْ')).toEqual(['man']);
  });
  it('madd: damma+waw = ū, kasra+ya = ī, fatha+alef = ā', () => {
    expect(lat('يَقُولُ')).toEqual(['ya', 'qū', 'lu']);
    expect(lat('قِيلَ')).toEqual(['qī', 'la']);
    expect(lat('قَالَ')).toEqual(['qā', 'la']);
  });
  it('silent alef after final waw is not pronounced', () => {
    expect(lat('قَالُوا')).toEqual(['qā', 'lū']);
  });
  it('diphthongs aw / ay', () => {
    expect(lat('لَوْ')).toEqual(['law']);
    expect(lat('بَيْتٌ').join('')).toBe('baytun');
  });
  it('small waw/yeh marks lengthen the vowel (لَهُۥ)', () => {
    expect(lat('لَهُۥ')).toEqual(['la', 'hū']);
    expect(lat('بِهِۦ')).toEqual(['bi', 'hī']);
  });
  it('alef maksura after fatha is long ā', () => {
    expect(lat('هُدَى')).toEqual(['hu', 'dā']);
  });
  it('alef madda ٱلضَّآلِّينَ carries a madd note', () => {
    expect(transliterateWord('ٱلضَّآلِّينَ').notes.some((n) => n.rule === 'madd')).toBe(true);
  });
  it('hamzat wasl: article = al, verb with damma = u, otherwise i', () => {
    expect(lat('ٱلْكِتَٰبُ')[0]).toBe('al');
    expect(lat('ٱدْعُ')[0]).toBe('ud');
    expect(lat('ٱهْدِنَا')[0]).toBe('ih');
  });
  it('tatweel before the dagger alef does not change the result', () => {
    expect(bn('ٱلرَّحْمَـٰنِ')).toEqual(bn('ٱلرَّحْمَٰنِ'));
  });
  it('Allah gets its long ā whether or not the dagger alef is written', () => {
    expect(lat('ٱللَّهِ')).toEqual(lat('ٱللَّٰهِ'));
    expect(lat('وَٱللَّهِ').at(-2)).toBe('lā');
  });
  it('never throws on empty, non-Arabic or mark-only input', () => {
    for (const w of ['', 'abc', 'َ', '١', '۝']) expect(() => transliterateWord(w)).not.toThrow();
    expect(transliterateWord('').bangla).toBe('');
  });
  it('input is returned unchanged', () => {
    const w = 'ٱلرَّحْمَـٰنِ';
    expect(transliterateWord(w).arabic).toBe(w);
  });
});

describe('cross-word Tajweed annotation', () => {
  const r = (a: string[]) => annotateAyah(a).map((n) => n.rule);
  it('tanween + ba = iqlab; + ya = idgham with ghunna; + ra = idgham without; + ka = ikhfa', () => {
    expect(r(['كِتَابٌ', 'بَعِيدٌ'])).toContain('iqlab');
    expect(r(['رَحِيمٍ', 'يَوْمٍ'])).toContain('idgham-ghunna');
    expect(r(['رَحِيمٍ', 'رَبٍّ'])).toContain('idgham-bila-ghunna');
    expect(r(['رَحِيمٍ', 'كَرِيمٍ'])).toContain('ikhfa');
  });
  it('mim sakin: before ba ikhfa shafawi, before mim idgham shafawi', () => {
    expect(r(['هُمْ', 'بِهِ'])).toContain('ikhfa-shafawi');
    expect(r(['لَهُمْ', 'مَا'])).toContain('idgham-shafawi');
  });
  it('the last word of an ayah has no cross-word rule', () => {
    expect(r(['مِنْ'])).toEqual([]);
  });
});

describe('regressions found by the live smoke test', () => {
  it('alef maksura carrying a vowel or shaddah is treated as ya, not a crash', () => {
    expect(() => transliterateWord('ىَ')).not.toThrow();
    expect(transliterateWord('ىَ').latin).toBe('ya');
  });
});
