import type { SoundTag } from './types';

export interface Consonant {
  bn: string;
  latin: string;
  tag?: SoundTag;
}

/**
 * Consonant table. Single source of truth for docs/pronunciation-rules.md.
 * NUKTA (়) = sound Bangla has no letter for. Known text-level collisions (told apart only by `tag`):
 *   ذ and ظ both write য ; the UI colours them differently.
 */
export const CONSONANTS: Readonly<Record<string, Consonant>> = {
  'ب': { bn: 'ব', latin: 'b' },
  'ت': { bn: 'ত', latin: 't' },
  'ث': { bn: 'ছ়', latin: 'th', tag: 'foreign' },
  'ج': { bn: 'জ', latin: 'j' },
  'ح': { bn: 'হ়', latin: 'ḥ', tag: 'throat' },
  'خ': { bn: 'খ়', latin: 'kh', tag: 'throat' },
  'د': { bn: 'দ', latin: 'd' },
  'ذ': { bn: 'য', latin: 'dh', tag: 'foreign' },
  'ر': { bn: 'র', latin: 'r' },
  'ز': { bn: 'জ়', latin: 'z', tag: 'foreign' },
  'س': { bn: 'স', latin: 's' },
  'ش': { bn: 'শ', latin: 'sh' },
  'ص': { bn: 'স়', latin: 'ṣ', tag: 'heavy' },
  'ض': { bn: 'দ়', latin: 'ḍ', tag: 'heavy' },
  'ط': { bn: 'ত়', latin: 'ṭ', tag: 'heavy' },
  'ظ': { bn: 'য', latin: 'ẓ', tag: 'heavy' },
  'غ': { bn: 'গ়', latin: 'gh', tag: 'throat' },
  'ف': { bn: 'ফ়', latin: 'f', tag: 'foreign' },
  'ق': { bn: 'ক়', latin: 'q', tag: 'heavy' },
  'ك': { bn: 'ক', latin: 'k' },
  'ک': { bn: 'ক', latin: 'k' },
  'ل': { bn: 'ল', latin: 'l' },
  'م': { bn: 'ম', latin: 'm' },
  'ن': { bn: 'ন', latin: 'n' },
  'ه': { bn: 'হ', latin: 'h' },
  'ة': { bn: 'ত', latin: 't' },
  'و': { bn: 'ওয়', latin: 'w' },
  'ي': { bn: 'য়', latin: 'y' },
  'ی': { bn: 'য়', latin: 'y' },
};

export type Vowel = 'a' | 'u' | 'i' | 'ā' | 'ū' | 'ī';

/** Dependent vowel sign after a consonant. Short a is the bare consonant (see rules doc: inherent-vowel caveat). */
export const VOWEL_SIGN: Readonly<Record<Vowel, string>> = { a: '', u: 'ু', i: 'ি', ā: 'া', ū: 'ূ', ī: 'ী' };
/** Independent vowel letters for hamza/ʿayn carriers. Short and long ā both write আ (Latin disambiguates). */
export const VOWEL_LETTER: Readonly<Record<Vowel, string>> = { a: 'আ', u: 'উ', i: 'ই', ā: 'আ', ū: 'ঊ', ī: 'ঈ' };
export const VOWEL_LATIN: Readonly<Record<Vowel, string>> = { a: 'a', u: 'u', i: 'i', ā: 'ā', ū: 'ū', ī: 'ī' };

export const HASANTA = '্';
export const NUKTA = '়';
/** Coda (sukun) renderings for letters that have no consonant in Bangla. */
export const HAMZA_CODA = { bn: 'ঽ', latin: 'ʾ' } as const;
export const AYN_CODA = { bn: 'ঽ়', latin: 'ʿ' } as const;
