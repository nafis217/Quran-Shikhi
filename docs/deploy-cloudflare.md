# Publishing on Cloudflare (free plan)

## What runs where
| Part | Where | Notes |
|---|---|---|
| Website (React) | Cloudflare Pages, built from GitHub `main` | `apps/web` → `apps/web/dist` |
| API (TypeScript, Hono) | Pages Functions, same address (`/api/*`) | `apps/edge/src`, entry `functions/api/[[route]].ts` |
| Database | Cloudflare D1 (`DB` binding in `wrangler.jsonc`) | users, flashcards, progress, lessons and the per-ayah Quran texts |
| Big responses | Cloudflare KV (`CONTENT` binding) | each surah's ayahs, translations and tafsir stored as finished JSON and streamed untouched |
| Content loading | `apps/edge/scripts/seed.ts` run on a computer | downloads, reshapes and uploads all 114 surahs |

## Why the content is loaded by a script
The free plan gives every request **10 ms of CPU** and **50 outside calls**. Reshaping one big surah from the public sources takes
9–16 ms (measured), so it cannot happen inside a request. The seed script does it on a computer, and the server only stores and
serves ready-made text. Measured on the real data, assembling Al-Baqarah's ayahs or tafsir inside a request costs 14–60 ms of CPU
(Node, including database reads), so those bodies are stored whole in KV and streamed back without touching them. Single-ayah
details are put together as text (no parsing of the long tafsirs). The frequent-words list (sizes 300 and 1000) and the
"familiar words" lesson are also computed by the script. If KV is missing the server falls back to assembling from D1.

## First publish
1. Cloudflare → Storage & databases → D1 → create database `quranshikhi`, and Workers KV → create namespace `quranshikhi-content`; put both ids in `wrangler.jsonc`.
2. Workers & Pages → Create → Pages → import the GitHub repo. Project name `quranshikhi`. Build command
   `npx -y pnpm@11.24.0 -C apps/web build`, output directory `apps/web/dist`, variable `NODE_VERSION=22`.
3. Open `https://<project>.pages.dev/api/v1/admin/claim` **with POST** right away (`curl -X POST …`). It returns the admin key once and
   refuses everyone afterwards. Keep the key somewhere private (not in the repo).
4. Load the content: `node --experimental-strip-types apps/edge/scripts/seed.ts --url https://<project>.pages.dev --key <admin key>`.
   A full load writes ~51,000 D1 rows (free limit 100,000 a day) and ~800 KV keys (free limit 1,000 a day), so do not run it more than once a day.
5. Open the site. Every push to `main` redeploys it.

## Limits to know (free plan)
- 100,000 requests/day for the site's API, 5 million D1 row reads and 100,000 row writes per day, 100,000 KV reads and 1,000 KV writes per day.
- 10 ms CPU per request. `apps/edge/scripts/cpu-check.ts` estimates each endpoint; the dashboard's metrics show the real numbers after launch.
- No speech model online: the reading-check microphone button hides itself when `/api/v1/recitation/capabilities` says no.
- Progress and flashcards are stored in D1 per guest account; clearing the browser loses the guest token (same as before).
- Rate limiting inside the app is best-effort (per server instance). Add a Cloudflare rate-limiting rule if the site is ever public.
- Email/password and Google sign-in were **not** ported (no screen uses them; see architecture.md section 13).
- Content freshness: the content sources are the prototype ones listed in data-licenses.md. Re-run the seed when you want newer text.
