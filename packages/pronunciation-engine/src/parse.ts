export const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ';
export const FATHATAN = 'ً', DAMMATAN = 'ٌ', KASRATAN = 'ٍ';
export const SHADDA = 'ّ', SUKUN = 'ْ', MADDAH = 'ٓ';
export const DAGGER_ALEF = 'ٰ';

export interface Unit {
  ch: string;
  marks: Set<string>;
}

const TATWEEL = 'ـ';

function isMark(c: string): boolean {
  const n = c.charCodeAt(0);
  return (
    (n >= 0x064b && n <= 0x065f) || n === 0x0670 ||
    (n >= 0x06d6 && n <= 0x06ed) || (n >= 0x08d3 && n <= 0x08ff)
  );
}

function isLetter(c: string): boolean {
  const n = c.charCodeAt(0);
  return (n >= 0x0621 && n <= 0x063a) || (n >= 0x0641 && n <= 0x064a) || n === 0x0671 || n === 0x06a9 || n === 0x06cc;
}

/** Splits a word into base letters with their attached marks. Input text is never modified. */
export function parseUnits(word: string): Unit[] {
  const units: Unit[] = [];
  for (const c of word) {
    if (c === TATWEEL) continue;
    if (isMark(c)) units[units.length - 1]?.marks.add(c);
    else if (isLetter(c)) units.push({ ch: c, marks: new Set() });
  }
  return units;
}

export function vowelOf(u: Unit): 'a' | 'u' | 'i' | undefined {
  if (u.marks.has(FATHA) || u.marks.has(FATHATAN)) return 'a';
  if (u.marks.has(DAMMA) || u.marks.has(DAMMATAN)) return 'u';
  if (u.marks.has(KASRA) || u.marks.has(KASRATAN)) return 'i';
  return undefined;
}

export const hasSukun = (u: Unit) => u.marks.has(SUKUN) || u.marks.has('ۡ');
export const hasShadda = (u: Unit) => u.marks.has(SHADDA);
export const tanweenOf = (u: Unit) => u.marks.has(FATHATAN) || u.marks.has(DAMMATAN) || u.marks.has(KASRATAN);
export const isSilentMarked = (u: Unit) => u.marks.has('۟') || u.marks.has('۠');
export const hasMadd = (u: Unit) => u.marks.has(MADDAH) || u.marks.has('ۤ');
export const hasNoMarks = (u: Unit) =>
  !vowelOf(u) && !hasSukun(u) && !hasShadda(u) && !u.marks.has(DAGGER_ALEF) && !u.marks.has('ۥ') && !u.marks.has('ۦ') && !hasMadd(u);
