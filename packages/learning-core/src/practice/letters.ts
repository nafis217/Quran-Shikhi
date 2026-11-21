import type { Lang } from '../i18n';

export interface Letter {
  id: string;
  ch: string;
  ar: string;      // name in Arabic
  bn: string;      // name in Bangla script (to be reviewed by a teacher)
  en: string;
  latin: string;   // approximate sound
  /** false for the six letters that never join to the next letter: ا د ذ ر ز و */
  joinsNext: boolean;
}

const L = (id: string, ch: string, ar: string, bn: string, en: string, latin: string, joinsNext = true): Letter =>
  ({ id, ch, ar, bn, en, latin, joinsNext });

/** The 28 letters in alphabetical order. Bangla names are conventional spellings and still need a teacher's review. */
export const LETTERS: readonly Letter[] = [
  L('alif', 'ا', 'ألف', 'আলিফ', 'Alif', 'ā', false),
  L('baa', 'ب', 'باء', 'বা', 'Baa', 'b'),
  L('taa', 'ت', 'تاء', 'তা', 'Taa', 't'),
  L('thaa', 'ث', 'ثاء', 'ছা', 'Thaa', 'th'),
  L('jeem', 'ج', 'جيم', 'জীম', 'Jeem', 'j'),
  L('haa-h', 'ح', 'حاء', 'হ়া', 'Ḥaa', 'ḥ'),
  L('khaa', 'خ', 'خاء', 'খ়া', 'Khaa', 'kh'),
  L('daal', 'د', 'دال', 'দাল', 'Daal', 'd', false),
  L('dhaal', 'ذ', 'ذال', 'যাল', 'Dhaal', 'dh', false),
  L('raa', 'ر', 'راء', 'রা', 'Raa', 'r', false),
  L('zaay', 'ز', 'زاي', 'যাই', 'Zaay', 'z', false),
  L('seen', 'س', 'سين', 'সীন', 'Seen', 's'),
  L('sheen', 'ش', 'شين', 'শীন', 'Sheen', 'sh'),
  L('saad', 'ص', 'صاد', 'ছোয়াদ', 'Ṣaad', 'ṣ'),
  L('daad', 'ض', 'ضاد', 'দোয়াদ', 'Ḍaad', 'ḍ'),
  L('taa-h', 'ط', 'طاء', 'তোয়া', 'Ṭaa', 'ṭ'),
  L('zaa-h', 'ظ', 'ظاء', 'জোয়া', 'Ẓaa', 'ẓ'),
  L('ayn', 'ع', 'عين', 'আইন', 'ʿAyn', 'ʿ'),
  L('ghayn', 'غ', 'غين', 'গাইন', 'Ghayn', 'gh'),
  L('faa', 'ف', 'فاء', 'ফা', 'Faa', 'f'),
  L('qaaf', 'ق', 'قاف', 'ক্বাফ', 'Qaaf', 'q'),
  L('kaaf', 'ك', 'كاف', 'কাফ', 'Kaaf', 'k'),
  L('laam', 'ل', 'لام', 'লাম', 'Laam', 'l'),
  L('meem', 'م', 'ميم', 'মীম', 'Meem', 'm'),
  L('noon', 'ن', 'نون', 'নূন', 'Noon', 'n'),
  L('haa', 'ه', 'هاء', 'হা', 'Haa', 'h'),
  L('waaw', 'و', 'واو', 'ওয়াও', 'Waaw', 'w', false),
  L('yaa', 'ي', 'ياء', 'ইয়া', 'Yaa', 'y'),
];

export const letterName = (l: Letter, lang: Lang): string => (lang === 'bn' ? l.bn : lang === 'ar' ? l.ar : l.en);

const ZWJ = '‍';
export interface Forms { isolated: string; initial: string; medial: string; final: string; initialJoins: boolean }

/** Contextual forms rendered by the font via zero-width joiners. Non-connecting letters have no true initial/medial form. */
export function formsOf(l: Letter): Forms {
  return l.joinsNext
    ? { isolated: l.ch, initial: l.ch + ZWJ, medial: ZWJ + l.ch + ZWJ, final: ZWJ + l.ch, initialJoins: true }
    : { isolated: l.ch, initial: l.ch, medial: ZWJ + l.ch, final: ZWJ + l.ch, initialJoins: false };
}
