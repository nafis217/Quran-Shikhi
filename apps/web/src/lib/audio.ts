import { AUDIO_BASE } from './env';

export function wordAudioUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : AUDIO_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

let current: HTMLAudioElement | null = null;
export function stopAudio(): void {
  if (current) { current.pause(); current = null; }
}

/** Plays a URL; resolves when playback ends or fails. Only one clip plays at a time. */
export function playUrl(url: string, rate = 1): Promise<{ ok: boolean; duration: number }> {
  stopAudio();
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.playbackRate = rate;
    current = a;
    a.onended = () => resolve({ ok: true, duration: a.duration });
    a.onerror = () => resolve({ ok: false, duration: 0 });
    a.play().catch((e: unknown) => {
      if ((e as { name?: string }).name === 'NotAllowedError') window.dispatchEvent(new Event('qs:audio-blocked'));
      resolve({ ok: false, duration: 0 });
    });
  });
}
