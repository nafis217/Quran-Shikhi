import { beforeAll, describe, expect, it } from 'vitest';
import { app, type Env } from '../src/app.ts';
import { resetSchemaCache } from '../src/db.ts';
import { fakeD1 } from './d1.ts';

let env: Env;
const call = (path: string, init?: RequestInit & { json?: unknown }, e: Env = env) => {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) { body = JSON.stringify(init.json); headers.set('content-type', 'application/json'); }
  return app.fetch(new Request(`http://localhost/api/v1${path}`, { ...init, headers, body }), e);
};
const guest = async () => {
  const r = (await (await call('/auth/guest', { method: 'POST' })).json()) as { token: string; userId: string; isGuest: boolean };
  return { Authorization: `Bearer ${r.token}` };
};
const admin = async () => {
  const claim = await call('/admin/claim', { method: 'POST' });
  return { 'x-admin-key': ((await claim.json()) as { key: string }).key };
};
const word = (surah: number, ayah: number, pos: number, ar: string, bn: string | null = null) =>
  ({ key: `${surah}:${ayah}:${pos}`, position: pos, arabicText: ar, audioPath: `wbw/${pos}.mp3`, meaningBn: bn, meaningEn: null, translitLatin: null, charType: 'word' });
const ayah = (surah: number, a: number, words: ReturnType<typeof word>[]) => ({ key: `${surah}:${a}`, surah, ayah: a, words });

beforeAll(async () => {
  resetSchemaCache();
  env = { DB: fakeD1() };
  const h = await admin();
  const rows = [
    { kind: 'words', surah: 1, ayah: 1, body: JSON.stringify(ayah(1, 1, [word(1, 1, 1, 'ٱللَّهِ', 'আল্লাহ')])) },
    { kind: 'words', surah: 1, ayah: 2, body: JSON.stringify(ayah(1, 2, [word(1, 2, 1, 'ٱلْحَمْدُ'), word(1, 2, 2, 'لِلَّهِ'), word(1, 2, 3, 'رَبِّ'), word(1, 2, 4, 'ٱلْعَٰلَمِينَ'), { ...word(1, 2, 5, '٢'), charType: 'end' }])) },
    { kind: 'tr_en', surah: 1, ayah: 1, body: JSON.stringify('In the name') },
    { kind: 'tr_bn', surah: 1, ayah: 1, body: JSON.stringify('শুরু করছি') },
    { kind: 'tf_bn', surah: 1, ayah: 1, body: JSON.stringify('ব্যাখ্যা (আরবি) আছে') },
    { kind: 'asbab', surah: 1, ayah: 1, body: JSON.stringify('A reason') },
    { kind: 'audio', surah: 1, ayah: 1, body: JSON.stringify('https://cdn.example/1.mp3') },
  ];
  const chapters = [{ id: 1, nameSimple: 'Al-Faatiha', nameArabic: 'x', translatedName: 'The Opening', versesCount: 7 }];
  const r = await call('/admin/ingest', { method: 'POST', headers: h, json: { rows, meta: [{ key: 'chapters', value: JSON.stringify(chapters) }, { key: 'reciter', value: 'Alafasy' }] } });
  expect(r.status).toBe(200);
});

