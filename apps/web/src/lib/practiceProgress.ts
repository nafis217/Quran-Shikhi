import { load, save } from './storage';

interface P { traced: Record<string, number>; quizBest: number }
const KEY = 'qs.practice';
export const getPractice = (): P => load<P>(KEY, { traced: {}, quizBest: 0 });
export function markTraced(letterId: string): void { const p = getPractice(); p.traced[letterId] = (p.traced[letterId] ?? 0) + 1; save(KEY, p); }
export function setQuizBest(n: number): void { const p = getPractice(); if (n > p.quizBest) { p.quizBest = n; save(KEY, p); } }
