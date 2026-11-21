import { describe, expect, it } from 'vitest';
import { AYAH_COUNTS } from './juz';
import {
  MAX_DAYS, MIN_DAYS, TOTAL_AYAHS, ayahsPerDay, buildPlan, clampDays, dayComplete, dayNumberFor, dayRange, firstUnreadIndex, placeAt, planDay, planEnded, planProgress,
  readIn, rebalance, sanitizePlan, segmentsBetween, wordsPerDay, type Done, type Plan,
} from './plan';

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const allRead = (): Done => { const o: Done = {}; AYAH_COUNTS.forEach((c, i) => { o[i + 1] = Array.from({ length: c }, (_, k) => k + 1); }); return o; };
const readUpTo = (plan: Plan, endIndexExclusive: number): Done => {
  const done: Record<number, number[]> = {};
  for (let i = 0; i < endIndexExclusive; i++) { const p = placeAt(plan.order, i)!; (done[p.surah] ??= []).push(p.ayah); }
  return done;
};

describe('sequence and segments', () => {
  it('maps indexes to places in both orders', () => {
    expect(placeAt('mushaf', 0)).toEqual({ surah: 1, ayah: 1 });
    expect(placeAt('mushaf', 7)).toEqual({ surah: 2, ayah: 1 });
    expect(placeAt('mushaf', TOTAL_AYAHS - 1)).toEqual({ surah: 114, ayah: 6 });
    expect(placeAt('beginner', 0)).toEqual({ surah: 1, ayah: 1 });
    expect(placeAt('beginner', 7)).toEqual({ surah: 112, ayah: 1 });       // after Al-Fatiha's 7 ayahs
    expect(placeAt('beginner', 11)).toEqual({ surah: 113, ayah: 1 });
    expect(placeAt('beginner', TOTAL_AYAHS - 1)).toEqual({ surah: 77, ayah: 50 });
    expect(placeAt('mushaf', -1)).toBeNull(); expect(placeAt('mushaf', TOTAL_AYAHS)).toBeNull();
  });
  it('the whole sequence is every ayah exactly once, in both orders', () => {
    for (const order of ['beginner', 'mushaf'] as const) {
      const segs = segmentsBetween(order, 0, TOTAL_AYAHS);
      expect(segs.reduce((n, s) => n + (s.to - s.from + 1), 0)).toBe(TOTAL_AYAHS);
      expect(new Set(segs.map((s) => s.surah)).size).toBe(114);
      for (const s of segs) expect(s.to).toBeLessThanOrEqual(AYAH_COUNTS[s.surah - 1]!);
    }
  });
  it('slices across a surah boundary', () => {
    expect(segmentsBetween('mushaf', 5, 10)).toEqual([{ surah: 1, from: 6, to: 7 }, { surah: 2, from: 1, to: 3 }]);
  });
});

describe('building a plan', () => {
  it('30 days from today ends 29 days later, about 208 ayahs a day (one juz a day, the traditional pace)', () => {
    const p = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });
    expect(p.startDate).toBe('2026-11-21'); expect(p.endDate).toBe('2026-12-20'); expect(ayahsPerDay(30)).toBe(208);
  });
  it('clamps the length to something sensible', () => {
    expect(clampDays(3)).toBe(MIN_DAYS); expect(clampDays(5000)).toBe(MAX_DAYS); expect(clampDays(Number.NaN)).toBe(30); expect(clampDays(45.4)).toBe(45);
  });
  it('the days partition the Quran with no gap, no overlap, and sizes that differ by at most one ayah', () => {
    for (const days of [14, 30, 60, 90, 100, 365]) for (const order of ['beginner', 'mushaf'] as const) {
      const p = buildPlan({ order, days, startDate: D(2026, 1, 1) });
      let at = 0; const sizes: number[] = [];
      for (let d = 1; d <= days; d++) { const r = dayRange(p, d); expect(r.from).toBe(at); at = r.to; sizes.push(r.to - r.from); }
      expect(at).toBe(TOTAL_AYAHS);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });
  it('the beginner path starts with Al-Fatiha and then the short surahs', () => {
    const d1 = planDay(buildPlan({ order: 'beginner', days: 90, startDate: D(2026, 11, 21) }), 1);
    expect(d1.segments[0]).toEqual({ surah: 1, from: 1, to: 7 });
    expect(d1.segments[1]!.surah).toBe(112);
    expect(d1.ayahs).toBe(Math.floor(TOTAL_AYAHS / 90));
  });
  it('words per day spread the 300-word track and stop when it is covered', () => {
    expect(wordsPerDay(30)).toBe(10); expect(wordsPerDay(60)).toBe(5); expect(wordsPerDay(90)).toBe(3); expect(wordsPerDay(14)).toBe(15); expect(wordsPerDay(365)).toBe(3);
    const p30 = buildPlan({ order: 'mushaf', days: 30 });
    expect(planDay(p30, 1).words).toEqual({ from: 1, to: 10 }); expect(planDay(p30, 30).words).toEqual({ from: 291, to: 300 });
    const p365 = buildPlan({ order: 'mushaf', days: 365 });
    expect(planDay(p365, 101).words).toBeNull(); expect(planDay(p365, 100).words).toEqual({ from: 298, to: 300 });
  });
  it('knows which calendar day each plan day is', () => {
    const p = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });
    expect(planDay(p, 1).date).toBe('2026-11-21'); expect(planDay(p, 11).date).toBe('2026-12-01'); expect(planDay(p, 30).date).toBe('2026-12-20');
    expect(dayNumberFor(p, D(2026, 11, 21))).toBe(1); expect(dayNumberFor(p, D(2026, 11, 20))).toBe(0); expect(dayNumberFor(p, D(2026, 12, 21))).toBe(31);
    expect(planEnded(p, D(2026, 12, 20))).toBe(false); expect(planEnded(p, D(2026, 12, 21))).toBe(true);
  });
});

