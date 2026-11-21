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
