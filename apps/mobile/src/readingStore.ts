import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_READING, addRead, isValidPlace, nextAyah, sanitizePlan, sanitizeReading, setLast, toggleBookmark,
  type Done, type Plan, type ReadingState,
} from '@quran-shikkha/learning-core';

/**
 * Everything the app remembers about your reading (same model as the web app): where you stopped, pinned places, daily counts,
 * the plan and which ayahs you marked "I read it". Kept in memory, saved to the phone, and loaded once at start (hydrate).
 */
const READING = 'qs.reading', PLAN = 'qs.plan', doneKey = (s: number) => `qs.done.${s}`;
let reading: ReadingState = EMPTY_READING;
let plan: Plan | null = null;
let done: Record<number, number[]> = {};
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };
const persist = (key: string, value: unknown) => { void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined); };
const parse = (raw: string | null): unknown => { try { return raw === null ? null : JSON.parse(raw); } catch { return null; } };

export async function hydrate(): Promise<void> {
  try {
    const keys = [READING, PLAN, ...Array.from({ length: 114 }, (_, i) => doneKey(i + 1))];
    const pairs = await AsyncStorage.multiGet(keys);
    const map = new Map(pairs);
    reading = sanitizeReading(parse(map.get(READING) ?? null));
    plan = sanitizePlan(parse(map.get(PLAN) ?? null));
    done = {};
    for (let s = 1; s <= 114; s++) { const v = parse(map.get(doneKey(s)) ?? null); if (Array.isArray(v)) { const ok = v.filter((a): a is number => Number.isInteger(a)); if (ok.length) done[s] = ok; } }
  } catch { /* start empty: a failed read must never block the app */ }
  emit();
}

const commit = (next: ReadingState) => { reading = next; persist(READING, next); emit(); };

export const readingStore = {
  reading: () => reading,
  plan: () => plan,
  doneFor: (s: number): number[] => done[s] ?? [],
  doneAll: (): Done => done,
  setLast: (surah: number, ayah: number) => { const n = setLast(reading, surah, ayah); if (n !== reading) commit(n); },
  togglePin: (surah: number, ayah: number) => commit(toggleBookmark(reading, surah, ayah)),
  setGoal: (goal: number) => commit({ ...reading, goal }),
  /** "I read it": saved once, counted for today once, and your place moves to the next ayah. Re-marking changes nothing. */
  markRead: (surah: number, ayah: number): boolean => {
    if (!isValidPlace(surah, ayah)) return false;
    const list = done[surah] ?? [];
    if (list.includes(ayah)) return false;
    done = { ...done, [surah]: [...list, ayah] };
    persist(doneKey(surah), done[surah]);
    const nx = nextAyah(surah, ayah);
    commit(setLast(addRead(reading), nx?.surah ?? surah, nx?.ayah ?? ayah));
    return true;
  },
  setPlan: (p: Plan | null) => { plan = p; persist(PLAN, p); emit(); },
  tick: (day: number, key: 'words' | 'review', value: boolean) => {
    if (!plan) return;
    readingStore.setPlan({ ...plan, checks: { ...plan.checks, [String(day)]: { ...plan.checks[String(day)], [key]: value } } });
  },
};

export function useReading() {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => version);
  return { reading, plan, done };
}
