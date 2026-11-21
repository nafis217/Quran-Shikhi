import * as FS from 'expo-file-system/legacy';
import { api } from './api';
import { AUDIO_BASE } from './env';

/**
 * User-initiated offline audio. Nothing downloads unless the user presses Download.
 * Layout: <documents>/audio/<surah>/{manifest.json, files...}. Deleting a surah removes the whole folder.
 */
const ROOT = (FS.documentDirectory ?? '') + 'audio/';
const dir = (s: number) => `${ROOT}${s}/`;

export const absoluteUrl = (p: string) => (p.startsWith('http') ? p : AUDIO_BASE.replace(/\/$/, '') + '/' + p.replace(/^\//, ''));
const fileName = (url: string) => url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]/g, '_');

interface Manifest { surah: number; reciter: string | null; createdAt: string; files: string[] }

/** Local file when present (and the user downloaded it), otherwise the network URL. */
export async function resolveAudio(surah: number, url: string): Promise<string> {
  const local = dir(surah) + fileName(url);
  try { if ((await FS.getInfoAsync(local)).exists) return local; } catch { /* fall through to network */ }
  return url;
}

export async function downloadSurah(surah: number, onProgress: (done: number, total: number) => void): Promise<void> {
  const ayahs = (await api.GET('/api/v1/surahs/{n}/ayahs', { params: { path: { n: surah } } })).data;
  if (!ayahs) throw new Error('ayahs');
  const urls = new Set<string>();
  for (const a of ayahs) for (const w of a.words) if (w.audioPath) urls.add(absoluteUrl(w.audioPath));
  let reciter: string | null = null;
  for (const a of ayahs) { // ayah recitation
    const d = (await api.GET('/api/v1/ayahs/{surah}:{ayah}/details', { params: { path: { surah, ayah: a.ayah } } })).data;
    if (d?.audioUrl) urls.add(absoluteUrl(d.audioUrl));
    reciter ??= d?.reciter ?? null;
  }
  await FS.makeDirectoryAsync(dir(surah), { intermediates: true });
  const list = [...urls];
  const done: string[] = [];
  let n = 0;
  onProgress(0, list.length);
  const queue = [...list];
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      try { await FS.downloadAsync(u, dir(surah) + fileName(u)); done.push(fileName(u)); } catch { /* skip failed file; playback falls back to network */ }
      onProgress(++n, list.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const m: Manifest = { surah, reciter, createdAt: new Date().toISOString(), files: done };
  await FS.writeAsStringAsync(dir(surah) + 'manifest.json', JSON.stringify(m));
}

export async function deleteSurah(surah: number): Promise<void> {
  await FS.deleteAsync(dir(surah), { idempotent: true });
}

export async function listDownloads(): Promise<{ surah: number; files: number; reciter: string | null }[]> {
  try {
    const names = await FS.readDirectoryAsync(ROOT);
    const out: { surah: number; files: number; reciter: string | null }[] = [];
    for (const n of names) {
      try {
        const m = JSON.parse(await FS.readAsStringAsync(`${ROOT}${n}/manifest.json`)) as Manifest;
        out.push({ surah: m.surah, files: m.files.length, reciter: m.reciter });
      } catch { /* partial download without manifest: ignored, can be deleted via deleteSurah */ }
    }
    return out.sort((a, b) => a.surah - b.surah);
  } catch { return []; }
}
