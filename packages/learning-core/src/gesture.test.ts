import { describe, expect, it } from 'vitest';
import { createTapDetector } from './gesture';
import { syllableSchedule } from './breakdown';

function fakeTimers() {
  const q: { f: () => void; id: number }[] = []; let n = 0;
  return {
    set: (f: () => void) => { q.push({ f, id: ++n }); return n; },
    clear: (h: unknown) => { const i = q.findIndex((x) => x.id === h); if (i >= 0) q.splice(i, 1); },
    flush: () => { q.splice(0).forEach((x) => x.f()); },
  };
}

describe('tap detector', () => {
  it('one tap -> single after the delay', () => {
    const t = fakeTimers(); const log: string[] = [];
    const tap = createTapDetector(() => log.push('s'), () => log.push('d'), 260, t);
    tap(); expect(log).toEqual([]); t.flush(); expect(log).toEqual(['s']);
  });
  it('two quick taps -> only double, never single', () => {
    const t = fakeTimers(); const log: string[] = [];
    const tap = createTapDetector(() => log.push('s'), () => log.push('d'), 260, t);
    tap(); tap(); t.flush(); expect(log).toEqual(['d']);
  });
  it('can be used again after a double', () => {
    const t = fakeTimers(); const log: string[] = [];
    const tap = createTapDetector(() => log.push('s'), () => log.push('d'), 260, t);
    tap(); tap(); tap(); t.flush(); expect(log).toEqual(['d', 's']);
  });
});

describe('syllable schedule', () => {
  it('splits the real clip length evenly, adjusted for rate', () => {
    expect(syllableSchedule(4, 2, 0.5)).toEqual([1000, 1000, 1000, 1000]);
  });
  it('falls back to 700ms per syllable without audio', () => {
    expect(syllableSchedule(3, null, 1)).toEqual([700, 700, 700]);
  });
  it('is empty for zero syllables', () => expect(syllableSchedule(0, 1, 1)).toEqual([]));
});
