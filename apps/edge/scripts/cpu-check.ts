/**
 * Rough CPU cost of each endpoint on a seeded database file (the free plan allows 10 ms CPU per request).
 *   node --experimental-strip-types scripts/cpu-check.ts /path/to/seeded.sqlite
 * Measured in Node with warm and cold runs; Cloudflare's own CPU numbers are visible in the dashboard's Functions metrics.
 */
import { app } from '../src/app.ts';
import { fakeD1 } from '../tests/d1.ts';

const env = { DB: fakeD1(process.argv[2] ?? '/tmp/cpu-test.sqlite') };
const paths: [string, RequestInit?][] = [
  ['/surahs'], ['/surahs/1/ayahs'], ['/surahs/2/ayahs'], ['/surahs/3/ayahs'], ['/surahs/2/translations?lang=bn'], ['/surahs/2/tafsir?lang=bn'], ['/surahs/2/tafsir?lang=en'],
  ['/ayahs/2:255/details'], ['/ayahs/1:1/details'], ['/tracks/frequent?size=300'], ['/tracks/frequent?size=1000'], ['/lessons'], ['/lessons/2'],
  ['/recitation/compare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ayahKey: '2:255', transcript: 'الله لا اله الا هو الحي القيوم لا تاخذه سنة ولا نوم' }) }],
  ['/media'], ['/credits'],
];
await app.fetch(new Request('http://x/api/v1/lessons'), env); // schema check happens once per server start, like a warm instance
for (const [p, init] of paths) {
  const times: number[] = []; let bytes = 0, status = 0;
  for (let i = 0; i < 6; i++) {
    const t0 = process.cpuUsage();
    const r = await app.fetch(new Request('http://x/api/v1' + p, init), env);
    const body = await r.arrayBuffer(); bytes = body.byteLength; status = r.status;
    const t = process.cpuUsage(t0); times.push((t.user + t.system) / 1000);
  }
  console.log(`${p.padEnd(38)} ${status} ${String(Math.round(bytes / 1024)).padStart(5)} KB   first ${times[0]!.toFixed(1).padStart(5)} ms   warm ${Math.min(...times.slice(1)).toFixed(1).padStart(5)} ms`);
}