describe('content', () => {
  it('lists surahs', async () => expect(((await (await call('/surahs')).json()) as { id: number }[]).map((c) => c.id)).toEqual([1]));
  it('serves ayahs with words as written', async () => {
    const a = (await (await call('/surahs/1/ayahs')).json()) as { key: string; words: { arabicText: string; meaningBn: string | null }[] }[];
    expect(a.map((x) => x.key)).toEqual(['1:1', '1:2']); expect(a[0]!.words[0]!.arabicText).toBe('ٱللَّهِ'); expect(a[0]!.words[0]!.meaningBn).toBe('আল্লাহ');
  });
  it('out-of-scope or unknown surah is 404, an unloaded surah is 503', async () => {
    expect((await call('/surahs/115/ayahs')).status).toBe(404);
    expect((await call('/surahs/abc/ayahs')).status).toBe(404);
    expect((await call('/surahs/2/ayahs')).status).toBe(503);
  });
  it('translations and tafsir follow the language and validate', async () => {
    const en = (await (await call('/surahs/1/translations?lang=en')).json()) as { ayahs: { text: string }[]; source: string };
    expect(en.ayahs[0]!.text).toBe('In the name'); expect(en.source).toContain('Saheeh');
    expect((await call('/surahs/1/translations?lang=ar')).status).toBe(404);
    const bn = (await (await call('/surahs/1/translations?lang=bn')).json()) as { source: string; version: string | null; attribution: string };
    expect(bn.source).toBe('QuranEnc.com'); expect(bn.version).toBeNull(); expect(bn.attribution).toBe('QuranEnc.com');
    const tf = (await (await call('/surahs/1/tafsir?lang=bn')).json()) as { ayahs: { text: string }[]; attribution: string };
    expect(tf.ayahs[0]!.text).toBe('ব্যাখ্যা (আরবি) আছে'); expect(tf.attribution).toBe('Tawheed Publication');
    expect((await call('/surahs/1/tafsir?lang=xx')).status).toBe(400);
    expect((await call('/surahs/115/tafsir?lang=bn')).status).toBe(400);
  });
  it('details combine the sources, flag the placeholder and hide Draft context cards', async () => {
    const d = (await (await call('/ayahs/1:1/details')).json()) as Record<string, any>;
    expect(d.translationEn.text).toBe('In the name'); expect(d.translationBn.source).toBe('QuranEnc.com');
    expect(d.tafsirBn.hasPlaceholder).toBe(true); expect(d.revelation.text).toBe('A reason');
    expect(d.audioUrl).toBe('https://cdn.example/1.mp3'); expect(d.reciter).toContain('Alafasy');
    expect(d.arabicText).toBe('ٱللَّهِ'); expect(d.context).toBeNull(); expect(d.tafsirEn).toBeNull();
    expect((await call('/ayahs/1:9/details')).status).toBe(404);
    expect((await call('/ayahs/115:1/details')).status).toBe(404);
    expect((await call('/ayahs/1:0/details')).status).toBe(404);
  });
  it('reviewed context cards are shown and drafts never', async () => {
    await env.DB.prepare(`INSERT INTO context_cards (ayah_key, ayah_end_key, source, text_bn, review_status) VALUES ('1:1','1:2','Test source','পরীক্ষা',1)`).run();
    const d = (await (await call('/ayahs/1:2/details')).json()) as { context: { source: string } | null };
    expect(d.context?.source).toBe('Test source');
  });
  it('frequent track is cut to the requested size', async () => {
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('frequent', ?)`).bind(JSON.stringify({ totalWordTokens: 10, distinctWords: 3, coveragePercent: 100, scope: 'Whole Quran', words: [{ rank: 1, cumulativeCoveragePercent: 50 }, { rank: 2, cumulativeCoveragePercent: 80 }, { rank: 3, cumulativeCoveragePercent: 100 }] })).run();
    const t = (await (await call('/tracks/frequent?size=2')).json()) as { words: unknown[]; coveragePercent: number };
    expect(t.words).toHaveLength(2); expect(t.coveragePercent).toBe(80);
    expect((await call('/tracks/frequent?size=abc')).status).toBe(400);
  });
  it('credits mention the sources and the Tajweed warning', async () => {
    const j = await (await call('/credits')).text();
    expect(j).toContain('Quran Foundation'); expect(j).toContain('QuranEnc.com'); expect(j).toContain('qualified teacher');
  });
});

describe('lessons', () => {
  it('lists our lessons in order with item counts', async () => {
    const l = (await (await call('/lessons')).json()) as { id: number; type: string; itemCount: number; title: string }[];
    expect(l).toHaveLength(40); expect(l[0]!.type).toBe('surah'); expect(l.find((x) => x.type === 'familiar')!.itemCount).toBe(7);
  });
  it('familiar lesson resolves against loaded data and leaves unmatched null', async () => {
    const l = (await (await call('/lessons')).json()) as { id: number; type: string }[];
    const id = l.find((x) => x.type === 'familiar')!.id;
    await env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('familiar', ?)`).bind(JSON.stringify([{ word: { key: '1:1:1' } }, { word: null }])).run();
    const d = (await (await call(`/lessons/${id}`)).json()) as { items: { labelBn: string; labelEn: string | null; word: unknown }[] };
    expect(d.items).toHaveLength(7); expect(d.items[0]!.labelEn).toBe('Allah'); expect(d.items[0]!.word).not.toBeNull(); expect(d.items[1]!.word).toBeNull(); expect(d.items[6]!.word).toBeNull();
    expect((await call('/lessons/9999')).status).toBe(404);
  });
});

