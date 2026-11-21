/**
 * Scores a traced letter from three same-size binary masks (1 = painted):
 *  - core: the letter's actual shape
 *  - tolerant: the letter shape thickened by a margin (where ink is allowed)
 *  - ink: what the learner drew (drawn with a thick pen)
 * coverage = share of the letter that was inked; precision = share of ink that stayed near the letter.
 * Stroke order and direction are NOT checked (documented limitation).
 */
export interface TraceResult { coverage: number; precision: number; score: number; pass: boolean }

export const PASS_COVERAGE = 0.5;
export const PASS_PRECISION = 0.7;

export function scoreTrace(core: ArrayLike<number>, tolerant: ArrayLike<number>, ink: ArrayLike<number>): TraceResult {
  if (core.length !== tolerant.length || core.length !== ink.length) throw new Error('masks must have the same size');
  let coreN = 0, hit = 0, inkN = 0, inkIn = 0;
  for (let i = 0; i < core.length; i++) {
    if (core[i]) { coreN++; if (ink[i]) hit++; }
    if (ink[i]) { inkN++; if (tolerant[i]) inkIn++; }
  }
  const coverage = coreN === 0 ? 0 : hit / coreN;
  const precision = inkN === 0 ? 0 : inkIn / inkN;
  const score = Math.round(100 * Math.min(1, coverage / 0.75) * precision);
  return { coverage, precision, score, pass: inkN > 0 && coverage >= PASS_COVERAGE && precision >= PASS_PRECISION };
}

export type Region = 'top' | 'bottom' | 'left' | 'right' | 'middle';
export interface TraceFeedback {
  /** per pixel: 0 = fine, 1 = part of the letter that was missed, 2 = ink outside the letter */
  overlay: Uint8Array;
  missed: Region | null;
  stray: Region | null;
  missedShare: number;
  strayShare: number;
}

const MISSED_REPORT = 0.15, STRAY_REPORT = 0.2;

/** Where, relative to the letter's bounding box, a set of pixels sits. */
function regionOf(cx: number, cy: number, box: { x0: number; y0: number; x1: number; y1: number }): Region {
  const u = (cx - box.x0) / Math.max(1, box.x1 - box.x0), v = (cy - box.y0) / Math.max(1, box.y1 - box.y0);
  const du = u - 0.5, dv = v - 0.5;
  if (Math.abs(du) < 0.17 && Math.abs(dv) < 0.17) return 'middle';
  return Math.abs(dv) >= Math.abs(du) ? (dv < 0 ? 'top' : 'bottom') : du < 0 ? 'left' : 'right';
}

/** Turns the three masks into a heatmap and a plain-language location of the biggest mistakes. */
export function traceFeedback(core: ArrayLike<number>, tolerant: ArrayLike<number>, ink: ArrayLike<number>, width: number): TraceFeedback {
  const n = core.length;
  const overlay = new Uint8Array(n);
  let coreN = 0, inkN = 0, mN = 0, sN = 0, mx = 0, my = 0, sx = 0, sy = 0;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < n; i++) {
    const x = i % width, y = Math.floor(i / width);
    if (core[i]) { coreN++; box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); }
    if (ink[i]) inkN++;
    if (core[i] && !ink[i]) { overlay[i] = 1; mN++; mx += x; my += y; }
    else if (ink[i] && !tolerant[i]) { overlay[i] = 2; sN++; sx += x; sy += y; }
  }
  const missedShare = coreN ? mN / coreN : 0, strayShare = inkN ? sN / inkN : 0;
  return {
    overlay,
    missed: coreN && inkN && missedShare > MISSED_REPORT ? regionOf(mx / mN, my / mN, box) : null,
    stray: sN > 0 && strayShare > STRAY_REPORT ? regionOf(sx / sN, sy / sN, box) : null,
    missedShare, strayShare,
  };
}
