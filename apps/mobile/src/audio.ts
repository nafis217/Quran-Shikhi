import { Audio } from 'expo-av';
import { absoluteUrl, resolveAudio } from './offline';

let current: Audio.Sound | null = null;

export async function stopAudio(): Promise<void> {
  const c = current; current = null;
  try { await c?.stopAsync(); await c?.unloadAsync(); } catch { /* already unloaded */ }
}

/** Plays word/ayah audio (local file if downloaded). Resolves with clip length (s) or null on failure. */
export async function play(surah: number, path: string | null | undefined, rate = 1): Promise<{ ok: boolean; seconds: number | null }> {
  if (!path) return { ok: false, seconds: null };
  await stopAudio();
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const uri = await resolveAudio(surah, absoluteUrl(path));
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, rate, shouldCorrectPitch: true });
    current = sound;
    return { ok: true, seconds: status.isLoaded && status.durationMillis ? status.durationMillis / 1000 : null };
  } catch { return { ok: false, seconds: null }; }
}
