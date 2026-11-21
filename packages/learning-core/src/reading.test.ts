import { describe, expect, it } from 'vitest';
import {
  EMPTY_READING, START_ORDER, addRead, dayKey, isBookmarked, isValidPlace, lastDays, nextAyah, sanitizeReading, setLast, streak, suggestNext, summarize, todayCount, toggleBookmark,
} from './reading';

const D = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('places', () => {
  it('knows which surah:ayah exist', () => {
    expect(isValidPlace(1, 7)).toBe(true); expect(isValidPlace(1, 8)).toBe(false); expect(isValidPlace(2, 286)).toBe(true);
    expect(isValidPlace(114, 6)).toBe(true); expect(isValidPlace(115, 1)).toBe(false); expect(isValidPlace(0, 1)).toBe(false); expect(isValidPlace(1.5, 1)).toBe(false);
  });
  it('moves to the next ayah, across surahs, and stops at the end of the Quran', () => {
    expect(nextAyah(1, 3)).toEqual({ surah: 1, ayah: 4 });
    expect(nextAyah(1, 7)).toEqual({ surah: 2, ayah: 1 });
    expect(nextAyah(114, 6)).toBeNull(); expect(nextAyah(1, 99)).toBeNull();
  });
  it('remembers the last place and ignores invalid or repeated ones', () => {
    const a = setLast(EMPTY_READING, 2, 142, D(2026, 11, 21));
    expect(a.last).toMatchObject({ surah: 2, ayah: 142 });
    expect(setLast(a, 2, 142)).toBe(a);        // same place: no change
    expect(setLast(a, 200, 1)).toBe(a);        // invalid: no change
  });
});

describe('bookmarks (pins)', () => {
  it('pins newest first, unpins, and never duplicates', () => {
    let s = toggleBookmark(EMPTY_READING, 1, 1); s = toggleBookmark(s, 2, 255); s = toggleBookmark(s, 36, 1);
    expect(s.bookmarks.map((b) => `${b.surah}:${b.ayah}`)).toEqual(['36:1', '2:255', '1:1']);
    expect(isBookmarked(s, 2, 255)).toBe(true);
    s = toggleBookmark(s, 2, 255);
    expect(isBookmarked(s, 2, 255)).toBe(false); expect(s.bookmarks).toHaveLength(2);
  });
  it('keeps at most 50 and ignores invalid places', () => {
    let s = EMPTY_READING;
    for (let i = 1; i <= 60; i++) s = toggleBookmark(s, 2, i);
    expect(s.bookmarks).toHaveLength(50); expect(s.bookmarks[0]!.ayah).toBe(60);
    expect(toggleBookmark(s, 999, 1)).toBe(s);
  });
});

describe('daily reading and streaks', () => {
  it('counts ayahs per local day', () => {
    let s = addRead(EMPTY_READING, D(2026, 11, 21)); s = addRead(s, D(2026, 11, 21, 23)); s = addRead(s, D(2026, 11, 22, 1));
    expect(todayCount(s, D(2026, 11, 21))).toBe(2); expect(todayCount(s, D(2026, 11, 22))).toBe(1); expect(dayKey(D(2026, 1, 5))).toBe('2026-01-05');
  });
  it('a streak counts consecutive days and survives a day you have not read yet', () => {
    const days = { '2026-11-19': 3, '2026-11-20': 1, '2026-11-21': 2 };
    expect(streak(days, D(2026, 11, 21))).toBe(3);
    expect(streak({ '2026-11-19': 3, '2026-11-20': 1 }, D(2026, 11, 21))).toBe(2);   // nothing yet today: still alive
    expect(streak({ '2026-11-18': 3 }, D(2026, 11, 21))).toBe(0);                     // missed a whole day: broken
    expect(streak({}, D(2026, 11, 21))).toBe(0);
  });
  it('a streak works across a month boundary', () => {
    expect(streak({ '2026-10-31': 1, '2026-11-01': 1, '2026-11-02': 1 }, D(2026, 11, 2))).toBe(3);
  });
  it('lists the last days oldest first', () => {
    const r = lastDays({ '2026-11-21': 4, '2026-11-19': 2 }, 4, D(2026, 11, 21));
    expect(r.map((x) => x.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
    expect(r.map((x) => x.count)).toEqual([0, 2, 0, 4]);
  });
});

describe('progress summary and the suggested next surah', () => {
  it('counts each ayah once and computes the percent of the Quran', () => {
    const s = summarize({ 1: [1, 2, 3, 4, 5, 6, 7, 7, 99, 0], 112: [1, 2] });
    expect(s.totalRead).toBe(9); expect(s.surahsDone).toBe(1);
    expect(s.percent).toBe(0.1);
    expect(s.perSurah).toEqual([{ surah: 1, read: 7, total: 7 }, { surah: 112, read: 2, total: 4 }]);
  });
  it('reading everything gives 100%', () => {
    const all: Record<number, number[]> = {};
    const counts = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
    counts.forEach((c, i) => { all[i + 1] = Array.from({ length: c }, (_, k) => k + 1); });
    const s = summarize(all);
    expect(s.percent).toBe(100); expect(s.surahsDone).toBe(114); expect(suggestNext(all)).toBeNull();
  });
  it('suggests Al-Fatiha first, then the short surahs, and skips finished ones', () => {
    expect(suggestNext({})).toBe(1);
    expect(suggestNext({ 1: [1, 2, 3, 4, 5, 6, 7] })).toBe(112);
    expect(suggestNext({ 1: [1, 2, 3, 4, 5, 6, 7], 112: [1, 2, 3, 4] })).toBe(113);
    expect(suggestNext({ 1: [1, 2, 3] })).toBe(1); // unfinished Fatiha stays the suggestion
  });
  it('the suggested order lists every surah exactly once', () => {
    expect(START_ORDER).toHaveLength(114);
    expect(new Set(START_ORDER).size).toBe(114);
    expect([...START_ORDER].sort((a, b) => a - b)[0]).toBe(1);
    expect(START_ORDER.slice(0, 4)).toEqual([1, 112, 113, 114]);
  });
});

describe('loading a damaged save', () => {
  it('never throws and drops bad entries', () => {
    expect(sanitizeReading(null)).toEqual(EMPTY_READING);
    expect(sanitizeReading('garbage')).toEqual(EMPTY_READING);
    const s = sanitizeReading({ last: { surah: 2, ayah: 5, at: 'x' }, bookmarks: [{ surah: 1, ayah: 1 }, { surah: 999, ayah: 1 }, null, 'x'], days: { '2026-11-21': 3, bad: 5, '2026-11-20': -1 }, goal: 7 });
    expect(s.last).toMatchObject({ surah: 2, ayah: 5 });
    expect(s.bookmarks).toHaveLength(1); expect(Object.keys(s.days)).toEqual(['2026-11-21']); expect(s.goal).toBe(5);
  });
});
