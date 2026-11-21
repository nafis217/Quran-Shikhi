import { useCallback, useEffect, useRef, useState } from 'react';
import type { components } from '@quran-shikkha/api-client';
import type { Key } from '@quran-shikkha/learning-core';
import { api } from './api';

export type RecitationResult = components['schemas']['RecitationResult'];
export type Phase = 'idle' | 'listening' | 'checking' | 'done' | 'error';

// Minimal typing for the browser's SpeechRecognition (not in the TypeScript DOM lib).
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
}
type SRCtor = new () => SR;
const ctor = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const recitationSupported = () => ctor() !== null;

/**
 * Reads an ayah aloud via the browser's Arabic speech recognition, then asks our backend to compare the TEXT with the ayah.
 * No audio reaches our server. (Chrome sends the audio to Google itself: shown to the user.)
 */
export function useRecitation(ayahKey: string) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState<RecitationResult | null>(null);
  const [error, setError] = useState<Key | null>(null);
  const rec = useRef<SR | null>(null);
  const finalText = useRef('');
  const failed = useRef<Key | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  const check = useCallback(async (text: string) => {
    setPhase('checking');
    try {
      const r = await api.POST('/api/v1/recitation/compare', { body: { ayahKey, transcript: text } });
      if (!r.data) throw new Error('compare');
      setResult(r.data); setPhase('done');
    } catch { setError('errorBody'); setPhase('error'); }
  }, [ayahKey]);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) { setError('recNoSupport'); setPhase('error'); return; }
    setResult(null); setError(null); setHeard(''); finalText.current = ''; failed.current = null;
    const r = new C();
    r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText.current += ' ' + res[0].transcript; else interim += ' ' + res[0].transcript;
      }
      setHeard((finalText.current + ' ' + interim).trim());
    };
    r.onerror = (e) => { failed.current = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'recDenied' : e.error === 'no-speech' ? 'recNone' : 'errorBody'; };
    r.onend = () => {
      rec.current = null;
      if (failed.current) { setError(failed.current); setPhase('error'); return; }
      const text = finalText.current.trim();
      if (!text) { setError('recNone'); setPhase('error'); return; }
      void check(text);
    };
    rec.current = r;
    setPhase('listening');
    try { r.start(); } catch { setError('errorBody'); setPhase('error'); }
  }, [check]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { phase, heard, result, error, start, stop };
}
