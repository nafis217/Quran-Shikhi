// Side-by-side check: the same request goes to the original C# backend and to the TypeScript one; status and body must match.
//   node scripts/compare-with-csharp.mjs [--cs http://localhost:5038] [--ts http://127.0.0.1:8788] [--all]
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const CS = arg('cs', 'http://localhost:5038'), TS = arg('ts', 'http://127.0.0.1:8788'), ALL = process.argv.includes('--all');

const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const diffs = []; let checked = 0, same = 0;
const known = []; // differences we expect and accept (each with the reason)

async function call(base, path, init) {
  const r = await fetch(base + '/api/v1' + path, init);
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
function firstDiff(a, b, path = '') {
  if (typeof a !== typeof b || (a === null) !== (b === null)) return `${path}: ${JSON.stringify(a)?.slice(0, 80)} != ${JSON.stringify(b)?.slice(0, 80)}`;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return `${path}: array vs not`;
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && typeof a === 'object') {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) { const d = firstDiff(a[k], b[k], `${path}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)?.slice(0, 120)} != ${JSON.stringify(b)?.slice(0, 120)}`;
}
async function check(path, init, { statusOnly = false, ignore = () => false } = {}) {
  const [c, t] = await Promise.all([call(CS, path, init), call(TS, path, init)]);
  checked++;
  if (c.status !== t.status) { diffs.push(`${init?.method ?? 'GET'} ${path}: status C# ${c.status} vs TS ${t.status}`); return; }
  if (statusOnly) { same++; return; }
  const d = firstDiff(canon(c.body), canon(t.body));
  if (d && !ignore(d)) diffs.push(`${init?.method ?? 'GET'} ${path}: ${d}`); else same++;
}
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const surahs = ALL ? Array.from({ length: 114 }, (_, i) => i + 1) : [1, 2, 3, 4, 18, 36, 55, 67, 78, 93, 103, 111, 112, 113, 114];
await check('/surahs');
for (const n of surahs) {
  await check(`/surahs/${n}/ayahs`);
  for (const l of ['bn', 'en', 'ar']) { await check(`/surahs/${n}/translations?lang=${l}`); await check(`/surahs/${n}/tafsir?lang=${l}`); }
}
const fixed = ['1:1', '1:7', '2:1', '2:6', '2:255', '2:282', '3:18', '36:1', '55:13', '67:1', '93:1', '111:1', '112:1', '114:6'];
const random = []; for (let i = 0; i < (ALL ? 300 : 50); i++) { const s = 1 + Math.floor(Math.random() * 114); random.push(`${s}:${1 + Math.floor(Math.random() * 7)}`); }
for (const k of [...fixed, ...random]) await check(`/ayahs/${k}/details`);
for (const s of [5, 300, 1000]) await check(`/tracks/frequent?size=${s}`);
await check('/tracks/frequent');
for (const id of [1, 2, 3, 4, 40, 41, 9999]) await check(`/lessons/${id}`);
for (const p of ['/lessons', '/credits', '/media', '/media?age=kids', '/media?age=adults', '/news/sources']) await check(p);

const EXP = 'الحمد لله رب العالمين';
const transcripts = [[ '1:2', EXP ], ['1:2', 'الحمد لله العالمين'], ['1:2', 'الحمد لله ربي العالمين'], ['1:2', 'الْحَمْدُ لِلَّهِ رَبِّ الْحَالَمِينَ'], ['1:2', 'الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ'],
  ['1:2', 'hello 123'], ['2:255', 'الله لا اله الا هو الحي القيوم'], ['112:1', 'قل هو الله احد'], ['1:1', 'بسم الله الرحمن الرحيم']];
for (const [k, t] of transcripts) await check('/recitation/compare', post({ ayahKey: k, transcript: t }));
for (const bad of [{ ayahKey: 'bad', transcript: 'x' }, { ayahKey: '1:1', transcript: '  ' }, { ayahKey: '115:1', transcript: 'x' }]) await check('/recitation/compare', post(bad));
await check('/recitation/capabilities');

// error behaviour
for (const p of ['/surahs/115/ayahs', '/surahs/0/ayahs', '/surahs/1/translations?lang=xx', '/surahs/115/tafsir?lang=bn', '/ayahs/1:0/details', '/ayahs/115:1/details', '/tracks/frequent?size=abc', '/news?source=evil'])
  await check(p, undefined, { statusOnly: true });
await check('/flashcards/due', undefined, { statusOnly: true });
await check('/progress', undefined, { statusOnly: true });

console.log(`checked ${checked}, identical ${same}, different ${diffs.length}`);
for (const d of diffs.slice(0, 40)) console.log(' -', d);
if (diffs.length > 40) console.log(`   ... and ${diffs.length - 40} more`);
process.exit(diffs.length ? 1 : 0);
