import { AYAH_COUNTS } from './juz';
import { START_ORDER, dayKey } from './reading';

/**
 * A reading plan: the whole Quran split into equal daily parts, in an order you choose.
 * Everything here is a pure function of the plan and of which ayahs you have marked "I read it".
 */
export type PlanOrder = 'beginner' | 'mushaf';

export interface Plan {
  order: PlanOrder;
  /** first day of the (current) schedule, YYYY-MM-DD, local calendar */
  startDate: string;
  /** last day of the plan, YYYY-MM-DD. Fixed when the plan is made; re-planning keeps it. */
  endDate: string;
  /** days in the current schedule (from startDate to endDate) */
  days: number;
  /** index in the reading sequence where the current schedule starts (0 = the very beginning) */
  startIndex: number;
  /** manual ticks for the non-reading tasks, by day number */
  checks: Record<string, { words?: boolean; review?: boolean }>;
  createdAt: string;
}

export interface Segment { surah: number; from: number; to: number }

export const TOTAL_AYAHS = 6236;
export const PLAN_LENGTHS = [30, 60, 90] as const;
export const MIN_DAYS = 14;
export const MAX_DAYS = 365;
/** The word track covers the most frequent Quran words, learned a few a day. */
export const TRACK_WORDS = 300;

const MUSHAF = Array.from({ length: 114 }, (_, i) => i + 1);

/** The surahs in reading order. */
export const surahOrder = (o: PlanOrder): readonly number[] => (o === 'beginner' ? START_ORDER : MUSHAF);

const cumulative = (o: PlanOrder): number[] => {
  const out = [0];
  for (const s of surahOrder(o)) out.push(out[out.length - 1]! + AYAH_COUNTS[s - 1]!);
  return out;
};
const CUM: Record<PlanOrder, number[]> = { beginner: cumulative('beginner'), mushaf: cumulative('mushaf') };
export const sequenceLength = (): number => TOTAL_AYAHS;

/** Sequence index -> (surah, ayah). */
export function placeAt(order: PlanOrder, index: number): { surah: number; ayah: number } | null {
  if (index < 0 || index >= TOTAL_AYAHS) return null;
  const cum = CUM[order]; const list = surahOrder(order);
  let lo = 0, hi = list.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid]! <= index) lo = mid; else hi = mid - 1; }
  return { surah: list[lo]!, ayah: index - cum[lo]! + 1 };
}

/** The ayahs from sequence index `from` (inclusive) to `to` (exclusive) as surah ranges, e.g. Al-Baqarah 1-120. */
export function segmentsBetween(order: PlanOrder, from: number, to: number): Segment[] {
  const out: Segment[] = [];
  const cum = CUM[order]; const list = surahOrder(order);
  for (let i = 0; i < list.length; i++) {
    const a = Math.max(from, cum[i]!), b = Math.min(to, cum[i + 1]!);
    if (b > a) out.push({ surah: list[i]!, from: a - cum[i]! + 1, to: b - cum[i]! });
  }
  return out;
}

const parseDay = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, m! - 1, d!, 12); };
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

export const clampDays = (n: number): number => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(Number.isFinite(n) ? n : 30)));

export function buildPlan(opts: { order: PlanOrder; days: number; startDate?: Date; startIndex?: number; now?: Date }): Plan {
  const days = clampDays(opts.days);
  const start = opts.startDate ?? new Date();
  return {
    order: opts.order, startDate: dayKey(start), endDate: dayKey(addDays(start, days - 1)), days,
    startIndex: Math.min(Math.max(0, opts.startIndex ?? 0), TOTAL_AYAHS - 1), checks: {}, createdAt: (opts.now ?? new Date()).toISOString(),
  };
}

/** Ayahs per day for a plan length (rounded up), shown in the setup screen. */
export const ayahsPerDay = (days: number, fromIndex = 0): number => Math.ceil((TOTAL_AYAHS - fromIndex) / clampDays(days));

/** New words to learn per day: the 300-word track spread over the plan, between 3 and 15 a day. */
export const wordsPerDay = (days: number): number => Math.min(15, Math.max(3, Math.round(TRACK_WORDS / clampDays(days))));

/** The sequence slice [from, to) for a day (1-based). Equal parts: they differ by at most one ayah. */
export function dayRange(plan: Plan, day: number): { from: number; to: number } {
  const total = TOTAL_AYAHS - plan.startIndex;
  const d = Math.min(plan.days, Math.max(1, day));
  return { from: plan.startIndex + Math.floor((total * (d - 1)) / plan.days), to: plan.startIndex + Math.floor((total * d) / plan.days) };
}

export interface PlanDay {
  day: number;
  date: string;
  segments: Segment[];
  ayahs: number;
  /** the frequency ranks of the words to learn today (1 = most frequent); null once the 300 are covered */
  words: { from: number; to: number } | null;
}

