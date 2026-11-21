# Architecture (Deliverable 1)

## 1. Repo layout (monorepo, pnpm workspaces + .NET solution)

```
quran-shikhi/
├─ apps/
│  ├─ web/                    React + TS + Vite
│  └─ mobile/                 Expo (React Native) + TS
├─ packages/
│  ├─ api-client/             Typed client generated from the backend OpenAPI doc
│  └─ pronunciation-engine/   Pure TS: Arabic+harakat → Bangla + syllables (+ tests)
├─ backend/
│  ├─ src/QuranShikkha.Api/             Controllers, auth, OpenAPI
│  ├─ src/QuranShikkha.Core/            Domain entities, interfaces, SM-2, frequency logic
│  ├─ src/QuranShikkha.Infrastructure/  EF Core, QF client, cache, migrations
│  └─ tests/QuranShikkha.Tests/
├─ content/seed/              Our own seed data only (lessons, Shane Nuzul drafts). No QF text.
├─ docs/                      architecture, data-licenses, pronunciation-rules
└─ scripts/                   OpenAPI client generation, dev helpers
```

## 2. System diagram

```
 Web (React) ──┐                        ┌─ Quran Foundation Content API
               ├─► Our ASP.NET API ───►│   (OAuth2 client_credentials, backend only)
 Mobile (Expo)─┘     │   │              └─ audio.qurancdn.com (audio URLs)
                     │   └─ Cache (≤ 7 days)
                     └─ SQL Server (own data + user data)
```

Clients know only our API. QF credentials, tokens, and raw QF responses never leave the backend.

## 3. Key decisions

**Pronunciation engine in TypeScript.** The engine is used at content build and ingest time and could also run client-side. Writing it in TS lets web, mobile and tests share one implementation. The backend calls it through a build-time script that fills `Word.translitBangla` and `Syllable` rows. Alternative: write it in C# and keep everything server-side. This is the simpler option if we never need client-side use. Open question 3.

**Backend layering.** Api → Core ← Infrastructure. Core has no framework dependencies, so the SM-2 scheduler, frequency calculation, and the "show Shane Nuzul only if Reviewed" rule are plainly unit-testable.

**QF integration** (Deliverable 2):
- `IQfTokenProvider`: client_credentials against `{authBase}/oauth2/token`, token cached in memory until shortly before expiry, one in-flight refresh at a time.
- `IQfClient`: sends `x-auth-token` and `x-client-id`. Retries with exponential backoff and jitter, on 429 and 5xx only. Honors `Retry-After`.
- Environment (prelive or production) is chosen by config, with separate token caches so tokens never mix.
- Cache layer: `IMemoryCache` plus a SQL-backed cache table, hard TTL of 7 days.

**Content API shape (our own, versioned `/api/v1`).** Planned endpoints:
- `GET /surahs`, `GET /surahs/{n}/ayahs` returns ayahs with words, our Bangla transliteration, syllables, and meanings
- `GET /ayahs/{key}/details` returns translations, tafsir, context card (Reviewed only), audio
- `GET /words/{id}/related` returns same-root words
- `GET /tracks/frequent` returns frequency track, computed from data
- `POST /reports` is the "Report an issue" endpoint
- Auth: guest, email, Google. Guest progress is stored locally and merged on sign-up.

**Word identity.** One `Word.id` drives audio (`qfWordId` or audio key), meaning, and syllables. No parallel lookups by text.

**Tafsir placeholder handling.** The backend flags tafsir text containing "(আরবি)" with `hasPlaceholder: true`. The text is returned unmodified. The UI shows a notice and the "Report an issue" button.

**Offline (mobile).** User-initiated per-surah download, stored in app storage with a manifest. Deletion removes files and the manifest. The credits screen is bundled with the app.

**Frequency track.** Computed from stored Word rows by grouping on normalized Arabic text (and root if licensed data is available). Coverage percentages are calculated at query time and never hard-coded.

**Security.** Secrets come from environment variables or a secret manager. `.env.example` is committed, `.env` is not. Rate-limit our own public endpoints. Never log tokens.

## 4. Data model
As specified in the brief, with these additions:
- `Word.rootId` is nullable and stays empty until a root/morphology source's license is cleared (see data-licenses.md).
- `ContextCard.source` is required. UI queries filter on `reviewStatus = Reviewed`.
- `ContentReport(id, userId?, targetType, targetId, note, createdAt)` for "Report an issue".
- `QfCacheEntry(key, payloadJson, fetchedAt, expiresAt)` with a check that `expiresAt - fetchedAt ≤ 7 days`.
- `AppUser` supports guest (`isGuest`), email, and Google subject.

## 5. Phases
1. Docs and structure *(this deliverable)*
2. Backend: QF auth, proxy, cache, schema, migrations
3. Pronunciation engine and Al-Fatiha golden tests
4. Web reader
5. Mobile app, audio, offline
6. Lessons, flashcards, progress
7. Credits, states, accessibility

