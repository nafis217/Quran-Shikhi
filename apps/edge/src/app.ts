import { Hono, type Context } from 'hono';
import { randomHex, safeEqual, sha256Hex, signToken, verifyToken } from './auth.ts';
import { compareRecitation } from './aligner.ts';
import { KV_KEY_PATTERN, SOURCE_EN, kvKey, surahTextsJson, translationMeta } from './assemble.ts';
import { ensureSchema, getMeta } from './db.ts';
import { sliceTrack } from './frequency.ts';
import { MEDIA } from './media.ts';
import { NEWS_SOURCES, getNews } from './news.ts';
import { sm2Next } from './sm2.ts';
import { TAFSIRS } from './sources.ts';
import { PLACEHOLDER_MARKERS } from './text.ts';
import type { AyahDto, FrequencyTrackDto, WordDto } from './types.ts';

export interface Env {
  DB: D1Database;
  /** Whole-surah response bodies, stored ready-made (optional: without it the same text is assembled from D1). */
  CONTENT?: KVNamespace;
  JWT_SECRET?: string;
  ADMIN_KEY?: string;
  ASR_URL?: string;
  ALLOWED_ORIGINS?: string;
}
type C = Context<{ Bindings: Env }>;

const SCOPE = (n: number) => Number.isInteger(n) && n >= 1 && n <= 114;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const WORD_KEY = /^(\d{1,3}:\d{1,3}:\d{1,3}|v:[a-z0-9.\-]{1,60})$/;
const MAX_BODY = 100_000;

const problem = (c: C, status: 400 | 401 | 404 | 413 | 429 | 500 | 502 | 503, detail?: string) =>
  c.json({ title: ({ 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 413: 'Payload Too Large', 429: 'Too Many Requests', 500: 'Unexpected error.', 502: 'Bad Gateway', 503: 'Service Unavailable' } as const)[status], status, ...(detail ? { detail } : {}) }, status);
const raw = (c: C, body: string, status: 200 | 202 = 200) => c.body(body, status, JSON_HEADERS);
const intParam = (s: string): number => (/^-?\d+$/.test(s) ? Number(s) : NaN);

const CACHE_HEADERS = { ...JSON_HEADERS, 'cache-control': 'public, max-age=600' };

/** Streams a ready-made body from KV (no CPU spent on it); null when it is not there. */
async function fromKv(c: C, key: string): Promise<Response | null> {
  const body = await c.env.CONTENT?.get(key, { type: 'stream', cacheTtl: 3600 });
  return body ? new Response(body, { headers: CACHE_HEADERS }) : null;
}

