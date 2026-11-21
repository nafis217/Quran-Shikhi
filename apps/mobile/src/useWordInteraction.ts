import { useCallback, useEffect, useRef, useState } from 'react';
import type { Word } from '@quran-shikkha/api-client';
import { syllableSchedule } from '@quran-shikkha/learning-core';
import { play, stopAudio } from './audio';
import { pron } from './pron';
import { useSettings } from './settings';

export function useWordInteraction(surah: number) {
  const { t } = useSettings();
  const [selected, setSelected] = useState<Word | null>(null);
  const [bd, setBd] = useState<{ key: string; index: number } | null>(null);
  const [notice, setNotice] = useState('');
  const run = useRef(0);
  useEffect(() => () => { run.current++; void stopAudio(); }, []);

  const listen = useCallback(async (w: Word) => {
    run.current++; setBd(null);
    const r = await play(surah, w.audioPath, 1);
    setNotice(r.ok ? '' : t('noAudio'));
  }, [surah, t]);

  const tap = useCallback((w: Word) => { setSelected(w); void listen(w); }, [listen]);

  const breakDown = useCallback(async (w: Word) => {
    const id = ++run.current;
    setSelected(w);
    const rate = 0.6;
    const r = await play(surah, w.audioPath, rate);
    setNotice(r.ok ? '' : t('noAudio'));
    const sched = syllableSchedule(pron(w.arabicText).syllables.length, r.seconds, rate);
    for (let i = 0; i < sched.length; i++) {
      if (run.current !== id) return;
      setBd({ key: w.key, index: i });
      await new Promise((res) => setTimeout(res, sched[i]));
    }
    if (run.current === id) setBd(null);
  }, [surah, t]);

  const clear = useCallback(() => { run.current++; void stopAudio(); setSelected(null); setBd(null); }, []);
  return { selected, bd, notice, tap, breakDown, listen, clear };
}