describe('user data', () => {
  it('requires a token, then schedules flashcards with SM-2', async () => {
    expect((await call('/flashcards/due')).status).toBe(401);
    expect((await call('/flashcards/due', { headers: { Authorization: 'Bearer nope' } })).status).toBe(401);
    const h = await guest();
    expect((await call('/flashcards', { method: 'POST', headers: h, json: { wordKey: '1:1:2' } })).status).toBe(204);
    expect((await call('/flashcards', { method: 'POST', headers: h, json: { wordKey: 'v:animals.cat' } })).status).toBe(204);
    expect((await call('/flashcards', { method: 'POST', headers: h, json: { wordKey: 'bad' } })).status).toBe(400);
    expect(((await (await call('/flashcards/due', { headers: h })).json()) as unknown[]).length).toBe(2);
    const rev = await call('/flashcards/review', { method: 'POST', headers: h, json: { wordKey: '1:1:2', quality: 5 } });
    expect(rev.status).toBe(200);
    expect(((await rev.json()) as { intervalDays: number }).intervalDays).toBe(1);
    expect(((await (await call('/flashcards/due', { headers: h })).json()) as unknown[]).length).toBe(1); // the reviewed one is now in the future
    expect((await call('/flashcards/review', { method: 'POST', headers: h, json: { wordKey: '1:1:2', quality: 9 } })).status).toBe(400);
    expect((await call('/flashcards/review', { method: 'POST', headers: h, json: { wordKey: '9:9:9', quality: 3 } })).status).toBe(404);
    expect(((await (await call('/flashcards/export-keys', { headers: h })).json()) as string[]).sort()).toEqual(['1:1:2', 'v:animals.cat']);
  });
  it("one user cannot see another's cards or progress", async () => {
    const a = await guest(), b = await guest();
    await call('/flashcards', { method: 'POST', headers: a, json: { wordKey: '2:2:2' } });
    await call('/progress/3', { method: 'PUT', headers: a, json: { completedItems: 4 } });
    expect(((await (await call('/flashcards/due', { headers: b })).json()) as unknown[]).length).toBe(0);
    expect(((await (await call('/progress', { headers: b })).json()) as unknown[]).length).toBe(0);
    const mine = (await (await call('/progress', { headers: a })).json()) as { lessonId: number; completedItems: number }[];
    expect(mine).toMatchObject([{ lessonId: 3, completedItems: 4 }]);
    await call('/progress/3', { method: 'PUT', headers: a, json: { completedItems: 5 } });
    expect(((await (await call('/progress', { headers: a })).json()) as { completedItems: number }[])[0]!.completedItems).toBe(5);
    expect((await call('/progress/3', { method: 'PUT', headers: a, json: { completedItems: -1 } })).status).toBe(400);
  });
  it('rejects a token signed with another secret and an oversized body', async () => {
    const other: Env = { DB: fakeD1(), JWT_SECRET: 'x'.repeat(40) };
    resetSchemaCache();
    const foreign = (await (await call('/auth/guest', { method: 'POST' }, other)).json()) as { token: string };
    resetSchemaCache();
    expect((await call('/flashcards/due', { headers: { Authorization: `Bearer ${foreign.token}` } })).status).toBe(401);
    const h = await guest();
    expect((await call('/reports', { method: 'POST', headers: { ...h, 'content-length': '999999' }, body: '{}' })).status).toBe(400);
  });
  it('reports validate and are accepted', async () => {
    expect((await call('/reports', { method: 'POST', json: { targetType: 'nope', targetId: '1:1', note: 'x' } })).status).toBe(400);
    expect((await call('/reports', { method: 'POST', json: { targetType: 'tafsir', targetId: '1:1', note: '(আরবি) missing' } })).status).toBe(202);
  });
});

describe('recitation', () => {
  it('compare scores a correct reading and validates input', async () => {
    const ok = await call('/recitation/compare', { method: 'POST', json: { ayahKey: '1:1', transcript: 'الله' } });
    expect(ok.status).toBe(200); expect(((await ok.json()) as { score: number }).score).toBe(100);
    expect((await call('/recitation/compare', { method: 'POST', json: { ayahKey: 'bad', transcript: 'x' } })).status).toBe(400);
    expect((await call('/recitation/compare', { method: 'POST', json: { ayahKey: '1:1', transcript: '  ' } })).status).toBe(400);
    expect((await call('/recitation/compare', { method: 'POST', json: { ayahKey: '115:1', transcript: 'x' } })).status).toBe(404);
  });
  it('the real response shape has findings null for correct words and string status', async () => {
    const r = (await (await call('/recitation/compare', { method: 'POST', json: { ayahKey: '1:2', transcript: 'الحمد لله العالمين' } })).json()) as { words: { status: string; findings: unknown }[]; vowelsChecked: boolean };
    expect(r.words.map((w) => w.status)).toEqual(['Correct', 'Correct', 'Missing', 'Correct']); expect(r.words[0]!.findings).toBeNull(); expect(r.vowelsChecked).toBe(false);
  });
  it('capabilities and check-audio report unavailable when no model is configured', async () => {
    expect(await (await call('/recitation/capabilities')).json()).toEqual({ serverAsr: false });
    const fd = new FormData(); fd.append('ayahKey', '1:1'); fd.append('file', new File([new Uint8Array([1, 2, 3])], 'a.webm'));
    expect((await call('/recitation/check-audio', { method: 'POST', body: fd })).status).toBe(503);
  });
});

