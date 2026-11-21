import type { AyahDto, ChapterDto, WordDto } from './types.ts';

/**
 * Where the content comes from (prototype sources, no credentials; see docs/data-licenses.md). These functions run in the
 * SEED SCRIPT on a computer, never inside a request: parsing the big payloads would blow the free plan's 10 ms CPU limit.
 */
export type Fetcher = (url: string) => Promise<string>;

const QDC = 'https://api.qurancdn.com/api/qdc/';
const ALQ = 'https://api.alquran.cloud/v1/';
const TAFSIR = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/';
/** jsDelivr refuses some large files ("package size exceeded"); GitHub's raw host serves the same files. */
const TAFSIR_RAW = 'https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/';
async function tafsirFile(path: string, f: Fetcher): Promise<string> {
  try { return await f(TAFSIR + path); } catch { return f(TAFSIR_RAW + path); }
}
const ENC = 'https://quranenc.com/api/v1/';

export const TAFSIRS = {
  bn: { slug: 'bn-tafseer-ibn-e-kaseer', name: 'তাফসীর ইবনে কাসীর', attribution: 'Tawheed Publication' },
  en: { slug: 'en-tafisr-ibn-kathir', name: 'Tafsir Ibn Kathir (abridged)', attribution: 'Hafiz Ibn Kathir' },
  ar: { slug: 'ar-tafsir-muyassar', name: 'التفسير الميسر', attribution: 'King Fahd Complex' },
} as const;
export const ASBAB_SLUG = 'en-asbab-al-nuzul-by-al-wahidi';
export const QURANENC_KEY = 'bengali_zakaria';

export async function fetchChapters(f: Fetcher): Promise<ChapterDto[]> {
  const d = JSON.parse(await f(`${ALQ}surah`)) as { data: { number: number; englishName: string; name: string; englishNameTranslation: string | null; numberOfAyahs: number }[] };
  return d.data.map((s) => ({ id: s.number, nameSimple: s.englishName ?? '', nameArabic: s.name ?? '', translatedName: s.englishNameTranslation ?? null, versesCount: s.numberOfAyahs }));
}

interface QdcWord { position: number; text_uthmani?: string; audio_url?: string | null; translation?: { text?: string }; char_type_name?: string }
interface QdcVerse { verse_key: string; words: QdcWord[] }

async function qdcWords(surah: number, lang: 'bn' | 'en', f: Fetcher): Promise<AyahDto[]> {
  const ayahs: AyahDto[] = [];
  for (let page = 1; ; page++) {
    const d = JSON.parse(await f(`${QDC}verses/by_chapter/${surah}?words=true&word_translation_language=${lang}&word_fields=text_uthmani&per_page=300&page=${page}`)) as { verses: QdcVerse[]; pagination?: { next_page?: number | null } };
    for (const v of d.verses) {
      const n = Number(v.verse_key.split(':')[1]);
      const words: WordDto[] = v.words.map((w) => {
        const text = w.text_uthmani ?? '';
        // the source sometimes labels a verse-number mark (e.g. "١٨١" in 2:181) as a word: a token with no Arabic letter is not a word
        const isWord = [...text].some((ch) => (ch >= 'ء' && ch <= 'ي') || ch === 'ٱ');
        return {
          key: `${v.verse_key}:${w.position}`, position: w.position, arabicText: text,
          audioPath: typeof w.audio_url === 'string' ? w.audio_url : null,
          meaningBn: w.translation?.text ?? null, meaningEn: null, translitLatin: null,
          charType: !isWord ? 'end' : (w.char_type_name ?? 'word'),
        };
      });
      ayahs.push({ key: v.verse_key, surah, ayah: n, words });
    }
    if (typeof d.pagination?.next_page !== 'number') break;
  }
  return ayahs;
}

