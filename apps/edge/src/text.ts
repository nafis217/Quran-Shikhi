/** Strips harakat/Quranic marks so inflection-identical forms group together (grouping key only; display text is untouched). */
export function normalizeKey(arabic: string): string {
  let out = '';
  for (const c of arabic.normalize('NFD')) {
    if (/[\p{Mn}\p{Mc}]/u.test(c) || c === 'ـ') continue;
    out += c === 'ٱ' ? 'ا' : c; // alef wasla -> alef (key only)
  }
  return out;
}

export const PLACEHOLDER_MARKERS = ['(আরবি)', '（আরবি）', '[আরবি]'];
/** Detects "(আরবি)" placeholders in Bengali tafsir text. Never modifies the text. */
export const detectPlaceholder = (text: string | null | undefined): boolean => !!text && PLACEHOLDER_MARKERS.some((m) => text.includes(m));
