/**
 * Loads the whole Quran content into the API's database (run from your computer, not by the server).
 *
 *   node --experimental-strip-types scripts/seed.ts --url https://quranshikhi.pages.dev --key <admin key> [--from 1 --to 114]
 *
 * The heavy downloading and reshaping happens here, so the server only has to store and serve ready-made text (the free plan
 * gives a request just 10 ms of CPU). The admin key comes from POST /api/v1/admin/claim (first call after a fresh deploy).
 * Re-running is safe (rows are replaced). Free-plan D1 allows 100,000 row writes a day; a full load is about 51,000.
 */
import { kvKey, surahTextsJson, translationMeta, type TextRow } from '../src/assemble.ts';
import { buildFrequencyTrack, sliceTrack } from '../src/frequency.ts';
import { FAMILIAR } from '../src/lessons.ts';
import { TAFSIRS, fetchAlquranTexts, fetchAsbab, fetchAudio, fetchChapters, fetchQuranEncBn, fetchTafsir, fetchWords } from '../src/sources.ts';
import { normalizeKey } from '../src/text.ts';
import type { AyahDto } from '../src/types.ts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = (arg('url') ?? '').replace(/\/+$/, ''), KEY = arg('key') ?? process.env['ADMIN_KEY'] ?? '';
const FROM = Number(arg('from', '1')), TO = Number(arg('to', '114'));
if (!URL_ || !KEY) { console.error('Usage: seed.ts --url <site> --key <admin key> [--from N --to N]'); process.exit(2); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'QuranShikkha-seed/0.1' } });
      if (r.ok) return await r.text();
      if (r.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      throw new Error(`${r.status} ${url}`);
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || attempt >= 4) throw e;
      await sleep(600 * attempt);
    }
  }
}

type Row = { kind: string; surah: number; ayah: number; body: string };
const post = async (rows: Row[], meta: { key: string; value: string }[] = []) => {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${URL_}/api/v1/admin/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ rows, meta }) });
    if (r.ok) return;
    if (attempt < 6 && (r.status === 429 || r.status >= 500)) { await sleep(1000 * attempt); continue; }
    throw new Error(`ingest failed: ${r.status} ${await r.text()}`);
  }
};

let kvOk = true;
/** Whole-surah bodies go to KV as finished text, so the server can stream them without touching them. */
async function putKv(key: string, body: string) {
  if (!kvOk) return;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${URL_}/api/v1/admin/kv/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'x-admin-key': KEY }, body });
    if (r.ok) return;
    const t = await r.text();
    if (r.status === 400 && t.includes('No KV')) { kvOk = false; console.log('(this server has no KV namespace: serving from the database instead)'); return; }
    if (attempt < 5 && (r.status === 429 || r.status >= 500)) { await sleep(1000 * attempt); continue; }
    throw new Error(`kv ${key} failed: ${r.status} ${t}`);
  }
}

/** Sends rows in small requests (the server parses each body, so keep them well under its CPU budget). */
async function send(rows: Row[]) {
  let batch: Row[] = [], size = 0;
  for (const r of rows) {
    if (batch.length > 0 && (size + r.body.length > 120_000 || batch.length >= 60)) { await post(batch); batch = []; size = 0; }
    batch.push(r); size += r.body.length + 60;
  }
  if (batch.length) await post(batch);
}

const failures: string[] = [];
const all = new Map<number, AyahDto[]>();
let reciter = '';

async function seedSurah(s: number) {
  const rows: Row[] = [];
  const text = (kind: string, list: { ayah: number; text: string }[]) => { for (const a of list) rows.push({ kind, surah: s, ayah: a.ayah, body: JSON.stringify(a.text) }); };
  const kvJobs: [string, string][] = [];
  const textRows = (list: { ayah: number; text: string }[]): TextRow[] => list.map((a) => ({ ayah: a.ayah, body: JSON.stringify(a.text) }));
  const attempt = async (what: string, f: () => Promise<void>) => { try { await f(); } catch (e) { failures.push(`${s} ${what}: ${(e as Error).message}`); } };
  await attempt('words', async () => { const w = await fetchWords(s, get); all.set(s, w); for (const a of w) rows.push({ kind: 'words', surah: s, ayah: a.ayah, body: JSON.stringify(a) }); kvJobs.push([kvKey.ayahs(s), `[${w.map((a) => JSON.stringify(a)).join(',')}]`]); });
  await attempt('en', async () => { const l = await fetchAlquranTexts(s, 'en', get); text('tr_en', l); kvJobs.push([kvKey.translations('en', s), surahTextsJson('en', ...translationMeta('en'), textRows(l))]); });
  await attempt('ar', async () => { const l = await fetchAlquranTexts(s, 'ar', get); text('tr_ar', l); kvJobs.push([kvKey.translations('ar', s), surahTextsJson('ar', ...translationMeta('ar'), textRows(l))]); });
  await attempt('bn', async () => { const l = await fetchQuranEncBn(s, get); text('tr_bn', l); kvJobs.push([kvKey.translations('bn', s), surahTextsJson('bn', ...translationMeta('bn'), textRows(l))]); });
  for (const l of ['bn', 'en', 'ar'] as const) await attempt(`tafsir ${l}`, async () => { const t = await fetchTafsir(l, s, get); text(`tf_${l}`, t); kvJobs.push([kvKey.tafsir(l, s), surahTextsJson(l, TAFSIRS[l].name, TAFSIRS[l].attribution, textRows(t))]); });
  await attempt('asbab', async () => { try { text('asbab', await fetchAsbab(s, get)); } catch (e) { if (!String(e).includes('404')) throw e; /* Al-Wahidi has no entry for this surah */ } });
  await attempt('audio', async () => { const a = await fetchAudio(s, get); reciter ||= a.reciter; text('audio', a.urls); });
  await send(rows);
  for (const [k, b] of kvJobs) await attempt(`kv ${k}`, () => putKv(k, b));
  console.log(`surah ${String(s).padStart(3)}: ${rows.length} rows`);
}

const surahs = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => { for (;;) { const s = surahs[next++]; if (s === undefined) return; await seedSurah(s); } }));

// derived data (needs the whole Quran, so only when everything was loaded)
const meta: { key: string; value: string }[] = [{ key: 'chapters', value: JSON.stringify(await fetchChapters(get)) }];
if (reciter) meta.push({ key: 'reciter', value: reciter });
if (FROM === 1 && TO === 114 && all.size === 114) {
  const ordered = surahs.flatMap((s) => all.get(s) ?? []);
  const track = buildFrequencyTrack(ordered, 1000, 'Whole Quran');
  meta.push({ key: 'frequent', value: JSON.stringify(track) });
  for (const size of [300, 1000]) await putKv(kvKey.frequent(size), JSON.stringify(sliceTrack(track, size)));
  const words = ordered.flatMap((a) => a.words).filter((w) => w.charType === 'word');
  meta.push({ key: 'familiar', value: JSON.stringify(FAMILIAR.map((f) => {
    const alts = f.arabicMatch.split('|');
    return { word: words.find((w) => { const n = normalizeKey(w.arabicText); return alts.some((m) => n === m || n === 'ال' + m); }) ?? null };
  })) });
} else console.log('(partial load: frequency list and familiar words not rebuilt)');
await post([], meta);

if (failures.length) { console.error(`\n${failures.length} problem(s):\n` + failures.join('\n')); process.exit(1); }
console.log('\nDone: all content loaded.');
