import {
  AYN_CODA, CONSONANTS, HAMZA_CODA, HASANTA, NUKTA, VOWEL_LATIN, VOWEL_LETTER, VOWEL_SIGN,
  type Consonant, type Vowel,
} from './tables';
import {
  DAGGER_ALEF, FATHATAN, hasMadd, hasNoMarks, hasShadda, hasSukun, isSilentMarked, parseUnits,
  tanweenOf, vowelOf, type Unit,
} from './parse';
import type { Note, Segment, SoundTag, Syllable, WordResult } from './types';

interface Piece { bn: string; latin: string; tag?: SoundTag }
type Onset =
  | { kind: 'cons'; c: Consonant }
  | { kind: 'carrier'; ayn: boolean };

interface SylB {
  onset?: Onset;
  vowel?: Vowel;
  tail: Piece[];
}

const LONG: Record<'a' | 'u' | 'i', Vowel> = { a: 'ā', u: 'ū', i: 'ī' };
const HAMZA_LETTERS = new Set(['أ', 'إ', 'ؤ', 'ئ', 'ء']);

/** Pure function: one Arabic (Uthmani, with harakat) word -> Bangla spelling, Latin, syllables, notes. */
export function transliterateWord(word: string): WordResult {
  const units = parseUnits(word);
  markLexicalLongA(units);

  const sylls: SylB[] = [];
  const notes: Note[] = [];
  let cur: SylB | undefined;
  /** syllable of the most recent vowelled onset; target for lengthening by a following alef/waw/yeh */
  let lastOnset: SylB | undefined;
  let prev: Unit | undefined;

  const note = (rule: Note['rule']) => notes.push({ rule, syllable: Math.max(0, sylls.length - 1) });
  const newSyll = (onset: Onset | undefined, vowel: Vowel | undefined) => {
    cur = { onset, vowel, tail: [] };
    sylls.push(cur);
    if (onset) lastOnset = cur;
    return cur;
  };
  const canLengthen = () => cur !== undefined && cur === lastOnset && cur.tail.length === 0;
  const coda = (p: Piece) => (cur ?? newSyll(undefined, undefined)).tail.push(p);
  const consCoda = (c: Consonant): Piece => ({ bn: c.bn + HASANTA, latin: c.latin, tag: c.tag });

  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    const next = units[i + 1];
    const ch = u.ch;
    const wasPrev = prev;
    prev = u;

    // ---- hamzat wasl at word start
    if (ch === 'ٱ') {
      if (i !== 0) { note('silent-letter'); continue; }
      const third = units[2];
      const v: Vowel = units[1]?.ch === 'ل' ? 'a' : third && vowelOf(third) === 'u' ? 'u' : 'i';
      newSyll({ kind: 'carrier', ayn: false }, v);
      continue;
    }

    // ---- alef madda
    if (ch === 'آ') {
      if (i > 0 && canLengthen() && cur!.vowel === 'a') { cur!.vowel = 'ā'; note('madd'); }
      else newSyll({ kind: 'carrier', ayn: false }, 'ā');
      continue;
    }

    // ---- hamza carriers
    if (HAMZA_LETTERS.has(ch)) {
      const v = vowelOf(u);
      if (v) { newSyll({ kind: 'carrier', ayn: false }, u.marks.has(DAGGER_ALEF) ? LONG[v] : v); }
      else if (hasSukun(u)) coda({ ...HAMZA_CODA });
      continue;
    }

    // ---- plain alef
    if (ch === 'ا') {
      if (i === 0) { newSyll({ kind: 'carrier', ayn: false }, vowelOf(u) ?? 'a'); continue; }
      if (isSilentMarked(u) || (wasPrev && (tanweenOf(wasPrev) && wasPrev.marks.has(FATHATAN)))) { note('silent-letter'); continue; }
      if (canLengthen() && cur!.vowel === 'a') { cur!.vowel = 'ā'; if (hasMadd(u)) note('madd'); }
      else note('silent-letter'); // e.g. the alef after final waw (قَالُوا)
      continue;
    }

    // ---- ya / alef maksura
    if (ch === 'ي' || ch === 'ى' || ch === 'ی') {
      if (vowelOf(u) || hasShadda(u) || i === 0) { onsetConsonant(u, CONSONANTS['ي']!); continue; }
      if (isSilentMarked(u)) { note('silent-letter'); continue; }
      if (canLengthen() && ch !== 'ي' && cur!.vowel === 'a') { cur!.vowel = 'ā'; continue; }
      if (canLengthen() && cur!.vowel === 'i') { cur!.vowel = 'ī'; continue; }
      if (canLengthen() && cur!.vowel === 'a') { cur!.tail.push({ bn: 'ই', latin: 'y' }); continue; }
      coda(consCoda(CONSONANTS['ي']!));
      continue;
    }

    // ---- waw
    if (ch === 'و') {
      if (vowelOf(u) || hasShadda(u) || i === 0) { onsetConsonant(u, CONSONANTS['و']!); continue; }
      if (isSilentMarked(u)) { note('silent-letter'); continue; }
      if (canLengthen() && cur!.vowel === 'u') { cur!.vowel = 'ū'; continue; }
      if (canLengthen() && cur!.vowel === 'a') { cur!.tail.push({ bn: 'ও', latin: 'w' }); continue; }
      coda(consCoda(CONSONANTS['و']!));
      continue;
    }

    // ---- assimilated letter: no marks, next letter carries shadda (sun-letter lam, idgham)
    if (hasNoMarks(u) && next && hasShadda(next) && CONSONANTS[ch]) {
      note(ch === 'ل' ? 'assimilated-lam' : 'assimilated');
      continue;
    }

    // ---- ʿayn
    if (ch === 'ع') {
      const v = vowelOf(u) ?? (u.marks.has(DAGGER_ALEF) ? 'a' : undefined);
      if (v) {
        const long = u.marks.has(DAGGER_ALEF) || u.marks.has('ۥ') || u.marks.has('ۦ');
        newSyll({ kind: 'carrier', ayn: true }, long ? longOf(u, v) : v);
        if (tanweenOf(u)) { cur!.tail.push({ bn: 'ন্', latin: 'n' }); note('tanween'); }
      } else coda({ ...AYN_CODA, tag: 'throat' });
      continue;
    }

    // Word-final tā marbūṭa with no vowel (an everyday word said on its own, e.g. قِطَّة) is a soft "h", not a "t".
    if (ch === 'ة' && i === units.length - 1 && hasNoMarks(u)) { coda({ bn: 'হ্', latin: 'h' }); continue; }

    const c = CONSONANTS[ch];
    if (!c) continue;
    onsetOrCoda(u, c);
  }

  function longOf(u: Unit, v: 'a' | 'u' | 'i'): Vowel {
    if (u.marks.has(DAGGER_ALEF)) return 'ā';
    if (u.marks.has('ۥ')) return 'ū';
    if (u.marks.has('ۦ')) return 'ī';
    return LONG[v];
  }

  function onsetOrCoda(u: Unit, c: Consonant) {
    const v = vowelOf(u) ?? (u.marks.has(DAGGER_ALEF) ? 'a' : undefined);
    if (v || tanweenOf(u)) onsetConsonant(u, c);
    else coda(consCoda(c));
  }

  function onsetConsonant(u: Unit, c: Consonant) {
    let v: Vowel = vowelOf(u) ?? 'a';
    if (u.marks.has(DAGGER_ALEF) || u.marks.has('ۥ') || u.marks.has('ۦ')) {
      v = longOf(u, (vowelOf(u) ?? 'a') as 'a' | 'u' | 'i');
      note('madd');
    }
    if (hasShadda(u)) {
      note('shadda');
      if (cur) cur.tail.push(consCoda(c)); // first half of the doubled letter closes the previous syllable
    }
    newSyll({ kind: 'cons', c }, v);
    if (hasMadd(u) && v !== vowelOf(u)) { /* already noted */ }
    if (tanweenOf(u)) { cur!.tail.push({ bn: 'ন্', latin: 'n' }); note('tanween'); }
  }

  const out = sylls.map((s, idx) => render(s, idx === 0));
  return {
    arabic: word,
    bangla: out.map((s) => s.bn).join(''),
    latin: out.map((s) => s.latin).join(''),
    syllables: out,
    notes,
  };
}