export function planDay(plan: Plan, day: number): PlanDay {
  const r = dayRange(plan, day);
  const wpd = wordsPerDay(plan.days);
  const from = (day - 1) * wpd + 1;
  return {
    day, date: dayKey(addDays(parseDay(plan.startDate), day - 1)), segments: segmentsBetween(plan.order, r.from, r.to), ayahs: r.to - r.from,
    words: from > TRACK_WORDS ? null : { from, to: Math.min(TRACK_WORDS, day * wpd) },
  };
}

/** Which day of the plan today is: 1.. in the plan, 0 or less before it starts, more than `days` after it ends. */
export const dayNumberFor = (plan: Plan, today: Date = new Date()): number => daysBetween(plan.startDate, dayKey(today)) + 1;

export type Done = Record<number, readonly number[]>;
const doneSets = (done: Done): Map<number, Set<number>> => new Map(Object.entries(done).map(([k, v]) => [Number(k), new Set(v)]));

/** How many ayahs of a segment list are marked read. */
export function readIn(segments: readonly Segment[], done: Done): number {
  const sets = doneSets(done); let n = 0;
  for (const s of segments) { const set = sets.get(s.surah); if (!set) continue; for (let a = s.from; a <= s.to; a++) if (set.has(a)) n++; }
  return n;
}

export const dayComplete = (plan: Plan, day: number, done: Done): boolean => {
  const d = planDay(plan, day);
  return d.ayahs > 0 && readIn(d.segments, done) === d.ayahs;
};

export type PlanStatus = 'not-started' | 'ahead' | 'on-track' | 'behind' | 'finished';
export interface PlanProgress {
  total: number;
  read: number;
  /** ayahs you should have finished by the end of today */
  expected: number;
  /** ayahs you should have finished by the end of yesterday: falling short of this is what "behind" means */
  before: number;
  /** read minus expected (negative = still to read today or more) */
  diff: number;
  status: PlanStatus;
  day: number;
}

export function planProgress(plan: Plan, done: Done, today: Date = new Date()): PlanProgress {
  const total = TOTAL_AYAHS - plan.startIndex;
  const read = readIn(segmentsBetween(plan.order, plan.startIndex, TOTAL_AYAHS), done);
  const day = dayNumberFor(plan, today);
  const through = (d: number) => (d < 1 ? 0 : d >= plan.days ? total : dayRange(plan, d).to - plan.startIndex);
  const expected = through(day), before = through(day - 1);
  const diff = read - expected;
  // On track = every earlier day is finished (today's reading is still in progress). Half a day of slack either way.
  const tolerance = Math.max(1, Math.ceil(total / plan.days / 2));
  const status: PlanStatus = read >= total ? 'finished' : day < 1 ? 'not-started' : read > expected + tolerance ? 'ahead' : read < before - tolerance ? 'behind' : 'on-track';
  return { total, read, expected, before, diff, status, day };
}

/** First sequence index at or after the plan's start that you have not read. TOTAL_AYAHS when everything is read. */
export function firstUnreadIndex(plan: Plan, done: Done): number {
  const sets = doneSets(done);
  for (let i = plan.startIndex; i < TOTAL_AYAHS; i++) { const p = placeAt(plan.order, i)!; if (!sets.get(p.surah)?.has(p.ayah)) return i; }
  return TOTAL_AYAHS;
}

/**
 * Re-plan after falling behind: the remaining ayahs are spread evenly over the days that are left (the end date does not move).
 * Past reading is kept; the schedule just starts again from the first ayah you have not read.
 */
export function rebalance(plan: Plan, done: Done, today: Date = new Date()): Plan {
  const left = Math.max(1, daysBetween(dayKey(today), plan.endDate) + 1);
  return { ...plan, startDate: dayKey(today), days: left, startIndex: Math.min(firstUnreadIndex(plan, done), TOTAL_AYAHS - 1), checks: {} };
}

export const planEnded = (plan: Plan, today: Date = new Date()): boolean => dayNumberFor(plan, today) > plan.days;

export function sanitizePlan(raw: unknown): Plan | null {
  const p = raw as Partial<Plan> | null;
  const ok = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!p || (p.order !== 'beginner' && p.order !== 'mushaf') || !ok(p.startDate) || !ok(p.endDate)) return null;
  const days = Number(p.days), startIndex = Number(p.startIndex);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS || !Number.isInteger(startIndex) || startIndex < 0 || startIndex >= TOTAL_AYAHS) return null;
  const checks: Plan['checks'] = {};
  if (p.checks && typeof p.checks === 'object') for (const [k, v] of Object.entries(p.checks)) if (/^\d{1,3}$/.test(k) && v && typeof v === 'object') checks[k] = { words: !!(v as { words?: boolean }).words, review: !!(v as { review?: boolean }).review };
  return { order: p.order, startDate: p.startDate as string, endDate: p.endDate as string, days, startIndex, checks, createdAt: typeof p.createdAt === 'string' ? p.createdAt : '' };
}
