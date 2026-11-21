import { hasNoMarks, hasShadda, hasSukun, parseUnits, tanweenOf, type Unit } from './parse';
import type { Note } from './types';

const IZHAR = new Set(['ء', 'أ', 'إ', 'ه', 'ع', 'ح', 'غ', 'خ']);
const IDGHAM_GHUNNA = new Set(['ي', 'ن', 'م', 'و']);
const IDGHAM_NO_GHUNNA = new Set(['ل', 'ر']);
const IKHFA = new Set(['ت', 'ث', 'ج', 'د', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ف', 'ق', 'ك']);

function nunRule(next: string): Note['rule'] {
  if (next === 'ب') return 'iqlab';
  if (IDGHAM_GHUNNA.has(next)) return 'idgham-ghunna';
  if (IDGHAM_NO_GHUNNA.has(next)) return 'idgham-bila-ghunna';
  if (IKHFA.has(next)) return 'ikhfa';
  return 'izhar-halqi'; // IZHAR set and anything else
}
void IZHAR;

function mimRule(next: string): Note['rule'] {
  if (next === 'م') return 'idgham-shafawi';
  if (next === 'ب') return 'ikhfa-shafawi';
  return 'izhar-shafawi';
}

/** first pronounced base letter of a word, skipping hamzat wasl (ٱ). */
function firstLetter(units: Unit[]): string | undefined {
  return units.find((u) => u.ch !== 'ٱ')?.ch;
}

/**
 * Cross-word and in-word nun/mim rules. ANNOTATION ONLY: it never changes the Bangla text.
 * Limits: letters only; waqf (stopping) and Hafs-specific exceptions are not modelled. See docs/pronunciation-rules.md.
 */
export function annotateAyah(words: readonly string[]): Note[] {
  const notes: Note[] = [];
  const parsed = words.map(parseUnits);
  parsed.forEach((units, w) => {
    units.forEach((u, i) => {
      const isLast = i === units.length - 1;
      const nextUnit = units[i + 1];
      const nextWordFirst = isLast && w + 1 < parsed.length ? firstLetter(parsed[w + 1]!) : undefined;
      const nextLetter = nextUnit?.ch ?? nextWordFirst;

      if (u.ch === 'ن' && hasSukun(u) && nextLetter) {
        notes.push({ rule: nunRule(nextLetter), wordIndex: w, syllable: undefined });
      } else if (tanweenOf(u) && isLast && nextWordFirst) {
        notes.push({ rule: nunRule(nextWordFirst), wordIndex: w });
      } else if (u.ch === 'م' && hasSukun(u) && nextLetter && !(nextUnit && hasShadda(nextUnit) && hasNoMarks(u))) {
        notes.push({ rule: mimRule(nextLetter), wordIndex: w });
      }
    });
  });
  return notes.map((n) => (n.syllable === undefined ? { rule: n.rule, wordIndex: n.wordIndex } : n));
}