// ---- secrets kept in the database (so no manual setup is needed) -------------------------------------------------
let jwtSecret: string | null = null;
async function secretOf(env: Env): Promise<string> {
  if (env.JWT_SECRET && env.JWT_SECRET.length >= 32) return env.JWT_SECRET;
  if (jwtSecret) return jwtSecret;
  let s = await getMeta(env.DB, 'jwt_secret');
  if (!s) {
    await env.DB.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('jwt_secret', ?)`).bind(randomHex(32)).run();
    s = await getMeta(env.DB, 'jwt_secret');
  }
  return (jwtSecret = s!);
}

async function userOf(c: C): Promise<string | null> {
  const h = c.req.header('authorization') ?? '';
  if (!h.toLowerCase().startsWith('bearer ')) return null;
  return verifyToken(await secretOf(c.env), h.slice(7).trim());
}

async function jsonBody<T>(c: C): Promise<T | null> {
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > MAX_BODY) return null;
  try { const t = await c.req.text(); return t.length > MAX_BODY ? null : (JSON.parse(t) as T); } catch { return null; }
}

// ---- app ----------------------------------------------------------------------------------------------------------
export const app = new Hono<{ Bindings: Env }>().basePath('/api/v1');

// Same-origin in production. For local development allow any loopback origin (Vite moves ports); extra origins via ALLOWED_ORIGINS.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin) {
    let ok = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).includes(origin);
    try { const u = new URL(origin); const self = new URL(c.req.url); ok ||= ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && ['localhost', '127.0.0.1', '[::1]'].includes(self.hostname); } catch { /* ignore */ }
    if (ok) {
      c.header('access-control-allow-origin', origin); c.header('vary', 'Origin');
      c.header('access-control-allow-headers', 'authorization, content-type'); c.header('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
      if (c.req.method === 'OPTIONS') return c.body(null, 204);
    }
  }
  await next();
});

// Best-effort per-visitor limit (per isolate). Real flood protection belongs to Cloudflare's own rate-limiting rules.
const hits = new Map<string, { n: number; reset: number }>();
app.use('*', async (c, next) => {
  if (c.req.path.includes('/admin/')) return next(); // protected by the admin key instead
  const ip = c.req.header('cf-connecting-ip') ?? 'local', now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) { if (hits.size > 5000) hits.clear(); hits.set(ip, { n: 1, reset: now + 60_000 }); } else if (++h.n > 300) return problem(c, 429);
  await next();
});

app.use('*', async (c, next) => { await ensureSchema(c.env.DB); await next(); });
app.onError((e, c) => { console.error(e); return problem(c, 500); });
app.notFound((c) => problem(c, 404));

// ---- content --------------------------------------------------------------------------------------------------------
const preparing = (c: C) => problem(c, 503, 'Quran content is not loaded on this server yet.');

app.get('/surahs', async (c) => {
  const m = await getMeta(c.env.DB, 'chapters');
  return m ? raw(c, m) : preparing(c);
});

app.get('/surahs/:n/ayahs', async (c) => {
  const n = intParam(c.req.param('n'));
  if (Number.isNaN(n)) return problem(c, 404);
  if (!SCOPE(n)) return problem(c, 404, 'Surah is outside phase-1 scope.');
  const hit = await fromKv(c, kvKey.ayahs(n));
  if (hit) return hit;
  const rows = await c.env.DB.prepare(`SELECT body FROM content WHERE kind = 'words' AND surah = ? ORDER BY ayah`).bind(n).all<{ body: string }>();
  if (rows.results.length === 0) return preparing(c);
  return raw(c, `[${rows.results.map((r) => r.body).join(',')}]`); // assembled as text: no JSON parsing
});

app.get('/surahs/:n/translations', async (c) => {
  const n = intParam(c.req.param('n')), lang = c.req.query('lang') ?? 'en';
  if (Number.isNaN(n)) return problem(c, 404);
  if (!['bn', 'en', 'ar'].includes(lang) || !SCOPE(n)) return problem(c, 400, 'Invalid request.');
  const hit = await fromKv(c, kvKey.translations(lang, n));
  if (hit) return hit;
  const rows = await c.env.DB.prepare(`SELECT ayah, body FROM content WHERE kind = ? AND surah = ? ORDER BY ayah`).bind(`tr_${lang}`, n).all<{ ayah: number; body: string }>();
  if (rows.results.length === 0) return problem(c, 404, 'No translation available in this language.');
  const [src, attr] = translationMeta(lang as 'bn' | 'en' | 'ar');
  return raw(c, surahTextsJson(lang, src, attr, rows.results));
});

app.get('/surahs/:n/tafsir', async (c) => {
  const n = intParam(c.req.param('n')), lang = c.req.query('lang') ?? 'en';
  if (Number.isNaN(n)) return problem(c, 404);
  if (!['bn', 'en', 'ar'].includes(lang) || !SCOPE(n)) return problem(c, 400, 'Invalid request.');
  const hit = await fromKv(c, kvKey.tafsir(lang, n));
  if (hit) return hit;
  const rows = await c.env.DB.prepare(`SELECT ayah, body FROM content WHERE kind = ? AND surah = ? ORDER BY ayah`).bind(`tf_${lang}`, n).all<{ ayah: number; body: string }>();
  if (rows.results.length === 0) return problem(c, 404, 'No tafsir available in this language.');
  const t = TAFSIRS[lang as 'bn' | 'en' | 'ar'];
  return raw(c, surahTextsJson(lang, t.name, t.attribution, rows.results));
});

app.get('/ayahs/:key/details', async (c) => {
  const m = /^(\d+):(\d+)$/.exec(c.req.param('key'));
  if (!m) return problem(c, 404);
  const surah = Number(m[1]), ayah = Number(m[2]);
  if (!SCOPE(surah) || ayah <= 0) return problem(c, 404, 'Not found.');
  const db = c.env.DB;
  const one = (kind: string) => db.prepare(`SELECT body FROM content WHERE kind = ? AND surah = ? AND ayah = ?`).bind(kind, surah, ayah);
  const res = await db.batch<{ body: string }>([one('words'), one('tr_en'), one('tr_bn'), one('tf_bn'), one('tf_en'), one('tf_ar'), one('asbab'), one('audio'),
    db.prepare(`SELECT ayah_key, ayah_end_key, source, text_bn, text_en FROM context_cards WHERE review_status = 1 AND ayah_key LIKE ?`).bind(`${surah}:%`),
    db.prepare(`SELECT value FROM meta WHERE key = 'reciter'`)]);
  const body = (i: number): string | null => (res[i]!.results[0] as { body: string } | undefined)?.body ?? null; // already a JSON string literal

  const wordsJson = body(0);
  if (!wordsJson) {
    const any = await db.prepare(`SELECT 1 AS x FROM content WHERE kind = 'words' AND surah = ? LIMIT 1`).bind(surah).first();
    return any ? problem(c, 404, 'Not found.') : preparing(c);
  }
  const words = (JSON.parse(wordsJson) as AyahDto).words as WordDto[]; // one ayah: small
  // Texts are put together as text (their stored form is already JSON), so even long tafsirs cost no parsing.
  const nonEmpty = (raw: string | null): raw is string => raw !== null && raw !== '""' && !/^"\s*"$/.test(raw);
  const tafsir = (i: number, lang: 'bn' | 'en' | 'ar'): string => {
    const text = body(i); const t = TAFSIRS[lang];
    return nonEmpty(text) ? `{"resourceId":0,"name":${JSON.stringify(t.name)},"attribution":${JSON.stringify(t.attribution)},"text":${text},"hasPlaceholder":${PLACEHOLDER_MARKERS.some((m) => text.includes(m))}}` : 'null';
  };
  const asbab = body(6), enText = body(1), bnText = body(2), audio = body(7);
  const reciterRow = (res[9]!.results[0] as { value: string } | undefined)?.value ?? null;
  const card = (res[8]!.results as unknown as { ayah_key: string; ayah_end_key: string | null; source: string; text_bn: string; text_en: string | null }[]).find((k) => {
    const start = Number(k.ayah_key.split(':')[1]), end = k.ayah_end_key ? Number(k.ayah_end_key.split(':')[1]) : start;
    return start <= ayah && ayah <= end;
  });
  const j = JSON.stringify;
  return raw(c, `{"key":"${surah}:${ayah}",`
    + `"translationBn":${bnText === null ? 'null' : `{"text":${bnText},"source":"QuranEnc.com","version":null,"attribution":"QuranEnc.com"}`},`
    + `"translationEn":${enText === null ? 'null' : `{"text":${enText},"source":${j(SOURCE_EN)},"version":null,"attribution":null}`},`
    + `"tafsirBn":${tafsir(3, 'bn')},`
    + `"context":${card ? j({ source: card.source, textBn: card.text_bn, textEn: card.text_en }) : 'null'},`
    + `"audioUrl":${audio ?? 'null'},`
    + `"reciter":${reciterRow === null ? 'null' : j(`${reciterRow} (alquran.cloud / Islamic Network, dev only)`)},`
    + `"arabicText":${j(words.filter((w) => w.charType === 'word').map((w) => w.arabicText).join(' '))},`
    + `"tafsirEn":${tafsir(4, 'en')},"tafsirAr":${tafsir(5, 'ar')},`
    + `"revelation":${nonEmpty(asbab) ? `{"resourceId":0,"name":"Asbab al-Nuzul — Al-Wahidi (English)","attribution":"Classical source; not scholar-reviewed","text":${asbab},"hasPlaceholder":false}` : 'null'}}`);
});

app.get('/tracks/frequent', async (c) => {
  const q = c.req.query('size');
  const size = q === undefined ? 300 : intParam(q);
  if (Number.isNaN(size)) return problem(c, 400, 'Invalid size.');
  const n = Math.min(1000, Math.max(1, size));
  const hit = await fromKv(c, kvKey.frequent(n)); // ready-made for the sizes the apps use (300 and 1000)
  if (hit) return hit;
  const m = await getMeta(c.env.DB, 'frequent');
  if (!m) return preparing(c);
  return c.json(sliceTrack(JSON.parse(m) as FrequencyTrackDto, n));
});

app.get('/credits', (c) => c.json({
  sources: [
    { name: 'Quran Foundation', what: 'Quran text, word-by-word data, translations, tafsir and audio via the Quran Foundation Content API.', url: 'https://quran.foundation' },
    { name: 'QuranEnc.com', what: 'Bengali translation (bengali_zakaria). Text is shown unmodified.', url: 'https://quranenc.com' },
  ],
  reciter: null,
  disclaimer: 'Bangla spelling is only a guide; learn correct Tajweed from a qualified teacher.',
}));

// ---- lessons --------------------------------------------------------------------------------------------------------
app.get('/lessons', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT l.id, l.ord, l.title, l.title_en, l.type, l.ayah_range, (SELECT COUNT(*) FROM lesson_items i WHERE i.lesson_id = l.id) AS n FROM lessons l ORDER BY l.ord`)
    .all<{ id: number; ord: number; title: string; title_en: string; type: string; ayah_range: string | null; n: number }>();
  return c.json(rows.results.map((l) => ({ id: l.id, order: l.ord, title: l.title, titleEn: l.title_en, type: l.type, ayahRange: l.ayah_range, itemCount: l.n })));
});