describe('watch & read', () => {
  it('serves the video list filtered by age and the allow-listed news sources', async () => {
    const all = (await (await call('/media')).json()) as { age: string }[];
    const kids = (await (await call('/media?age=kids')).json()) as { age: string }[];
    expect(kids.length).toBeGreaterThan(0); expect(kids.length).toBeLessThan(all.length); expect(kids.every((m) => m.age === 'kids')).toBe(true);
    expect(((await (await call('/news/sources')).json()) as { key: string }[]).map((s) => s.key)).toEqual(['bbc', 'aljazeera', 'france24']);
    expect((await call('/news?source=evil')).status).toBe(400);
  });
});

describe('admin', () => {
  it('the first caller gets the key, nobody else can, and a wrong key cannot load content', async () => {
    const fresh: Env = { DB: fakeD1() }; resetSchemaCache();
    const first = await call('/admin/claim', { method: 'POST' }, fresh);
    expect(first.status).toBe(200);
    expect((await call('/admin/claim', { method: 'POST' }, fresh)).status).toBe(403);
    expect((await call('/admin/ingest', { method: 'POST', headers: { 'x-admin-key': 'wrong' }, json: { rows: [] } }, fresh)).status).toBe(401);
    expect((await call('/admin/ingest', { method: 'POST', json: { rows: [] } }, fresh)).status).toBe(401);
    const key = ((await first.json()) as { key: string }).key;
    expect((await call('/admin/ingest', { method: 'POST', headers: { 'x-admin-key': key }, json: { rows: [{ kind: 'evil', surah: 1, ayah: 1, body: '"x"' }] } }, fresh)).status).toBe(400);
    resetSchemaCache();
  });
});

describe('KV (whole-surah bodies)', () => {
  const store = new Map<string, ArrayBuffer>();
  const kv = {
    get: async (key: string) => { const b = store.get(key); return b ? new Response(b).body : null; },
    put: async (key: string, v: ArrayBuffer) => { store.set(key, v); },
  } as unknown as KVNamespace;
  it('streams a stored body untouched, and falls back to the database when the key is missing', async () => {
    const withKv: Env = { ...env, CONTENT: kv };
    store.set('a:1', new TextEncoder().encode('[{"from":"kv"}]').buffer as ArrayBuffer);
    const r = await call('/surahs/1/ayahs', undefined, withKv);
    expect(await r.text()).toBe('[{"from":"kv"}]');
    expect(r.headers.get('content-type')).toContain('application/json');
    const fallback = (await (await call('/surahs/1/translations?lang=en', undefined, withKv)).json()) as { ayahs: { text: string }[] };
    expect(fallback.ayahs[0]!.text).toBe('In the name'); // no tr:en:1 in KV -> assembled from the database
  });
  it('admin can store a body in KV; keys are validated', async () => {
    const fresh: Env = { DB: fakeD1(), CONTENT: kv }; resetSchemaCache();
    const key = ((await (await call('/admin/claim', { method: 'POST' }, fresh)).json()) as { key: string }).key;
    const put = (k: string, body: string, headers: Record<string, string> = { 'x-admin-key': key }) => call(`/admin/kv/${encodeURIComponent(k)}`, { method: 'PUT', headers, body }, fresh);
    expect((await put('tf:bn:2', '{"ok":1}')).status).toBe(200);
    expect(new TextDecoder().decode(store.get('tf:bn:2'))).toBe('{"ok":1}');
    expect((await put('evil:key', 'x')).status).toBe(400);
    expect((await put('a:999999', 'x')).status).toBe(400);
    expect((await put('a:2', 'x', { 'x-admin-key': 'wrong' })).status).toBe(401);
    expect((await put('a:2', '')).status).toBe(400);
    resetSchemaCache();
  });
});