describe('tracking against the plan', () => {
  const plan = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });

  it('a day is complete only when every ayah in it is read', () => {
    const r = dayRange(plan, 1);
    expect(dayComplete(plan, 1, {})).toBe(false);
    expect(dayComplete(plan, 1, readUpTo(plan, r.to - 1))).toBe(false);
    expect(dayComplete(plan, 1, readUpTo(plan, r.to))).toBe(true);
    expect(readIn(planDay(plan, 1).segments, readUpTo(plan, r.to))).toBe(r.to);
  });
  it('reports not-started, on-track, ahead, behind and finished', () => {
    expect(planProgress(plan, {}, D(2026, 11, 20)).status).toBe('not-started');
    expect(planProgress(plan, readUpTo(plan, dayRange(plan, 5).to), D(2026, 11, 25)).status).toBe('on-track');   // read exactly 5 days' worth on day 5
    expect(planProgress(plan, readUpTo(plan, dayRange(plan, 9).to), D(2026, 11, 25)).status).toBe('ahead');
    expect(planProgress(plan, readUpTo(plan, dayRange(plan, 2).to), D(2026, 11, 25)).status).toBe('behind');
    expect(planProgress(plan, allRead(), D(2026, 11, 22)).status).toBe('finished');
  });
  it('on track means every earlier day is finished; today may still be in progress', () => {
    const p = planProgress(plan, readUpTo(plan, dayRange(plan, 5).to - 60), D(2026, 11, 25));
    expect(p.diff).toBe(-60); expect(p.status).toBe('on-track');
    expect(p.total).toBe(TOTAL_AYAHS); expect(p.expected).toBe(dayRange(plan, 5).to); expect(p.before).toBe(dayRange(plan, 4).to);
    // nothing read yet on day 1 is on track; nothing read on day 5 is behind
    expect(planProgress(plan, {}, D(2026, 11, 21)).status).toBe('on-track');
    expect(planProgress(plan, {}, D(2026, 11, 25)).status).toBe('behind');
  });
  it('after the end date everything should be read', () => {
    const p = planProgress(plan, readUpTo(plan, 3000), D(2027, 1, 5));
    expect(p.expected).toBe(TOTAL_AYAHS); expect(p.status).toBe('behind');
  });
});

describe('re-planning when behind', () => {
  it('spreads the unread rest over the days that are left and keeps the end date', () => {
    const plan = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });
    const done = readUpTo(plan, 400);
    const today = D(2026, 12, 11);                       // day 21: far behind
    const np = rebalance(plan, done, today);
    expect(np.endDate).toBe(plan.endDate); expect(np.startDate).toBe('2026-12-11'); expect(np.days).toBe(10); expect(np.startIndex).toBe(400);
    let at = np.startIndex;
    for (let d = 1; d <= np.days; d++) { const r = dayRange(np, d); expect(r.from).toBe(at); at = r.to; }
    expect(at).toBe(TOTAL_AYAHS);
    expect(planProgress(np, done, today).status).toBe('on-track');
  });
  it('skips ayahs you read out of order and handles an almost finished Quran', () => {
    const plan = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });
    const done = { ...readUpTo(plan, 10), 3: [1, 2, 3] } as Done;         // read 1:1-7, 2:1-3 and also 3:1-3
    expect(firstUnreadIndex(plan, done)).toBe(10);
    const almost = readUpTo(plan, TOTAL_AYAHS - 2);
    const np = rebalance(plan, almost, D(2026, 12, 18));
    expect(np.startIndex).toBe(TOTAL_AYAHS - 2); expect(np.days).toBe(3);
  });
  it('re-planning on or after the last day leaves one day, never zero', () => {
    const plan = buildPlan({ order: 'mushaf', days: 30, startDate: D(2026, 11, 21) });
    expect(rebalance(plan, {}, D(2027, 2, 1)).days).toBe(1);
  });
});

describe('loading a saved plan', () => {
  it('accepts a good plan and rejects damaged ones', () => {
    const p = buildPlan({ order: 'beginner', days: 60, startDate: D(2026, 11, 21) });
    expect(sanitizePlan(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(sanitizePlan(null)).toBeNull(); expect(sanitizePlan({})).toBeNull();
    expect(sanitizePlan({ ...p, order: 'other' })).toBeNull(); expect(sanitizePlan({ ...p, startDate: 'tomorrow' })).toBeNull();
    expect(sanitizePlan({ ...p, days: 0 })).toBeNull(); expect(sanitizePlan({ ...p, startIndex: -5 })).toBeNull();
    expect(sanitizePlan({ ...p, checks: { '1': { words: true }, x: { words: true } } })!.checks).toEqual({ '1': { words: true, review: false } });
  });
});
