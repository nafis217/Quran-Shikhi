import { describe, expect, it } from 'vitest';
import { annotateAyah, transliterateWord } from '../src/index';

/**
 * GOLDEN CASES: Surah Al-Fatiha, every word of every ayah.
 * Expected values were derived BY HAND from docs/pronunciation-rules.md, independently of the code.
 * They freeze the current conventions; they have NOT yet been reviewed by a qualified Tajweed scholar.
 */
interface Golden { ar: string; syl: string[]; latin: string[] }
const G = (ar: string, syl: string[], latin: string[]): Golden => ({ ar, syl, latin });

const FATIHA: Record<string, Golden[]> = {
  '1:1': [
    G('بِسْمِ', ['বিস্', 'মি'], ['bis', 'mi']),
    G('ٱللَّهِ', ['আল্', 'লা', 'হি'], ['al', 'lā', 'hi']),
    G('ٱلرَّحْمَٰنِ', ['আর্', 'রহ়্', 'মা', 'নি'], ['ar', 'raḥ', 'mā', 'ni']),
    G('ٱلرَّحِيمِ', ['আর্', 'র', 'হ়ী', 'মি'], ['ar', 'ra', 'ḥī', 'mi']),
  ],
  '1:2': [
    G('ٱلْحَمْدُ', ['আল্', 'হ়ম্', 'দু'], ['al', 'ḥam', 'du']),
    G('لِلَّهِ', ['লিল্', 'লা', 'হি'], ['lil', 'lā', 'hi']),
    G('رَبِّ', ['রব্', 'বি'], ['rab', 'bi']),
    G('ٱلْعَٰلَمِينَ', ['আল্', 'আ়', 'ল', 'মী', 'ন'], ['al', 'ʿā', 'la', 'mī', 'na']),
  ],
  '1:3': [
    G('ٱلرَّحْمَٰنِ', ['আর্', 'রহ়্', 'মা', 'নি'], ['ar', 'raḥ', 'mā', 'ni']),
    G('ٱلرَّحِيمِ', ['আর্', 'র', 'হ়ী', 'মি'], ['ar', 'ra', 'ḥī', 'mi']),
  ],
  '1:4': [
    G('مَٰلِكِ', ['মা', 'লি', 'কি'], ['mā', 'li', 'ki']),
    G('يَوْمِ', ['য়ও', 'মি'], ['yaw', 'mi']),
    G('ٱلدِّينِ', ['আদ্', 'দী', 'নি'], ['ad', 'dī', 'ni']),
  ],
  '1:5': [
    G('إِيَّاكَ', ['ইয়্', 'য়া', 'ক'], ['iy', 'yā', 'ka']),
    G('نَعْبُدُ', ['নঽ়', 'বু', 'দু'], ['naʿ', 'bu', 'du']),
    G('وَإِيَّاكَ', ['ওয়', 'ইয়্', 'য়া', 'ক'], ['wa', 'ʾiy', 'yā', 'ka']),
    G('نَسْتَعِينُ', ['নস্', 'ত', 'ঈ়', 'নু'], ['nas', 'ta', 'ʿī', 'nu']),
  ],
  '1:6': [
    G('ٱهْدِنَا', ['ইহ্', 'দি', 'না'], ['ih', 'di', 'nā']),
    G('ٱلصِّرَٰطَ', ['আস়্', 'স়ি', 'রা', 'ত়'], ['aṣ', 'ṣi', 'rā', 'ṭa']),
    G('ٱلْمُسْتَقِيمَ', ['আল্', 'মুস্', 'ত', 'ক়ী', 'ম'], ['al', 'mus', 'ta', 'qī', 'ma']),
  ],
  '1:7': [
    G('صِرَٰطَ', ['স়ি', 'রা', 'ত়'], ['ṣi', 'rā', 'ṭa']),
    G('ٱلَّذِينَ', ['আল্', 'ল', 'যী', 'ন'], ['al', 'la', 'dhī', 'na']),
    G('أَنْعَمْتَ', ['আন্', 'আ়ম্', 'ত'], ['an', 'ʿam', 'ta']),
    G('عَلَيْهِمْ', ['আ়', 'লই', 'হিম্'], ['ʿa', 'lay', 'him']),
    G('غَيْرِ', ['গ়ই', 'রি'], ['ghay', 'ri']),
    G('ٱلْمَغْضُوبِ', ['আল্', 'মগ়্', 'দ়ূ', 'বি'], ['al', 'magh', 'ḍū', 'bi']),
    G('عَلَيْهِمْ', ['আ়', 'লই', 'হিম্'], ['ʿa', 'lay', 'him']),
    G('وَلَا', ['ওয়', 'লা'], ['wa', 'lā']),
    G('ٱلضَّآلِّينَ', ['আদ়্', 'দ়াল্', 'লী', 'ন'], ['aḍ', 'ḍāl', 'lī', 'na']),
  ],
};

