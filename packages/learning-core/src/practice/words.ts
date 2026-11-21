import type { Lang } from '../i18n';
import { LETTERS, type Letter } from './letters';

export interface PracticeWord {
  id: string;
  /** vowelled display form; for Quranic words this is the Uthmani text as it appears in the Quran */
  display: string;
  /** consonant skeleton, one entry per word (a phrase has several) */
  parts: string[][];
  label: Record<Lang, string>;
}

const W = (id: string, display: string, parts: string[][], bn: string, en: string, ar: string): PracticeWord =>
  ({ id, display, parts, label: { bn, en, ar } });

export const PRACTICE_WORDS: readonly PracticeWord[] = [
  W('allah', 'ٱللَّهِ', [['ا', 'ل', 'ل', 'ه']], 'আল্লাহ', 'Allah', 'الله'),
  W('bismillah', 'بِسْمِ ٱللَّهِ', [['ب', 'س', 'م'], ['ا', 'ل', 'ل', 'ه']], 'বিসমিল্লাহ', 'Bismillah', 'بسم الله'),
  W('rahman', 'ٱلرَّحْمَٰنِ', [['ا', 'ل', 'ر', 'ح', 'م', 'ن']], 'আর-রাহমান', 'Ar-Rahman', 'الرحمن'),
  W('rahim', 'ٱلرَّحِيمِ', [['ا', 'ل', 'ر', 'ح', 'ي', 'م']], 'আর-রাহীম', 'Ar-Rahim', 'الرحيم'),
  W('alhamd', 'ٱلْحَمْدُ', [['ا', 'ل', 'ح', 'م', 'د']], 'আল-হামদ', 'Al-Hamd', 'الحمد'),
  W('rabb', 'رَبِّ', [['ر', 'ب']], 'রব', 'Rabb', 'رب'),
  W('nur', 'نُور', [['ن', 'و', 'ر']], 'নূর', 'Nur', 'نور'),
  W('kitab', 'كِتَاب', [['ك', 'ت', 'ا', 'ب']], 'কিতাব', 'Kitab', 'كتاب'),
  W('salat', 'صَلَاة', [['ص', 'ل', 'ا', 'ة']], 'সালাত', 'Salat', 'صلاة'),
  W('islam', 'إِسْلَام', [['ا', 'س', 'ل', 'ا', 'م']], 'ইসলাম', 'Islam', 'إسلام'),
];

export const wordLetters = (w: PracticeWord): string[] => w.parts.flat();
/** The skeleton joined as the font would shape it (adjacent Arabic letters connect automatically). */
export const joinedForm = (w: PracticeWord): string => w.parts.map((p) => p.join('')).join(' ');

const byCh = new Map<string, Letter>(LETTERS.map((l) => [l.ch, l]));
export const letterOf = (ch: string): Letter | undefined => byCh.get(ch);

/** Tile state for the "build the word" game. Pure so it can be tested; the UI only renders it. */
export interface BuildState { target: string[]; tiles: { id: number; ch: string; used: boolean }[]; placed: number; mistakes: number }

export function newBuild(word: PracticeWord, rng: () => number = Math.random): BuildState {
  const target = wordLetters(word);
  const tiles = shuffle(target.map((ch, id) => ({ id, ch, used: false })), rng);
  return { target, tiles, placed: 0, mistakes: 0 };
}

/** Taps a tile. Correct if it matches the next expected letter (any unused tile with that letter works). */
export function tapTile(s: BuildState, tileId: number): BuildState {
  const t = s.tiles.find((x) => x.id === tileId);
  if (!t || t.used || s.placed >= s.target.length) return s;
  if (t.ch === s.target[s.placed]) return { ...s, tiles: s.tiles.map((x) => (x.id === tileId ? { ...x, used: true } : x)), placed: s.placed + 1 };
  return { ...s, mistakes: s.mistakes + 1 };
}
export const isBuilt = (s: BuildState) => s.placed === s.target.length;

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
