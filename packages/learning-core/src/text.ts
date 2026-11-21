import type { Lang } from './i18n';

/**
 * Picks the text for the UI language, falling back to the other one when missing.
 * The data only has Bangla and English; Arabic-UI users get English (the Arabic original is shown separately).
 */
export function pickByLang<T>(lang: Lang, bn: T | null | undefined, en: T | null | undefined): T | null {
  return lang === 'bn' ? bn ?? en ?? null : en ?? bn ?? null;
}
