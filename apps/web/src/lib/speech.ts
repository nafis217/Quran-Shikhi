import { useEffect, useState } from 'react';

/**
 * Spoken Arabic for the everyday words, using the voice installed on the device (browser Web Speech API).
 * It is a computer voice, not a recording, and is NOT used for the Quran (Quran audio comes from reciters).
 */
const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

const arabicVoice = (): SpeechSynthesisVoice | undefined => synth()?.getVoices().find((v) => v.lang.toLowerCase().startsWith('ar'));

export function hasArabicVoice(): boolean { return arabicVoice() !== undefined; }

/** 'ok' when it spoke, 'no-voice' when the device has no Arabic voice, 'unsupported' when the browser has no speech at all. */
export function speakArabic(text: string): 'ok' | 'no-voice' | 'unsupported' {
  const s = synth();
  if (!s) return 'unsupported';
  const voice = arabicVoice();
  if (!voice) return 'no-voice';
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.rate = 0.85;
  s.speak(u);
  return 'ok';
}

/** Re-checks once the browser has loaded its voice list (it often loads after the page). */
export function useArabicVoice(): boolean {
  const [ok, setOk] = useState(hasArabicVoice);
  useEffect(() => {
    const s = synth(); if (!s) return;
    const on = () => setOk(hasArabicVoice());
    s.addEventListener('voiceschanged', on); on();
    return () => s.removeEventListener('voiceschanged', on);
  }, []);
  return ok;
}
