import { useSyncExternalStore } from 'react';
import {
  EMPTY_READING, addRead, isValidPlace, nextAyah, sanitizePlan, sanitizeReading, setLast, toggleBookmark,
  type Done, type Plan, type ReadingState,
} from '@quran-shikkha/learning-core';
import { load, save } from './storage';

/**
 * One place for everything the app remembers about your reading: where you stopped, pinned places, daily counts,
 * the plan, and which ayahs you marked "I read it". Stored on this device only (localStorage).
 */
const READING = 'qs.reading', PLAN = 'qs.plan';
let reading: ReadingState = sanitizeReading(load<unknown>(READING, null));
let plan: Plan | null = sanitizePlan(load<unknown>(PLAN, null));
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };

if (typeof window !== 'undefined') {
  // another tab changed something: reload and tell the screen
  window.addEventListener('storage', (e) => {
    if (e.key === READING) reading = sanitizeReading(load<unknown>(READING, null));
    else if (e.key === PLAN) plan = sanitizePlan(load<unknown>(PLAN, null));
    else if (!e.key?.startsWith('qs.done.')) return;
    emit();
  });
}

const doneKey = (s: number) => `qs.done.${s}`;
export const doneFor = (surah: number): number[] => load<number[]>(doneKey(surah), []).filter((a) => Number.isInteger(a));

export function doneAll(): Done {
  const out: Record<number, number[]> = {};
  for (let s = 1; s <= 114; s++) { const d = doneFor(s); if (d.length) out[s] = d; }
  return out;
}

const commitReading = (next: ReadingState) => { reading = next; save(READING, next); emit(); };

export const readingStore = {
  reading: () => reading,
  plan: () => plan,
  /** Remember where you are. Called when you read, listen, tap a word or turn a page. */
  setLast: (surah: number, ayah: number) => { const n = setLast(reading, surah, ayah); if (n !== reading) commitReading(n); },
  togglePin: (surah: number, ayah: number) => commitReading(toggleBookmark(reading, surah, ayah)),
  setGoal: (goal: number) => commitReading({ ...reading, goal }),
  /** "I read it": saves the ayah, counts it for today (once), and moves your place to the next ayah. Returns true if it was new. */
  markRead: (surah: number, ayah: number): boolean => {
    if (!isValidPlace(surah, ayah)) return false;
    const list = doneFor(surah);
    if (list.includes(ayah)) return false; // already read: nothing changes (a quick double-click must not move your place back)
    save(doneKey(surah), [...list, ayah]);
    const nx = nextAyah(surah, ayah);
    commitReading(setLast(addRead(reading), nx?.surah ?? surah, nx?.ayah ?? ayah));
    return true;
  },
  setPlan: (p: Plan | null) => { plan = p; save(PLAN, p); emit(); },
  tick: (day: number, key: 'words' | 'review', value: boolean) => {
    if (!plan) return;
    const checks = { ...plan.checks, [String(day)]: { ...plan.checks[String(day)], [key]: value } };
    readingStore.setPlan({ ...plan, checks });
  },
};

/** Re-renders the screen whenever anything above changes. */
export function useReading() {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => version);
  return { reading, plan, done: doneAll(), empty: reading === EMPTY_READING };
}
