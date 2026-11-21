import { useCallback, useEffect, useRef, useState } from 'react';
import type { components } from '@quran-shikkha/api-client';
import type { Key } from '@quran-shikkha/learning-core';
import { API_URL } from './env';
import type { Phase, RecitationResult } from './useRecitation';

type AudioCheck = components['schemas']['AudioCheckResponse'];

/**
 * Records the microphone and sends the audio to OUR backend, which forwards it only to the speech model on your own machine
 * (services/asr). Nothing is stored. A Quran-tuned model returns vowel marks, so vowel mistakes can be flagged.
 */
export function useLocalRecitation(ayahKey: string, onUnavailable: () => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState<RecitationResult | null>(null);
  const [error, setError] = useState<Key | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  const release = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { rec.current?.state === 'recording' && rec.current.stop(); release(); }, []);

  const send = useCallback(async (blob: Blob) => {
    setPhase('checking');
    try {
      const form = new FormData();
      form.append('ayahKey', ayahKey);
      form.append('file', blob, 'recitation.webm');
      const r = await fetch(`${API_URL}/api/v1/recitation/check-audio`, { method: 'POST', body: form });
      if (r.status === 503) { onUnavailable(); setError('recModelDown'); setPhase('error'); return; }
      if (r.status === 422) { setError('recNone'); setPhase('error'); return; }
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as AudioCheck;
      setHeard(d.transcript); setResult(d.result); setPhase('done');
    } catch { setError('errorBody'); setPhase('error'); }
  }, [ayahKey, onUnavailable]);

  const start = useCallback(async () => {
    setResult(null); setError(null); setHeard('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s; chunks.current = [];
      const r = new MediaRecorder(s);
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      r.onstop = () => { release(); const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }); if (blob.size < 1500) { setError('recNone'); setPhase('error'); } else void send(blob); };
      rec.current = r; r.start(); setPhase('listening');
    } catch { setError('recDenied'); setPhase('error'); }
  }, [send]);

  const stop = useCallback(() => { if (rec.current?.state === 'recording') rec.current.stop(); }, []);
  return { phase, heard, result, error, start, stop };
}

export async function fetchServerAsr(): Promise<boolean> {
  try { const r = await fetch(`${API_URL}/api/v1/recitation/capabilities`); return r.ok && ((await r.json()) as { serverAsr: boolean }).serverAsr; } catch { return false; }
}
