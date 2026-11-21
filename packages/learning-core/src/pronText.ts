import type { Lang } from './i18n';

/** Bangla-script guide for Bangla users; Latin transliteration for everyone else. */
export const pronScript = (lang: Lang): 'bn' | 'latin' => (lang === 'bn' ? 'bn' : 'latin');

/**
 * Beginner-friendly Latin: scholarly marks are replaced by plain letters (ā→aa, ḥ→h, ṣ→s ...).
 * The engine keeps the exact scholarly form in `latin`; this is display only.
 */
export function friendlyLatin(s: string): string {
  return s
    .replace(/ā/g, 'aa').replace(/ī/g, 'ee').replace(/ū/g, 'oo')
    .replace(/ḥ/g, 'h').replace(/ṣ/g, 's').replace(/ḍ/g, 'd').replace(/ṭ/g, 't').replace(/ẓ/g, 'z')
    .replace(/[ʿʾ]/g, "'");
}

export const pronText = (p: { bangla: string; latin: string }, lang: Lang): string =>
  pronScript(lang) === 'bn' ? p.bangla : friendlyLatin(p.latin);

/** One syllable's text in the chosen script (Latin is friendly form). */
export const sylLatin = (latin: string): string => friendlyLatin(latin);
