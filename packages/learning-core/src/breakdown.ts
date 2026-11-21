/** Per-syllable highlight duration for the "Bhangi" step. Uses the real clip length when known. */
export function syllableSchedule(count: number, clipSeconds: number | null, rate: number): number[] {
  if (count <= 0) return [];
  const total = clipSeconds && Number.isFinite(clipSeconds) && clipSeconds > 0 ? (clipSeconds / rate) * 1000 : count * 700;
  return Array.from({ length: count }, () => Math.round(total / count));
}