app.get('/lessons/:id', async (c) => {
  const id = intParam(c.req.param('id'));
  if (Number.isNaN(id)) return problem(c, 404);
  const l = await c.env.DB.prepare(`SELECT id, title, title_en, type, ayah_range FROM lessons WHERE id = ?`).bind(id).first<{ id: number; title: string; title_en: string; type: string; ayah_range: string | null }>();
  if (!l) return problem(c, 404);
  const head = { id: l.id, title: l.title, titleEn: l.title_en, type: l.type, ayahRange: l.ayah_range };
  if (l.type !== 'familiar') return c.json({ ...head, items: [] });
  const items = await c.env.DB.prepare(`SELECT note FROM lesson_items WHERE lesson_id = ? ORDER BY ord`).bind(id).all<{ note: string | null }>();
  const meta = await getMeta(c.env.DB, 'familiar');
  const resolved = meta ? (JSON.parse(meta) as { word: WordDto | null }[]) : [];
  return c.json({ ...head, items: items.results.map((it, i) => { const parts = (it.note ?? '').split('|'); return { labelBn: parts[0], labelEn: parts[1] ?? null, word: resolved[i]?.word ?? null }; }) });
});

// ---- accounts and user data -----------------------------------------------------------------------------------------
app.post('/auth/guest', async (c) => {
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO users (id, is_guest, email, created_at) VALUES (?, 1, NULL, ?)`).bind(id, new Date().toISOString()).run();
  return c.json({ token: await signToken(await secretOf(c.env), id, true), userId: id, isGuest: true, email: null });
});

app.get('/progress', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const rows = await c.env.DB.prepare(`SELECT lesson_id, completed_items, updated_at FROM user_progress WHERE user_id = ?`).bind(uid).all<{ lesson_id: number; completed_items: number; updated_at: string }>();
  return c.json(rows.results.map((p) => ({ lessonId: p.lesson_id, completedItems: p.completed_items, updatedAt: p.updated_at })));
});

app.put('/progress/:lessonId', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const lessonId = intParam(c.req.param('lessonId'));
  if (Number.isNaN(lessonId)) return problem(c, 404);
  const b = await jsonBody<{ completedItems?: unknown }>(c);
  if (!b || typeof b.completedItems !== 'number' || !Number.isInteger(b.completedItems)) return problem(c, 400, 'Invalid value.');
  if (b.completedItems < 0) return problem(c, 400, 'Invalid value.');
  await c.env.DB.prepare(`INSERT INTO user_progress (user_id, lesson_id, completed_items, updated_at) VALUES (?,?,?,?) ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_items = excluded.completed_items, updated_at = excluded.updated_at`)
    .bind(uid, lessonId, b.completedItems, new Date().toISOString()).run();
  return c.body(null, 204);
});

app.post('/flashcards', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const b = await jsonBody<{ wordKey?: unknown }>(c);
  if (!b || typeof b.wordKey !== 'string' || !WORD_KEY.test(b.wordKey)) return problem(c, 400, 'Invalid wordKey.');
  await c.env.DB.prepare(`INSERT OR IGNORE INTO flashcards (user_id, word_key, ease, interval_days, repetitions, due_at) VALUES (?, ?, 2.5, 0, 0, ?)`).bind(uid, b.wordKey, new Date().toISOString()).run();
  return c.body(null, 204);
});

app.get('/flashcards/due', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const rows = await c.env.DB.prepare(`SELECT word_key, ease, interval_days, due_at FROM flashcards WHERE user_id = ? AND due_at <= ? ORDER BY due_at LIMIT 50`).bind(uid, new Date().toISOString())
    .all<{ word_key: string; ease: number; interval_days: number; due_at: string }>();
  return c.json(rows.results.map((f) => ({ wordKey: f.word_key, ease: f.ease, intervalDays: f.interval_days, dueAt: f.due_at })));
});

app.post('/flashcards/review', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const b = await jsonBody<{ wordKey?: unknown; quality?: unknown }>(c);
  if (!b || typeof b.quality !== 'number' || !Number.isInteger(b.quality)) return problem(c, 400, 'Quality must be 0..5.');
  if (b.quality < 0 || b.quality > 5) return problem(c, 400, 'Quality must be 0..5.');
  const f = typeof b.wordKey === 'string' ? await c.env.DB.prepare(`SELECT ease, interval_days, repetitions FROM flashcards WHERE user_id = ? AND word_key = ?`).bind(uid, b.wordKey).first<{ ease: number; interval_days: number; repetitions: number }>() : null;
  if (!f) return problem(c, 404);
  const n = sm2Next({ ease: f.ease, intervalDays: f.interval_days, repetitions: f.repetitions }, b.quality);
  const due = new Date(Date.now() + n.intervalDays * 86_400_000).toISOString();
  await c.env.DB.prepare(`UPDATE flashcards SET ease = ?, interval_days = ?, repetitions = ?, due_at = ? WHERE user_id = ? AND word_key = ?`).bind(n.ease, n.intervalDays, n.repetitions, due, uid, b.wordKey as string).run();
  return c.json({ wordKey: b.wordKey, ease: n.ease, intervalDays: n.intervalDays, dueAt: due });
});

app.get('/flashcards/export-keys', async (c) => {
  const uid = await userOf(c); if (!uid) return c.body(null, 401);
  const rows = await c.env.DB.prepare(`SELECT word_key FROM flashcards WHERE user_id = ?`).bind(uid).all<{ word_key: string }>();
  return c.json(rows.results.map((r) => r.word_key));
});

const REPORT_TYPES = ['tafsir', 'translation', 'word', 'context', 'pronunciation'];
app.post('/reports', async (c) => {
  const b = await jsonBody<{ targetType?: unknown; targetId?: unknown; note?: unknown }>(c);
  if (!b || typeof b.targetType !== 'string' || !REPORT_TYPES.includes(b.targetType) || typeof b.targetId !== 'string' || b.targetId.trim() === '' || b.targetId.length > 64) return problem(c, 400, 'Invalid report.');
  const uid = await userOf(c);
  const note = (typeof b.note === 'string' ? b.note : '').slice(0, 2000);
  await c.env.DB.prepare(`INSERT INTO content_reports (user_id, target_type, target_id, note, created_at) VALUES (?,?,?,?,?)`).bind(uid, b.targetType, b.targetId, note, new Date().toISOString()).run();
  return c.body(null, 202);
});

// ---- recitation -----------------------------------------------------------------------------------------------------
async function asrAvailable(env: Env): Promise<boolean> {
  if (!env.ASR_URL?.trim()) return false;
  try { const r = await fetch(env.ASR_URL.replace(/\/+$/, '') + '/health', { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

app.get('/recitation/capabilities', async (c) => c.json({ serverAsr: await asrAvailable(c.env) }));

async function compareAyah(c: C, ayahKey: unknown, transcript: string) {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(typeof ayahKey === 'string' ? ayahKey : '');
  if (!m) return { error: problem(c, 400, 'Invalid request.') };
  const surah = Number(m[1]), ayah = Number(m[2]);
  if (!SCOPE(surah)) return { error: problem(c, 404, 'Not found.') };
  const row = await c.env.DB.prepare(`SELECT body FROM content WHERE kind = 'words' AND surah = ? AND ayah = ?`).bind(surah, ayah).first<{ body: string }>();
  if (!row) return { error: problem(c, 404, 'Not found.') };
  const words = (JSON.parse(row.body) as AyahDto).words.filter((w) => w.charType === 'word').map((w) => w.arabicText);
  return { result: compareRecitation(words, transcript) };
}

/** Compares a speech-recognition transcript (TEXT only) with the real ayah. */
app.post('/recitation/compare', async (c) => {
  const b = await jsonBody<{ ayahKey?: unknown; transcript?: unknown }>(c);
  if (!b || typeof b.transcript !== 'string' || b.transcript.trim() === '' || b.transcript.length > 3000) return problem(c, 400, 'Invalid request.');
  const r = await compareAyah(c, b.ayahKey, b.transcript);
  return r.error ?? c.json(r.result);
});

app.post('/recitation/check-audio', async (c) => {
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > 10 * 1024 * 1024 + 4096) return problem(c, 413);
  let form: FormData;
  try { form = await c.req.formData(); } catch { return problem(c, 400, 'Invalid audio.'); }
  const file = form.get('file'), ayahKey = form.get('ayahKey');
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return problem(c, 400, 'Invalid audio.');
  if (!(await asrAvailable(c.env))) return problem(c, 503, 'The speech model is not running.');
  let text: string;
  try {
    const fd = new FormData(); fd.append('file', file, file.name || 'audio');
    const r = await fetch(c.env.ASR_URL!.replace(/\/+$/, '') + '/transcribe', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('asr');
    text = ((await r.json()) as { text?: string }).text ?? '';
  } catch { return problem(c, 502, 'The speech model could not process this audio.'); }
  if (text.trim() === '') return c.json({ title: 'Unprocessable Content', status: 422, detail: 'Nothing was heard.' }, 422);
  const r = await compareAyah(c, ayahKey, text);
  return r.error ?? c.json({ transcript: text, result: r.result });
});

// ---- watch & read ---------------------------------------------------------------------------------------------------
app.get('/media', (c) => { const age = c.req.query('age'); return c.json(MEDIA.filter((m) => age === undefined || m.age === age)); });
app.get('/news/sources', (c) => c.json(Object.entries(NEWS_SOURCES).map(([key, s]) => ({ key, name: s.name }))));
app.get('/news', async (c) => {
  const source = c.req.query('source') ?? 'bbc';
  if (!NEWS_SOURCES[source]) return problem(c, 400, 'Unknown news source.');
  const items = await getNews(source);
  return items ? c.json(items) : problem(c, 502, 'News is not available right now.');
});

// ---- admin: load content (used by scripts/seed.ts) -------------------------------------------------------------------
async function adminOk(c: C): Promise<boolean> {
  const given = c.req.header('x-admin-key') ?? '';
  if (!given) return false;
  if (c.env.ADMIN_KEY) return safeEqual(given, c.env.ADMIN_KEY);
  const stored = await getMeta(c.env.DB, 'admin_hash');
  return !!stored && safeEqual(await sha256Hex(given), stored);
}

/** First caller gets the admin key (stored only as a hash). Do this right after the first deploy. Refused afterwards. */
app.post('/admin/claim', async (c) => {
  if (c.env.ADMIN_KEY) return problem(c, 404);
  const key = randomHex(24);
  const r = await c.env.DB.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('admin_hash', ?)`).bind(await sha256Hex(key)).run();
  if (!r.meta.changes) return c.json({ title: 'Forbidden', status: 403 }, 403);
  return c.json({ key });
});

