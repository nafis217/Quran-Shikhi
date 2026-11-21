/** Ayah counts of the 114 surahs (index 0 = surah 1). Sums to 6,236, checked by a test. */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
  11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8,
  8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/** Where each of the 30 juz begins (surah, ayah). Verified against the Quran API (api.alquran.cloud "juz" field): 0 mismatches. */
export const JUZ_STARTS: readonly (readonly [number, number])[] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export interface JuzSegment { surah: number; from: number; to: number }

/** The surah ranges inside a juz (1..30), e.g. juz 2 = surah 2 ayah 142 to 252. */
export function juzSegments(juz: number): JuzSegment[] {
  if (juz < 1 || juz > 30) return [];
  const [s0, a0] = JUZ_STARTS[juz - 1]!;
  const [s1, a1] = juz === 30 ? [115, 1] : JUZ_STARTS[juz]!;
  const out: JuzSegment[] = [];
  for (let s = s0; s <= Math.min(114, s1); s++) {
    const from = s === s0 ? a0 : 1;
    const to = s === s1 ? a1 - 1 : AYAH_COUNTS[s - 1]!;
    if (to >= from) out.push({ surah: s, from, to });
  }
  return out;
}

/** The juz that contains a given ayah. */
export function juzOf(surah: number, ayah: number): number {
  let j = 1;
  for (let i = 0; i < 30; i++) { const [s, a] = JUZ_STARTS[i]!; if (surah > s || (surah === s && ayah >= a)) j = i + 1; }
  return j;
}