## 6. Decisions taken (defaults applied after "go all, don't ask")
1. **QF data is an expiring cache.** Cache TTL is capped at 7 days in code (`CachePolicy`), by a SQL check constraint, and by a purge job. User data (flashcards, progress) references a stable `WordKey` ("surah:ayah:position") with no foreign key to cached rows.
2. **Roots are deferred.** `Word.RootId` stays null and the UI hides root features until a license-cleared source is chosen.
3. **Pronunciation engine is TypeScript** and runs on the client. The backend does not run it, so `Word.TranslitBangla` and `Syllable` tables exist in the schema but are not populated.
4. **Dev data source.** With no QF credentials the backend uses api.alquran.cloud, which has no word-by-word data. Words are split on spaces and have no meanings or audio. Selected automatically when `Qf:ClientId` is empty. Remove before release.
5. **Syllable audio:** none. "Bhangi" plays the whole word at 0.6x while the highlight steps through the syllables.
6. **Tooling:** pnpm workspaces, plus a .NET 10 solution. EF Core is pinned to 10.0.x (11.x targets net11). SQLite is allowed for local development only (`Database:Provider=Sqlite`). Production uses SQL Server and migrations.

## 7. What is built (phase 1)
| Area | State |
|---|---|
| Backend | QF token provider, retrying client, cache, proxy endpoints, auth (guest/email/Google), lessons, flashcards (SM-2), progress, reports, credits. 32 tests. |
| Pronunciation engine | 29 Al-Fatiha word goldens (hand-derived), rule tests, optional live smoke test over 2,485 Fatiha + Juz Amma words. 53 tests. |
| Web | Reader with tap, double-tap, chip, details sheet, per-ayah ladder, lessons, familiar words, frequency track, flashcards, credits. Run in a browser against the dev source. |
| Mobile | Same screens, expo-av audio, user-initiated offline download and delete per surah. Typechecks and bundles with Metro for Android. **Never run on a device or emulator.** |

## 8. Not done / open
- Real QF integration is untested (no credentials).
- Google sign-in needs `Jwt:GoogleClientId` and a client-side sign-in flow. The backend verifies tokens. No client UI for email or Google login exists yet, only guest.
- Mobile not tested on a real or low-end Android device. Fonts and audio are unverified there.
- Scholar review is pending for pronunciation rules and for all Shane Nuzul seed cards (all Draft, so none are shown).
- Accessibility was designed in (labels, 44px targets, font scaling, contrast tokens, reduced motion) but has not been audited with a screen reader.
- Production needs a real `Jwt:Key`, a secret manager, SQL Server, and removal of the dev data source.

## 9. Teacher features (added after phase 1)
Writing feedback (heatmap and hints) and a reading check (speech-to-text compared with the ayah) are built for web. They are **not** Tajweed graders. See [ai-teacher.md](ai-teacher.md) for what they can and cannot judge, and the path to a real pronunciation model. The original "out of scope: AI recitation checking" line therefore no longer applies to the basic reading check, but still applies to Tajweed-level checking.

## 10. Whole Quran and the reading layout (added)
- **Scope** is now all 114 surahs (6,236 ayahs, 77,429 words) and all 30 juz. The juz start table is verified against the Quran API (0 mismatches) and the ayah counts sum to 6,236 (tests). The whole Quran is loaded in the background after startup and kept in memory for the frequency list and the familiar-words lesson.
- **Language** switches the whole UI (Bangla, English, Arabic with right-to-left layout), the surah names, the ayah meaning, the word meanings and the tafsir. Arabic-UI users get English word meanings (no Arabic word meanings exist in the sources) and the simple Arabic tafsir (Muyassar) as the ayah meaning.
- **Mixed directions.** Each ayah has two zones: Arabic (right-to-left, tinted, label at the right) and the meaning (left-to-right, or right-to-left for Arabic UI, label at its own start). A word's meaning sits directly under the word, so the order of Arabic words never has to be matched to a left-to-right line by eye. Optional side-by-side layout (Arabic right, meaning left) like a bilingual book.
- **Long surahs** are paged (15 ayahs per page) so Al-Baqarah (286 ayahs) stays fast.
- **Header** is the brand, five tabs and one Settings panel (language, theme, layout, text size, pronunciation guide, word meanings, hover audio).

## 11. Daily Arabic, games, Watch & Read (added)
- **Learn:** 212 everyday words in 14 categories (`learning-core/src/vocab`). Pictures are emoji; speech is the device voice. Games: picture quiz, listen-and-pick, memory match, spell-it (letter tiles), meaning quiz, a 60-second speed round (teens/adults). Stars and best score stay on the device. Words can be added to the SM-2 flashcards (key `v:<id>`).
- **Age group** (Settings): kids see games first and a parent note on videos; teens/adults see phrases and categories first and the speed round.
- **Watch & Read:** `GET /api/v1/media?age=kids|adults` serves the hand-picked embeddable YouTube list (validated: only plain 11-character video ids). `GET /api/v1/news?source=bbc|aljazeera|france24` fetches headlines from three allow-listed RSS feeds (size-capped, DTD-refusing XML parser, 15-minute cache, last good copy if a feed is down). The endpoint cannot fetch any other URL.
- **News as a lesson:** each headline is split into words; known words are underlined and tapping shows a "likely meaning" from our word lists. It is a hint, not a dictionary (it matches only common words).

## 12. Saving your place, progress and the reading plan (added)
Pure logic in `packages/learning-core/src/reading.ts` and `plan.ts` (93 tests); stored per device by `apps/web/src/lib/readingStore.ts` and `apps/mobile/src/readingStore.ts`. Home now answers "what do I do now?": Continue card (or one clear first step for a new user), today's strip (streak, goal, % of the Quran), today's plan, saved places, then everything else. See [reading-plan.md](reading-plan.md) for how the plan works and what it cannot do.
