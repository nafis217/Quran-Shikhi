/** Sounds Bangla letters cannot represent are marked: text carries a nukta (়), and `tag` lets the UI colour them. */
export type SoundTag = 'foreign' | 'throat' | 'heavy';

export interface Segment {
  text: string;
  tag?: SoundTag;
}

export interface Syllable {
  /** Bangla-script spelling of this syllable. */
  bn: string;
  /** Latin transliteration of this syllable. */
  latin: string;
  /** Same text as `bn`, split so the UI can colour marked sounds. */
  segments: Segment[];
}

export type NoteRule =
  | 'madd'
  | 'assimilated-lam'
  | 'assimilated'
  | 'shadda'
  | 'tanween'
  | 'silent-letter'
  | 'izhar-halqi'
  | 'idgham-ghunna'
  | 'idgham-bila-ghunna'
  | 'ikhfa'
  | 'iqlab'
  | 'idgham-shafawi'
  | 'ikhfa-shafawi'
  | 'izhar-shafawi';

export interface Note {
  rule: NoteRule;
  /** index of the syllable the note relates to, when known */
  syllable?: number;
  /** index of the word within an ayah (annotateAyah only) */
  wordIndex?: number;
}

export interface WordResult {
  arabic: string;
  bangla: string;
  latin: string;
  syllables: Syllable[];
  notes: Note[];
}