/** Last resort when the word API is unreachable: words are the ayah split on spaces, no meanings. */
async function spaceSplit(surah: number, f: Fetcher): Promise<AyahDto[]> {
  const d = JSON.parse(await f(`${ALQ}surah/${surah}/quran-uthmani`)) as { data: { ayahs: { numberInSurah: number; text: string }[] } };
  return d.data.ayahs.map((a) => {
    const key = `${surah}:${a.numberInSurah}`;
    const tokens: string[] = [];
    let pending = '';
    for (const t of a.text.replaceAll('﻿', '').split(' ').filter(Boolean)) {
      const hasLetter = [...t].some((ch) => (ch >= 'ء' && ch <= 'ي') || ch === 'ٱ');
      if (hasLetter) { tokens.push(pending + t); pending = ''; }
      else if (tokens.length > 0) tokens[tokens.length - 1] += ' ' + t;
      else pending += t + ' ';
    }
    const pad = (x: number) => String(x).padStart(3, '0');
    return { key, surah, ayah: a.numberInSurah, words: tokens.map((t, i) => ({ key: `${key}:${i + 1}`, position: i + 1, arabicText: t, audioPath: `wbw/${pad(surah)}_${pad(a.numberInSurah)}_${pad(i + 1)}.mp3`, meaningBn: null, meaningEn: null, translitLatin: null, charType: 'word' })) };
  });
}

/** Words of a whole surah with Bangla and English meanings merged. */
export async function fetchWords(surah: number, f: Fetcher): Promise<AyahDto[]> {
  try {
    const bn = await qdcWords(surah, 'bn', f);
    let en: AyahDto[] | null = null;
    try { en = await qdcWords(surah, 'en', f); } catch { /* English meanings are optional */ }
    if (bn.length > 0) {
      const enBy = new Map<string, string | null>();
      for (const a of en ?? []) for (const w of a.words) enBy.set(w.key, w.meaningBn);
      return bn.map((a) => ({ ...a, words: a.words.map((w) => ({ ...w, meaningEn: enBy.get(w.key) ?? null })) }));
    }
  } catch { /* fall back below */ }
  return spaceSplit(surah, f);
}

const clean = (s: string) => s.replaceAll('﻿', '');

/** Saheeh International (en) or Muyassar (ar) from alquran.cloud, as the C# version did. */
export async function fetchAlquranTexts(surah: number, lang: 'en' | 'ar', f: Fetcher): Promise<{ ayah: number; text: string }[]> {
  const edition = lang === 'en' ? 'en.sahih' : 'ar.muyassar';
  const d = JSON.parse(await f(`${ALQ}surah/${surah}/${edition}`)) as { data: { ayahs: { numberInSurah: number; text: string }[] } };
  return d.data.ayahs.map((a) => ({ ayah: a.numberInSurah, text: clean(a.text ?? '') }));
}

/** QuranEnc Bengali. Text is passed through UNMODIFIED. */
export async function fetchQuranEncBn(surah: number, f: Fetcher): Promise<{ ayah: number; text: string }[]> {
  const d = JSON.parse(await f(`${ENC}translation/sura/${QURANENC_KEY}/${surah}`)) as { result: { aya: string; translation: string }[] };
  return d.result.map((r) => ({ ayah: parseInt(r.aya, 10), text: r.translation ?? '' }));
}

export async function fetchTafsir(lang: 'bn' | 'en' | 'ar', surah: number, f: Fetcher): Promise<{ ayah: number; text: string }[]> {
  const d = JSON.parse(await tafsirFile(`${TAFSIRS[lang].slug}/${surah}.json`, f)) as { ayah: number; text: string }[];
  return d.map((a) => ({ ayah: a.ayah, text: a.text ?? '' })).filter((a) => a.text.length > 0);
}

/** Reason for revelation (Al-Wahidi). Only ayahs with an entry are returned. */
export async function fetchAsbab(surah: number, f: Fetcher): Promise<{ ayah: number; text: string }[]> {
  const d = JSON.parse(await tafsirFile(`${ASBAB_SLUG}/${surah}.json`, f)) as { ayahs: { ayah: number; text: string }[] };
  return d.ayahs.map((a) => ({ ayah: a.ayah, text: a.text ?? '' })).filter((a) => a.text.trim().length > 0);
}

/** Ayah audio (Alafasy). */
export async function fetchAudio(surah: number, f: Fetcher): Promise<{ reciter: string; urls: { ayah: number; text: string }[] }> {
  const d = JSON.parse(await f(`${ALQ}surah/${surah}/ar.alafasy`)) as { data: { edition: { englishName: string }; ayahs: { numberInSurah: number; audio: string }[] } };
  return { reciter: d.data.edition.englishName, urls: d.data.ayahs.map((a) => ({ ayah: a.numberInSurah, text: a.audio })) };
}
