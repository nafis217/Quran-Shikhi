import type { Lang } from '../i18n';
import { LETTERS, letterName, type Letter } from './letters';
import { shuffle } from './words';

export type QuizMode = 'letter-to-name' | 'name-to-letter';
export interface Question { mode: QuizMode; target: Letter; options: Letter[] }

/** One question with 4 options. Options never share the same label in the chosen language (so there is exactly one right answer). */
export function makeQuestion(mode: QuizMode, lang: Lang, rng: () => number = Math.random, pool: readonly Letter[] = LETTERS): Question {
  const target = pool[Math.floor(rng() * pool.length)]!;
  const label = (l: Letter) => (mode === 'letter-to-name' ? letterName(l, lang) : l.ch);
  const used = new Set([label(target)]);
  const options: Letter[] = [target];
  for (const l of shuffle(pool, rng)) {
    if (options.length === 4) break;
    if (!used.has(label(l))) { used.add(label(l)); options.push(l); }
  }
  return { mode, target, options: shuffle(options, rng) };
}

export const isCorrect = (q: Question, picked: Letter) => picked.id === q.target.id;

export interface MatchCard { key: string; pairId: string; kind: 'letter' | 'name'; text: string }

/** `pairs` letters become 2*pairs shuffled cards. A pair is two cards with the same pairId. */
export function makeMatch(pairs: number, lang: Lang, rng: () => number = Math.random): MatchCard[] {
  const chosen: Letter[] = [];
  const names = new Set<string>();
  for (const l of shuffle(LETTERS, rng)) {
    if (chosen.length === pairs) break;
    if (!names.has(letterName(l, lang))) { names.add(letterName(l, lang)); chosen.push(l); }
  }
  return shuffle(chosen.flatMap((l) => [
    { key: `${l.id}-l`, pairId: l.id, kind: 'letter' as const, text: l.ch },
    { key: `${l.id}-n`, pairId: l.id, kind: 'name' as const, text: letterName(l, lang) },
  ]), rng);
}

export const isMatch = (a: MatchCard, b: MatchCard) => a.key !== b.key && a.pairId === b.pairId && a.kind !== b.kind;
