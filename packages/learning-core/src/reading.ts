import { AYAH_COUNTS } from './juz';

/** Everything the app remembers about your reading. Pure data + pure functions, so web and phone behave the same. */
export interface Position { surah: number; ayah: number; at: string }
export interface Bookmark extends Position { note?: string }
export interface ReadingState {
  /** where you stopped last (updated when you read, listen, tap or turn a page) */
  last: Position | null;
  /** places you pinned, newest first */
  bookmarks: Bookmark[];
  /** ayahs marked "I read it", per local calendar day (YYYY-MM-DD) */
  days: Record<string, number>;
  /** ayahs per day you want to read */
  goal: number;
}

export const EMPTY_READING: ReadingState = { last: null, bookmarks: [], days: {}, goal: 5 };
export const GOALS = [3, 5, 10, 20] as const;
const MAX_BOOKMARKS = 50;

/** Local calendar day, so a reading at 11 pm counts for that day (not the next UTC day). */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const isValidPlace = (surah: number, ayah: number): boolean =>
  Number.isInteger(surah) && Number.isInteger(ayah) && surah >= 1 && surah <= 114 && ayah >= 1 && ayah <= AYAH_COUNTS[surah - 1]!;

export function setLast(s: ReadingState, surah: number, ayah: number, now: Date = new Date()): ReadingState {
  if (!isValidPlace(surah, ayah)) return s;
  if (s.last && s.last.surah === surah && s.last.ayah === ayah) return s;
  return { ...s, last: { surah, ayah, at: now.toISOString() } };
}

export const isBookmarked = (s: ReadingState, surah: number, ayah: number): boolean => s.bookmarks.some((b) => b.surah === surah && b.ayah === ayah);

/** Pin or unpin an ayah. Newest pin first; at most 50 are kept (the oldest is dropped). */
export function toggleBookmark(s: ReadingState, surah: number, ayah: number, now: Date = new Date()): ReadingState {
  if (!isValidPlace(surah, ayah)) return s;
  if (isBookmarked(s, surah, ayah)) return { ...s, bookmarks: s.bookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah)) };
  return { ...s, bookmarks: [{ surah, ayah, at: now.toISOString() }, ...s.bookmarks].slice(0, MAX_BOOKMARKS) };
}

/** Count one more ayah read today. */
export function addRead(s: ReadingState, now: Date = new Date()): ReadingState {
  const k = dayKey(now);
  return { ...s, days: { ...s.days, [k]: (s.days[k] ?? 0) + 1 } };
}

export const todayCount = (s: ReadingState, now: Date = new Date()): number => s.days[dayKey(now)] ?? 0;

const shiftDay = (d: Date, delta: number): Date => { const x = new Date(d); x.setDate(x.getDate() + delta); return x; };

/**
 * Days in a row with at least one ayah read. If you have not read yet today the streak is not broken until the day ends,
 * so it counts back from yesterday.
 */
export function streak(days: Record<string, number>, today: Date = new Date()): number {
  let n = 0;
  let d = (days[dayKey(today)] ?? 0) > 0 ? today : shiftDay(today, -1);
  while ((days[dayKey(d)] ?? 0) > 0) { n++; d = shiftDay(d, -1); }
  return n;
}

/** The last `n` days, oldest first, for the activity bars. */
export function lastDays(days: Record<string, number>, n: number, today: Date = new Date()): { date: string; count: number }[] {
  return Array.from({ length: n }, (_, i) => { const k = dayKey(shiftDay(today, i - (n - 1))); return { date: k, count: days[k] ?? 0 }; });
}

/** The ayah after this one, continuing into the next surah. Null after the last ayah of the Quran. */
export function nextAyah(surah: number, ayah: number): { surah: number; ayah: number } | null {
  if (!isValidPlace(surah, ayah)) return null;
  if (ayah < AYAH_COUNTS[surah - 1]!) return { surah, ayah: ayah + 1 };
  return surah < 114 ? { surah: surah + 1, ayah: 1 } : null;
}

export interface Summary {
  totalRead: number;
  percent: number;
  surahsDone: number;
  perSurah: { surah: number; read: number; total: number }[];
}

/** From the "I read it" lists per surah. Counts each ayah once and ignores numbers outside the surah. */
export function summarize(done: Record<number, readonly number[]>): Summary {
  const perSurah: Summary['perSurah'] = [];
  let totalRead = 0, surahsDone = 0;
  for (let s = 1; s <= 114; s++) {
    const total = AYAH_COUNTS[s - 1]!;
    const read = new Set((done[s] ?? []).filter((a) => Number.isInteger(a) && a >= 1 && a <= total)).size;
    if (read > 0) perSurah.push({ surah: s, read, total });
    totalRead += read;
    if (read === total) surahsDone++;
  }
  return { totalRead, percent: Math.round((totalRead / 6236) * 1000) / 10, surahsDone, perSurah };
}

/**
 * A gentle order for a beginner: Al-Fatiha first, then the short surahs 112, 113, 114, then Juz Amma backwards from the shortest,
 * then the rest from the beginning. Only a suggestion; every surah is always open.
 */
export const START_ORDER: readonly number[] = [
  1, 112, 113, 114, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78,
  ...Array.from({ length: 77 }, (_, i) => i + 2).filter((s) => s < 78),
];

/** The first surah in the suggested order that you have not finished. Null when all 114 are done. */
export function suggestNext(done: Record<number, readonly number[]>): number | null {
  const sum = summarize(done);
  const read = new Map(sum.perSurah.map((p) => [p.surah, p.read]));
  return START_ORDER.find((s) => (read.get(s) ?? 0) < AYAH_COUNTS[s - 1]!) ?? null;
}

/** Defensive load: anything malformed becomes the empty state, so a corrupt save can never crash the app. */
export function sanitizeReading(raw: unknown): ReadingState {
  if (!raw || typeof raw !== 'object') return EMPTY_READING;
  const r = raw as Partial<ReadingState>;
  const place = (p: unknown): Position | null => {
    const x = p as Partial<Position> | null;
    return x && isValidPlace(Number(x.surah), Number(x.ayah)) ? { surah: Number(x.surah), ayah: Number(x.ayah), at: typeof x.at === 'string' ? x.at : '' } : null;
  };
  const days: Record<string, number> = {};
  if (r.days && typeof r.days === 'object') for (const [k, v] of Object.entries(r.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(v) && (v as number) > 0) days[k] = Math.floor(v as number);
  return {
    last: place(r.last),
    bookmarks: Array.isArray(r.bookmarks) ? r.bookmarks.map(place).filter((p): p is Position => p !== null).slice(0, MAX_BOOKMARKS) : [],
    days,
    goal: (GOALS as readonly number[]).includes(Number(r.goal)) ? Number(r.goal) : 5,
  };
}