const nfc = (a: string[]) => a.map((s) => s.normalize('NFC'));

describe('Al-Fatiha golden transliteration', () => {
  for (const [ayah, words] of Object.entries(FATIHA)) {
    describe(`ayah ${ayah}`, () => {
      words.forEach((g, i) => {
        it(`word ${i + 1}: ${g.ar}`, () => {
          const r = transliterateWord(g.ar);
          expect(r.syllables.map((s) => s.bn)).toEqual(nfc(g.syl));
          expect(r.syllables.map((s) => s.latin)).toEqual(g.latin);
          expect(r.bangla).toBe(nfc(g.syl).join(''));
          expect(r.arabic).toBe(g.ar); // Quran text is never altered
        });
      });
    });
  }

  it('covers all 7 ayahs and 29 word instances', () => {
    expect(Object.keys(FATIHA)).toHaveLength(7);
    expect(Object.values(FATIHA).flat()).toHaveLength(29);
  });

  it('segments rejoin to the syllable text', () => {
    for (const g of Object.values(FATIHA).flat()) {
      for (const s of transliterateWord(g.ar).syllables) expect(s.segments.map((x) => x.text).join('')).toBe(s.bn);
    }
  });

  it('marks sounds Bangla cannot write (ṣ ḥ ʿ q gh ṭ ḍ) with a tag and a nukta', () => {
    const r = transliterateWord('ٱلصِّرَٰطَ');
    const tagged = r.syllables.flatMap((s) => s.segments).filter((x) => x.tag);
    expect(tagged.length).toBeGreaterThan(0);
    for (const t of tagged) expect(t.text.normalize('NFD')).toContain('়');
    expect(transliterateWord('نَعْبُدُ').syllables[0]!.segments.some((s) => s.tag === 'throat')).toBe(true);
  });
});

describe('Al-Fatiha Tajweed annotations (annotation only; Bangla text is unchanged)', () => {
  const rules = (ayah: string) => annotateAyah(FATIHA[ayah]!.map((g) => g.ar)).map((n) => `${n.wordIndex}:${n.rule}`);

  it('1:2 — mim sakin before dal in ٱلْحَمْدُ is clear (izhar shafawi)', () => {
    expect(rules('1:2')).toContain('0:izhar-shafawi');
  });
  it('1:7 — nun sakin before ʿayn is izhar halqi; mim sakin before ghayn/waw is izhar shafawi', () => {
    const r = rules('1:7');
    expect(r).toContain('2:izhar-halqi');   // أَنْعَمْتَ
    expect(r).toContain('2:izhar-shafawi'); // mim before ت
    expect(r).toContain('3:izhar-shafawi'); // عَلَيْهِمْ → غَيْرِ
    expect(r).toContain('6:izhar-shafawi'); // عَلَيْهِمْ → وَلَا
  });
  it('ayahs without nun/mim sakin rules produce none', () => {
    expect(rules('1:1')).toEqual([]);
    expect(rules('1:3')).toEqual([]);
  });
});
