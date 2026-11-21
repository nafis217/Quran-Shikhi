import { load, save } from './storage';

interface L { stars: number; speedBest: number }
const KEY = 'qs.learn';
export const getLearn = (): L => load<L>(KEY, { stars: 0, speedBest: 0 });
export function addStar(n = 1): number { const l = getLearn(); l.stars += n; save(KEY, l); return l.stars; }
export function setSpeedBest(score: number): boolean { const l = getLearn(); if (score <= l.speedBest) return false; l.speedBest = score; save(KEY, l); return true; }
