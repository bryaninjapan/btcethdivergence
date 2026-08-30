# Phase 2 Summary — Kline Backfill Engine

**Date:** 2026-08-31
**Phase:** 2 of 9
**Plans:** 02-01 (worker ingest engine, wave 1), 02-02 (external fetcher driver, wave 2) — 4 tasks total, **all completed**

## PLAN-GATE Status

The single PLAN-GATE on both plans — *owner confirms the SPIKE-REPORT `## Phase 2 Path` option (c) external-fetcher ingest* — is **satisfied**: SPIKE-REPORT.md records `Owner confirmation: ✅ 2026-08-31 — Proceed with option (c)`. That confirmation was committed as housekeeping (`9c7c6ae`) before execution began.

## Result Overview

4 of 4 tasks completed and committed. Phase 2 success criteria SC1–SC4 are proven end-to-end against the **deployed** Worker and **remote** D1:

| SC | Status | Evidence |
|----|--------|----------|
| SC1 — bounded batch (≤1000) fetched & stored | ✅ | 1000-candle POST → `inserted:1000`, remote `COUNT=1000`; real fetcher runs inserted 1000/run |
| SC2 — repeated calls advance stored cursor, within Free limits | ✅ | 3 consecutive fetcher runs advanced cursor 1616655600 → 1627473600; ingest does 0 external subrequests + 2 `db.batch()` round trips |
| SC3 — 429/418 back off / honor Retry-After | ✅ | Unit-proven (`decideBackoff`: 429 retry w/ Retry-After or 60s floor; 418 abort, never auto-retry); live 451 correctly aborted without hammering |
| SC4 — ≤16-row chunks via `db.batch()`, ≤100 bound params | ✅ | `buildKlineInsertChunks`: 14 rows × 7 params = 98 ≤ 100, 40 stmts/`db.batch()`, 1000 rows → 72 stmts → 2 calls; unit-tested |

## What Was Built

### Plan 02-01 — Worker Kline Ingest Engine
| File | Purpose |
|------|---------|
| `migrations/0003_create_backfill_state.sql` | `backfill_state` table (symbol PK, cursor_open_time, updated_at) — the stored per-symbol cursor |
| `src/lib/kline-insert.ts` | Pure chunked-insert builder: `chunkKlines` (≤14 rows) + `buildKlineInsertChunks` (INSERT OR IGNORE, ≤98 bound params/stmt, ≤40 stmts per `db.batch()` group) |
| `src/lib/kline-insert.test.ts` | 5 vitest tests: 1000 rows → 72 stmts in 2 groups, max params 98, tail chunk 42, symbol embedded per row |
| `src/lib/db.ts` | Added `getBackfillCursor` / `setBackfillCursor` / `insertKlinesBatch` — sole D1 access layer |
| `src/types.ts` | `Env` gains `INGEST_TOKEN` binding |
| `src/lib/validate.ts` | `ingestSchema`: symbol enum BTCUSDT/ETHUSDT, klines 1..1000 |
| `src/routes/admin.ts` | Bearer-token auth guard + `POST /api/admin/ingest` (Zod-before-DB) + `GET /api/admin/backfill-cursor` |
| `scripts/tsconfig.json` + `@types/node` + `typecheck:scripts` | Isolates the Node fetcher typecheck (workers-types + node combo) |
| `package.json` / `package-lock.json` | `@types/node`, `tsx`, `typecheck:scripts` script |

### Plan 02-02 — External Fetcher Driver
| File | Purpose |
|------|---------|
| `src/lib/backoff.ts` | Pure `parseRetryAfter` + `decideBackoff` (429→retry honoring Retry-After/60s floor; 418→abort; other→abort) + `sleep` |
| `src/lib/backoff.test.ts` | 8 vitest tests covering 429/418/403 decisions |
| `scripts/backfill-fetcher.mts` | Cursor-aware fetcher: reads stored cursor, fetches ≤1000 1h candles from Binance with backoff + weight logging, handles reached-now tail (exit 0, no empty POST), computes `done` from Binance's response size, POSTs to `/api/admin/ingest` |
| `.github/workflows/fetch-binance.yml` | `workflow_dispatch`-only driver (no `schedule:` — cron is Phase 3 scope), inputs symbol/start_time_override, runs the real fetcher |

## Findings That Need Owner Input

### [CONFLICT] GitHub Actions runner IPs are geo-blocked by Binance (451)
The plan assumed GH runner IPs reach Binance ("spike proved 403 from Workers; GitHub's IPs reach Binance successfully"). **Verified false**: two real `workflow_dispatch` runs both failed at the fetch step with `Binance returned 451` (Unavailable For Legal Reasons — geo-block of Azure/US datacenter IPs). The workflow artifact is correct as a Phase-2 dispatch driver, but **cannot complete a run on GitHub-hosted runners**.

