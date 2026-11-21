import { useCallback, useEffect, useRef, useState } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { playUrl, stopAudio, wordAudioUrl } from './audio';
import { syllableSchedule } from '@quran-shikkha/learning-core';
import { pron } from './pron';
import { useSettings } from '../settings';

export interface Breakdown { key: string; index: number }

/** Shuni (tap = listen + meaning chip) and Bhangi (double-tap = slow, syllable-by-syllable). One hook shared by every screen. */
export function useWordInteraction() {
  const { t } = useSettings();
  const [selected, setSelected] = useState<Word | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [notice, setNotice] = useState('');
  const run = useRef(0); // cancels stale breakdown runs

  useEffect(() => () => { run.current++; stopAudio(); }, []);

  const listen = useCallback(async (w: Word) => {
    run.current++;
    setBreakdown(null);
    const url = wordAudioUrl(w.audioPath);
    if (!url) { setNotice(t('noAudio')); return false; }
    setNotice('');
    const r = await playUrl(url, 1);
    if (!r.ok) setNotice(t('noAudio'));
    return r.ok;
  }, [t]);

  const tap = useCallback((w: Word) => { setSelected(w); void listen(w); }, [listen]);

  const breakDown = useCallback(async (w: Word) => {
    const id = ++run.current;
    setSelected(w);
    const syl = pron(w.arabicText).syllables;
    const url = wordAudioUrl(w.audioPath);
    const rate = 0.6;
    let clip: number | null = null;
    setNotice(url ? '' : t('noAudio'));
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (url) {
      // Slowed whole-word audio plays while the highlight steps through syllables. (No per-syllable audio: see architecture doc.)
      void playUrl(url, rate).then((r) => { if (r.ok) clip = r.duration; });
      await new Promise((res) => setTimeout(res, 150));
    }
    const sched = syllableSchedule(syl.length, clip, rate);
    for (let i = 0; i < sched.length; i++) {
      if (run.current !== id) return;
      setBreakdown({ key: w.key, index: i });
      await new Promise((res) => setTimeout(res, reduced ? Math.max(sched[i]!, 500) : sched[i]));
    }
    if (run.current === id) setBreakdown(null);
  }, [t]);

  /** Mouse hover: play only (no chip), so exploring a line is quick. */
  const hover = useCallback((w: Word) => {
    const url = wordAudioUrl(w.audioPath);
    if (url) void playUrl(url, 1);
  }, []);

  const clear = useCallback(() => { run.current++; stopAudio(); setSelected(null); setBreakdown(null); }, []);
  return { selected, breakdown, notice, tap, breakDown, listen, hover, clear };
}
