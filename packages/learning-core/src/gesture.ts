/**
 * Single vs double tap on the same target. `onSingle` fires after `delayMs` if no second tap arrives;
 * a second tap within the window fires `onDouble` instead. Pure timing logic, unit tested.
 */
export function createTapDetector(
  onSingle: () => void,
  onDouble: () => void,
  delayMs = 260,
  timers: { set: (f: () => void, ms: number) => unknown; clear: (h: unknown) => void } = {
    set: (f, ms) => setTimeout(f, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
) {
  let handle: unknown = null;
  return () => {
    if (handle !== null) { timers.clear(handle); handle = null; onDouble(); return; }
    handle = timers.set(() => { handle = null; onSingle(); }, delayMs);
  };
}
