import { roundHalfEven } from './sm2.ts';

export type WordStatus = 'Correct' | 'Vowel' | 'Close' | 'Wrong' | 'Missing';
/** One specific difference inside a word (see the C# original for the meaning of each type). */
export interface Finding { type: 'Substitute' | 'Missing' | 'Extra' | 'Vowel'; expected: string | null; heard: string | null; letter: string | null; index: number }
export interface WordCheck { position: number; expected: string; heard: string | null; status: WordStatus; similarity: number; findings: Finding[] | null }
export interface RecitationResult { score: number; words: WordCheck[]; extraWords: number; vowelsChecked: boolean }

const CORRECT_AT = 0.99, CLOSE_AT = 0.6, VOWEL_CREDIT = 0.7, VOWELLED_SHARE = 0.4;

const VOWELS: Record<string, string> = { 'َ': 'a', 'ُ': 'u', 'ِ': 'i', 'ً': 'A', 'ٌ': 'U', 'ٍ': 'I', 'ّ': 'S' };
const isLetter = (c: string) => (c >= 'ء' && c <= 'ي') || c === 'ٱ';

/** Short-vowel / tanween / shaddah signature of a word, one token per marked letter. */
export function vowelTokens(word: string, dropFinal: boolean): { letter: string; marks: string }[] {
  const tokens: { letter: string; marks: string }[] = [];
  const tokenLetterNo: number[] = [];
  let cur = '', curLetter = ' ', letters = 0, lastLetter = -1;
  const flush = () => {
    if (cur.length > 0) { tokens.push({ letter: curLetter, marks: [...cur].sort().join('') }); tokenLetterNo.push(letters); cur = ''; }
  };
  for (const c of word) {
    if (isLetter(c)) { flush(); letters++; lastLetter = letters; curLetter = c; }
    else if (VOWELS[c]) cur += VOWELS[c];
  }
  flush();
  if (dropFinal && tokens.length > 0 && tokenLetterNo[tokenLetterNo.length - 1] === lastLetter) tokens.pop();
  return tokens;
}

export const vowelSignature = (word: string, dropFinal: boolean): string => vowelTokens(word, dropFinal).map((t) => t.marks).join('.');

export function vowelFinding(expectedWord: string, heardWord: string, dropFinal: boolean): Finding | null {
  const e = vowelTokens(expectedWord, dropFinal), h = vowelTokens(heardWord, dropFinal);
  for (let i = 0; i < Math.max(e.length, h.length); i++) {
    const em = e[i]?.marks ?? '', hm = h[i]?.marks ?? '';
    if (em !== hm) return { type: 'Vowel', expected: em, heard: hm, letter: (e[i]?.letter ?? h[i]!.letter), index: i };
  }
  return null;
}

/** Letter-level differences between two folded words (substitutions, missing and extra letters), at most 3. */
export function letterFindings(expected: string, heard: string): Finding[] {
  const n = expected.length, m = heard.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i]![j] = Math.min(Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1), d[i - 1]![j - 1]! + (expected[i - 1] === heard[j - 1] ? 0 : 1));
  const found: Finding[] = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + (expected[i - 1] === heard[j - 1] ? 0 : 1)) {
      if (expected[i - 1] !== heard[j - 1]) found.push({ type: 'Substitute', expected: expected[i - 1]!, heard: heard[j - 1]!, letter: null, index: i - 1 });
      i--; j--;
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) { found.push({ type: 'Missing', expected: expected[i - 1]!, heard: null, letter: null, index: i - 1 }); i--; }
    else { found.push({ type: 'Extra', expected: null, heard: heard[j - 1]!, letter: null, index: Math.max(0, i - 1) }); j--; }
  }
  found.reverse();
  return found.slice(0, 3);
}

/** True when the transcript carries vowel marks (a Quran-tuned model does; the browser's recognizer does not). */
export function hasVowels(transcript: string): boolean {
  let letters = 0, marked = 0, seen = false;
  for (const c of transcript) {
    if (isLetter(c)) { letters++; seen = false; }
    else if (VOWELS[c] && !seen) { marked++; seen = true; }
  }
  return letters >= 3 && marked / letters >= VOWELLED_SHARE;
}