- **Does NOT block Phase 2**: all SCs are proven via the local-machine path (verified HTTP 200).
- **Blocks Phase 3 planning assumption**: the daily cron *cannot* run on GitHub-hosted runners. Options for the owner: (a) local `launchd`/`crontab` running the same fetcher (WARNING-02's suggested fallback), (b) a self-hosted runner on the local machine, (c) another non-blocked fetch site. This needs an owner decision before Phase 3.

### Stale worker URL in plan/user_setup (`swadmin31.workers.dev`)
The plan's URLs and 02-02's `WORKER_URL` secret spec pointed at `https://btcethdivergence.swadmin31.workers.dev`. That host serves a **stale worker from a different Cloudflare account** (no ingest route — returns 404 on POST /api/admin/ingest). The authoritative Phase 2 deployment (authenticated account, wired to the live D1) is `https://btcethdivergence.gn01968711.workers.dev`, which is what I used for all verification and set as the GitHub `WORKER_URL` secret. Owner may want to reconcile/retire the `swadmin31` account's duplicate worker.

## Deviations from Plan (all logged)

1. **`scripts/tsconfig.json` `include` extended to `["**/*.mts", "../src/**/*.ts"]`** (plan said `["**/*.mts"]`): with zero `.mts` files at 02-01 time, `tsc --project scripts` errored TS18003 ("no inputs"), breaking the plan's own `typecheck:scripts` verify. Also used `types: ["node", "@cloudflare/workers-types"]` per PLAN-CHECK WARNING-01's fix hint (proven clean — the node+workers-types combo typechecks the whole src tree + fetcher).
2. **`buildKlineInsertChunks(symbol, klines)` signature**: the plan's literal signature omitted `symbol`, but the SQL embeds it per-row; `db.ts` already has it, so the builder takes it as the first param.
3. **Remote migrations adopted via manual `d1_migrations` seeding**: the remote D1 had `klines`/`divergence_records` applied outside migrations tracking, so `migrations apply --remote` tried to re-run 0001 ("table klines already exists"). I created the tracking table and marked 0001/0002 applied (mirroring local), then applied 0003 normally.
4. **GitHub `WORKER_URL` secret set to the gn01968711 URL** (see finding above), not the plan's swadmin31 URL.
5. **Purged 2000 synthetic test klines** (inserted during 02-01's 1000-candle verify) from remote D1 so Phase 3's real crawl isn't skipped by `INSERT OR IGNORE` over fake data. Remote D1 now holds only real Binance data: 3000 BTCUSDT rows, 2021-03-25 → 2021-06-01.

## Carried-Over / Housekeeping Notes

- **INFO-04** (from Phase 1): `/api/admin/binance-spike` remains unauthenticated — unchanged, must be Access-gated by Phase 9.
- Stale GitHub secret **`WORKER_API_KEY`** (used only by the removed Phase-1 workflow stub) is still set — safe to delete; not removed since it's outside plan scope.
- Workflow pins `node-version: 20`, which GH now deprecates (auto-forced to 24). Harmless now; revisit when the GH-runner path is reworked.
- `.dev.vars` (gitignored) gained `INGEST_TOKEN` for local `wrangler dev`.
- ROADMAP/STATE progress tables still show Phase 2 as TBD / Phase 1 focus — recommend updating at phase transition (INFO-06).

## Verification Commands (end-to-end phase goal)

```bash
# Unit tests + typecheck
npm run typecheck && npm run typecheck:scripts && npx vitest run

# No cron in Phase 2
grep -c "schedule:" .github/workflows/fetch-binance.yml   # → 0

# Auth gating
curl -s -o /dev/null -w '%{http_code}' -X POST https://btcethdivergence.gn01968711.workers.dev/api/admin/ingest \
  -H 'Content-Type: application/json' -d '{"symbol":"BTCUSDT","klines":[]}'   # → 401

# Stored cursor (advances per ingest)
curl -sf "https://btcethdivergence.gn01968711.workers.dev/api/admin/backfill-cursor?symbol=BTCUSDT" \
  -H "Authorization: Bearer $INGEST_TOKEN"

# Real data persisted
npx wrangler d1 execute btcethdivergence --remote --command "SELECT symbol, COUNT(*) AS c FROM klines GROUP BY symbol"

# Fetcher driver (local machine — the only non-blocked path)
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev INGEST_TOKEN=$INGEST_TOKEN SYMBOL=BTCUSDT \
  npx tsx scripts/backfill-fetcher.mts   # run repeatedly to advance the cursor
```

## Commit Range

`git log --oneline 6866741..HEAD` — see below.

```text
a3f1650 feat(phase-2): include underlying Binance status in abort log line
e27b518 feat(phase-2): rewrite fetch workflow as manual dispatch-only backfill driver
4c430d5 feat(phase-2): backoff decision module + cursor-aware external backfill fetcher
859eb90 feat(phase-2): authenticated ingest + backfill-cursor admin routes
46164ff feat(phase-2): backfill_state migration + chunked D1 insert builder + cursor repo
9c7c6ae docs(phase-1): record owner sign-off on external-fetcher path; fix D1 database_id
```