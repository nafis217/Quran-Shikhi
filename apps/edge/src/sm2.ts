export interface Sm2State { ease: number; intervalDays: number; repetitions: number }

/** SM-2 style scheduler. Quality 0..5; below 3 resets repetitions. */
export function sm2Next(s: Sm2State, quality: number): Sm2State {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new RangeError('quality');
  if (quality < 3) return { ease: Math.max(1.3, s.ease - 0.2), intervalDays: 1, repetitions: 0 };
  const reps = s.repetitions + 1;
  // C# Math.Round rounds half to even; keep that behaviour
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : roundHalfEven(s.intervalDays * s.ease);
  const ease = s.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return { ease: Math.max(1.3, ease), intervalDays: Math.max(1, interval), repetitions: reps };
}

export function roundHalfEven(x: number): number {
  const f = Math.floor(x), d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