/** Strips marks and folds letter variants that recognizers write inconsistently. Display text is never changed. */
export function normalize(s: string): string {
  let out = '';
  for (const c0 of s.normalize('NFD')) {
    if (c0 === 'ٰ') { out += 'ا'; continue; } // dagger alef = a written long alef
    if (/[\p{Mn}\p{Mc}\p{Cf}]/u.test(c0)) continue;
    let c = c0;
    if ('أإآٱ'.includes(c0)) c = 'ا';
    else if (c0 === 'ى') c = 'ي'; else if (c0 === 'ة') c = 'ه'; else if (c0 === 'ؤ') c = 'و'; else if (c0 === 'ئ') c = 'ي';
    else if (c0 === 'ک') c = 'ك'; else if (c0 === 'ی') c = 'ي';
    if (c === 'ء' || c === 'ـ') continue; // hamza and tatweel are often dropped by recognizers
    if ((c >= 'ء' && c <= 'ي') || c === 'ٱ') out += c;
  }
  return out.length <= 1 ? out : out[0]! + out.slice(1).replaceAll('ا', '');
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j), cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(Math.min(cur[j - 1]! + 1, prev[j]! + 1), prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}

export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Compares what a speech recognizer heard with the expected ayah, word by word. */
export function compareRecitation(expected: string[], transcript: string): RecitationResult {
  const heard = transcript.split(/\s+/).filter((w) => w.length > 0 && normalize(w).length > 0);
  const exp = expected.map(normalize), hn = heard.map(normalize);
  const n = exp.length, m = hn.length;

  // Needleman–Wunsch on words: substitution cost = 1 - similarity, gap cost = 1.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i]![0] = i;
  for (let j = 1; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    dp[i]![j] = Math.min(dp[i - 1]![j - 1]! + (1 - similarity(exp[i - 1]!, hn[j - 1]!)), Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1));

  const align = new Array<number>(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && Math.abs(dp[i]![j]! - (dp[i - 1]![j - 1]! + (1 - similarity(exp[i - 1]!, hn[j - 1]!)))) < 1e-9) { align[i - 1] = j - 1; i--; j--; }
    else if (i > 0 && Math.abs(dp[i]![j]! - (dp[i - 1]![j]! + 1)) < 1e-9) i--;
    else j--;
  }

  const vowels = hasVowels(transcript);
  const words: WordCheck[] = [];
  let credit = 0, used = 0;
  for (let i = 0; i < n; i++) {
    if (align[i]! < 0) { words.push({ position: i + 1, expected: expected[i]!, heard: null, status: 'Missing', similarity: 0, findings: null }); continue; }
    used++;
    const h = align[i]!;
    const sim = similarity(exp[i]!, hn[h]!);
    let status: WordStatus = sim >= CORRECT_AT ? 'Correct' : sim >= CLOSE_AT ? 'Close' : 'Wrong';
    let findings: Finding[] | null = null;
    if (status === 'Correct' && vowels && vowelSignature(expected[i]!, i === n - 1) !== vowelSignature(heard[h]!, i === n - 1)) {
      status = 'Vowel';
      const vf = vowelFinding(expected[i]!, heard[h]!, i === n - 1);
      if (vf) findings = [vf];
    } else if (status === 'Close' || status === 'Wrong') findings = letterFindings(exp[i]!, hn[h]!);
    credit += status === 'Wrong' ? 0 : status === 'Vowel' ? VOWEL_CREDIT : sim;
    words.push({ position: i + 1, expected: expected[i]!, heard: heard[h]!, status, similarity: roundHalfEven(sim * 100) / 100, findings });
  }
  return { score: n === 0 ? 0 : roundHalfEven((100 * credit) / n), words, extraWords: Math.max(0, m - used), vowelsChecked: vowels };
}