const KINDS = new Set(['words', 'tr_en', 'tr_ar', 'tr_bn', 'tf_bn', 'tf_en', 'tf_ar', 'asbab', 'audio']);
const META_KEYS = new Set(['chapters', 'frequent', 'familiar', 'reciter']);

/** Stores one ready-made whole-surah body in KV (raw bytes in, no parsing). */
app.put('/admin/kv/:key', async (c) => {
  if (!(await adminOk(c))) return problem(c, 401);
  const key = c.req.param('key');
  if (!KV_KEY_PATTERN.test(key)) return problem(c, 400, 'Bad key.');
  if (!c.env.CONTENT) return problem(c, 400, 'No KV namespace is bound to this server.');
  if (Number(c.req.header('content-length') ?? '0') > 12_000_000) return problem(c, 413);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > 12_000_000) return problem(c, 400, 'Bad body.');
  await c.env.CONTENT.put(key, buf);
  return c.json({ stored: buf.byteLength });
});

app.post('/admin/ingest', async (c) => {
  if (!(await adminOk(c))) return problem(c, 401);
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > 400_000) return problem(c, 413);
  let b: { rows?: { kind: string; surah: number; ayah: number; body: string }[]; meta?: { key: string; value: string }[] };
  try { b = JSON.parse(await c.req.text()); } catch { return problem(c, 400); }
  const stmts: D1PreparedStatement[] = [];
  for (const r of b.rows ?? []) {
    if (!KINDS.has(r.kind) || !SCOPE(r.surah) || !Number.isInteger(r.ayah) || r.ayah < 1 || typeof r.body !== 'string') return problem(c, 400, 'Bad row.');
    stmts.push(c.env.DB.prepare(`INSERT OR REPLACE INTO content (kind, surah, ayah, body) VALUES (?,?,?,?)`).bind(r.kind, r.surah, r.ayah, r.body));
  }
  for (const m of b.meta ?? []) {
    if (!META_KEYS.has(m.key) || typeof m.value !== 'string') return problem(c, 400, 'Bad meta.');
    stmts.push(c.env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)`).bind(m.key, m.value));
  }
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  return c.json({ stored: stmts.length });
});
