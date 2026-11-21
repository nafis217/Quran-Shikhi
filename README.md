# Quran Shikkha (working name)

Quran-learning app for Bangla-speaking beginners. Loop: Shuni → Bhangi → Bujhi → Govire Jai.
See [docs/architecture.md](docs/architecture.md), [docs/data-licenses.md](docs/data-licenses.md) and
[docs/pronunciation-rules.md](docs/pronunciation-rules.md).

## Run locally
```bash
pnpm install

# Backend (SQLite dev mode, no SQL Server or QF credentials needed)
cd backend/src/QuranShikkha.Api
ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --urls http://localhost:5038

# Speech model for the reading teacher (optional, private, on your machine)
cd services/asr && ./.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8001

# Web
cd apps/web && cp .env.example .env && pnpm dev        # http://localhost:5173

# Mobile (Android emulator reaches the host at 10.0.2.2)
cd apps/mobile && cp .env.example .env && pnpm start
```

## Tests
```bash
pnpm test                       # engine, learning-core
cd backend && dotnet test       # backend
LIVE_API=http://localhost:5038 pnpm --filter @quran-shikkha/pronunciation-engine test   # optional live smoke
```

## Regenerate the API client
Start the backend, then: `cd packages/api-client && pnpm fetch-spec && pnpm generate`.

## Real Quran Foundation data
Copy `.env.example` values into environment variables (`Qf__ClientId`, `Qf__ClientSecret`, `Qf__AuthBase`, `Qf__ApiBase`, `Qf__Environment`).
Credentials live only on the backend. Production also needs `Jwt__Key` and a SQL Server connection string; apply migrations with `dotnet ef database update`.

## Published version (Cloudflare, free)
The website and the API are one Cloudflare Pages project: the React app in `apps/web`, and the TypeScript API in `apps/edge`
(served from `functions/api/[[route]].ts`, data in a D1 database). The C# backend in `backend/` is the original and still works
for local development; the TypeScript one is checked against it (`apps/edge/scripts/compare-with-csharp.mjs`).

```bash
pnpm -C apps/edge test                       # API tests (no Cloudflare needed)
pnpm -C apps/web build && pnpm exec wrangler pages dev --port 8788    # whole site + API locally, empty database
curl -X POST http://127.0.0.1:8788/api/v1/admin/claim                 # once per fresh database: prints the admin key
node --experimental-strip-types apps/edge/scripts/seed.ts --url http://127.0.0.1:8788 --key <admin key>   # load all 114 surahs (~15 min)
```
See [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md) for publishing and updating.
