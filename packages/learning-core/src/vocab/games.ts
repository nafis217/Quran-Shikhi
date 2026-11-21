import type { Lang } from '../i18n';
import { shuffle, type PracticeWord } from '../practice/words';
import { meaningOf, VOCAB, type VocabWord } from './vocab';

export type VocabQuizKind = 'picture-to-word' | 'word-to-picture' | 'listen-to-picture' | 'meaning-to-word' | 'word-to-meaning';
export interface VocabQuestion { kind: VocabQuizKind; target: VocabWord; options: VocabWord[] }

const NEEDS_PICTURE: ReadonlySet<VocabQuizKind> = new Set(['picture-to-word', 'word-to-picture', 'listen-to-picture']);

/** The text a button shows for an option in this kind of question. Options must never share a label (one right answer). */
export function optionLabel(kind: VocabQuizKind, w: VocabWord, lang: Lang): string {
  switch (kind) {
    case 'word-to-picture':
    case 'listen-to-picture': return w.emoji;
    case 'word-to-meaning': return meaningOf(w, lang);
    default: return w.ar;
  }
}

/** One question with up to 4 options and exactly one correct answer. Picture kinds only use words that have a picture. */
export function makeVocabQuestion(kind: VocabQuizKind, pool: readonly VocabWord[], lang: Lang, rng: () => number = Math.random): VocabQuestion {
  const usable = NEEDS_PICTURE.has(kind) ? pool.filter((w) => w.visual) : [...pool];
  if (usable.length < 2) throw new Error('not enough words for this question');
  const target = usable[Math.floor(rng() * usable.length)]!;
  const used = new Set([optionLabel(kind, target, lang)]);
  const options = [target];
  for (const w of shuffle(usable, rng)) {
    if (options.length === 4) break;
    const l = optionLabel(kind, w, lang);
    if (!used.has(l)) { used.add(l); options.push(w); }
  }
  return { kind, target, options: shuffle(options, rng) };
}

export interface VocabCard { key: string; pairId: string; kind: 'picture' | 'word'; text: string }

/** Memory-match cards: a picture and its Arabic word make a pair. */
export function makeVocabMatch(pairs: number, pool: readonly VocabWord[], rng: () => number = Math.random): VocabCard[] {
  const chosen = shuffle(pool.filter((w) => w.visual), rng).slice(0, pairs);
  return shuffle(chosen.flatMap((w) => [
    { key: `${w.id}-p`, pairId: w.id, kind: 'picture' as const, text: w.emoji },
    { key: `${w.id}-w`, pairId: w.id, kind: 'word' as const, text: w.ar },
  ]), rng);
}
export const isVocabMatch = (a: VocabCard, b: VocabCard) => a.key !== b.key && a.pairId === b.pairId && a.kind !== b.kind;

/** Same word for everybody on the same calendar day (UTC date), a different one tomorrow. */
export function wordOfTheDay(date: Date = new Date(), pool: readonly VocabWord[] = VOCAB): VocabWord {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  return pool[((day * 2654435761) >>> 0) % pool.length]!;
}

const MARKS = /[ً-ٰٟـۖ-ۭ]/g;
export const stripMarks = (s: string): string => s.replace(MARKS, '');

/** A vocabulary word as a "build the word" puzzle: its consonant letters, one array per word. */
export function toBuildWord(w: VocabWord): PracticeWord {
  const parts = stripMarks(w.ar).replace(/[؟?!،,.]/g, '').split(/\s+/).filter(Boolean).map((p) => [...p]);
  return { id: w.id, display: w.ar, parts, label: { bn: w.bn, en: w.en, ar: w.ar } };
}
