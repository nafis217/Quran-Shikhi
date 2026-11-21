/**
 * Builds response bodies as TEXT from rows that already hold JSON (no parsing), so a request costs almost no CPU.
 * Shared by the server (fallback from D1) and the seed script (which uploads the finished bodies to KV).
 */
export interface TextRow { ayah: number; body: string }

export const surahTextsJson = (language: string, source: string, attribution: string | null, rows: TextRow[]): string =>
  `{"language":${JSON.stringify(language)},"source":${JSON.stringify(source)},"version":null,"attribution":${JSON.stringify(attribution)},"ayahs":[${rows.map((r) => `{"ayah":${r.ayah},"text":${r.body}}`).join(',')}]}`;

export const SOURCE_EN = 'Saheeh International (api.alquran.cloud, dev only)';
export const SOURCE_AR = 'التفسير الميسر (api.alquran.cloud, dev only)';

/** Source label and attribution for a translation language. */
export const translationMeta = (lang: 'bn' | 'en' | 'ar'): [string, string | null] =>
  lang === 'bn' ? ['QuranEnc.com', 'QuranEnc.com'] : lang === 'en' ? [SOURCE_EN, null] : [SOURCE_AR, null];

/** KV keys for the whole-surah bodies. */
export const kvKey = {
  ayahs: (n: number) => `a:${n}`,
  translations: (lang: string, n: number) => `tr:${lang}:${n}`,
  tafsir: (lang: string, n: number) => `tf:${lang}:${n}`,
  frequent: (size: number) => `fq:${size}`,
};
export const KV_KEY_PATTERN = /^(a:\d{1,3}|tr:(bn|en|ar):\d{1,3}|tf:(bn|en|ar):\d{1,3}|fq:\d{1,4})$/;