/** الله written without an explicit alef: lam+shadda before ha is long ā (ٱللَّهِ, لِلَّهِ, وَٱللَّهِ). */
function markLexicalLongA(units: Unit[]): void {
  for (let i = 1; i < units.length - 1; i++) {
    const u = units[i]!;
    if (u.ch === 'ل' && hasShadda(u) && units[i - 1]!.ch === 'ل' && units[i + 1]!.ch === 'ه') u.marks.add(DAGGER_ALEF);
  }
}

function render(s: SylB, first: boolean): Syllable {
  const segs: Segment[] = [];
  let latin = '';
  if (s.onset) {
    const v = s.vowel ?? 'a';
    if (s.onset.kind === 'cons') {
      segs.push({ text: s.onset.c.bn + VOWEL_SIGN[v], ...(s.onset.c.tag ? { tag: s.onset.c.tag } : {}) });
      latin += s.onset.c.latin + VOWEL_LATIN[v];
    } else if (s.onset.ayn) {
      segs.push({ text: VOWEL_LETTER[v] + NUKTA, tag: 'throat' });
      latin += 'ʿ' + VOWEL_LATIN[v];
    } else {
      segs.push({ text: VOWEL_LETTER[v] });
      latin += (first ? '' : 'ʾ') + VOWEL_LATIN[v];
    }
  }
  for (const p of s.tail) {
    segs.push({ text: p.bn, ...(p.tag ? { tag: p.tag } : {}) });
    latin += p.latin;
  }
  const segments = segs.map((x) => ({ ...x, text: x.text.normalize('NFC') }));
  return { bn: segments.map((x) => x.text).join(''), latin, segments };
}
