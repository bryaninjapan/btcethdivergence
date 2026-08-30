# Phase 3 Summary — Historical Load & Cron Sync

**Date:** 2026-08-31
**Phase:** 3 of 9
**Plans:** 03-01 (Historical Load & Cron Sync) — **all 3 tasks are `Owner Action` and BLOCKED on a human checkpoint**

## Result Overview

No plan task could be executed autonomously: the plan's Task Breakdown explicitly labels all three tasks **Owner Action** (03-01 backfill crawl, 03-02 launchd setup, 03-03 idempotency re-check). Per execution rules, these are human gates — they require the owner's `INGEST_TOKEN` secret and a live multi-hour crawl against Binance + production D1, plus macOS system config (`~/Library/LaunchAgents/`). I did **not** fabricate credentials or kick off a 2–4h crawl against the live Worker/D1 without explicit owner confirmation.

Everything that CAN be verified read-only was verified and is **green**:

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ passes |
| `npm run typecheck:scripts` | ✅ passes |
| `npx vitest run` | ✅ 38/38 pass (6 files) |
| Worker live | ✅ `https://btcethdivergence.gn01968711.workers.dev/` → 200 |
| `/api/health` | ✅ `{"ok":true,"data":{"status":"ok"}}` |
| Security scan (DEV_* / hardcoded secrets / dead code) | ✅ clean — no [SECURITY]/[CLEANUP] fixes needed |
| `.gitignore` hygiene (INFRA-05) | ✅ `.dev.vars`, `.wrangler/`, `node_modules/` all check-ignored |
| Phase 2 dependency | ✅ complete (fetcher, ingest route, cursor, `INSERT OR IGNORE` all present & tested) |

## Current Live D1 State (baseline for the crawl)

```
klines:        BTCUSDT 3000 rows, 2021-03-25 (1616659200) → 2021-07-28 (1627473600)
               ETHUSDT  0 rows
backfill_state: BTCUSDT cursor_open_time = 1620273600 (2021-05-06 04:00 UTC)
               ETHUSDT no row
```

### [CONFLICT] Stored cursor is BEHIND the max stored candle
The stored `backfill_state.cursor_open_time` (1620273600 = **2021-05-06**) lags the max stored kline open_time (1627473600 = **2021-07-28**). The Phase 2 summary recorded the cursor at 1627473600 after 3 fetcher runs, so something reset it afterward (or a `START_TIME_OVERRIDE` run inserted past it).

**Impact:** a re-run of the fetcher will start at cursor+3600 = 2021-05-06 05:00 and re-fetch ~2000 already-stored candles before continuing forward. Safe — every re-fetch is skipped via `INSERT OR IGNORE` (no duplicates) — but wasteful, and it is *why* the owner should consider clearing the cursor for a clean 2021-01 crawl:

```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "DELETE FROM backfill_state WHERE symbol='BTCUSDT'"
```

### Verified: the 2 gaps in the partial dataset are Binance-side, not data loss
The corrected gap-check SQL (plan's version had a bug, see below) reports 2 gaps in BTCUSDT. I queried Binance directly for both windows — Binance itself has no candles there:
- 2021-04-20 02:00–03:00 UTC
- 2021-04-25 05:00–07:00 UTC

So they are **explained gaps** (no 1h candles exist on Binance), consistent with SC1 "no unexplained gaps". The 2021-01 → 2021-03-25 window is simply not loaded yet (crawl starts there after cursor clear).

## Task Status

| Task | Status | Why |
|------|--------|-----|
| 03-01 Historical Backfill Execution | **BLOCKED — Owner Action** | Requires owner to run the fetcher loop for BTCUSDT then ETHUSDT until "reached now" (2–4h live crawl against Binance + remote D1, needs `INGEST_TOKEN`). No code change is involved. |
| 03-02 launchd Setup & Validation | **BLOCKED — Owner Action** | Requires owner to create `~/.config/btcethdivergence/ingest-token` (secret on disk), the two launchd plists in `~/Library/LaunchAgents/`, and `launchctl load`. |
| 03-03 Re-run Idempotency Check | **BLOCKED — depends on 03-01** | Runs after the crawl completes. |

## Deviation from Plan (logged)

1. **Corrected the plan's gap-check verification SQL.** The plan's Stage 1 query referenced the window-function alias `prev_time` inside `WHERE`:
   ```sql
   WHERE open_time - prev_time > 3600
   ```
   This is invalid SQL — window-function aliases cannot be referenced in the same `WHERE`. The working version wraps the window in a subquery:
   ```sql
   SELECT symbol, COUNT(*) AS gap_count FROM (
     SELECT symbol, open_time,
            open_time - LAG(open_time) OVER (PARTITION BY symbol ORDER BY open_time) AS diff
     FROM klines
   ) WHERE diff > 3600 GROUP BY symbol;
   ```
   Verified against remote D1 (returns `BTCUSDT gap_count=2`, both Binance-side). Use the corrected version below.

## What the Owner Must Do (exact commands)

### 1. Clear stale cursor (recommended, for a clean 2021-01 → present crawl)
```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "DELETE FROM backfill_state WHERE symbol='BTCUSDT'"
```

### 2. Run the backfill loop (task 03-01)
```bash
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts
```
Repeat until the fetcher logs `reached now` (exit 0). Then repeat with `SYMBOL=ETHUSDT` until `reached now`. `INGEST_TOKEN` can be sourced from `.dev.vars` or the GitHub secret.

### 3. Verify SC1 (data span + corrected gap check)
```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) AS count, MIN(open_time) AS earliest, MAX(open_time) AS latest FROM klines GROUP BY symbol"

npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) AS gap_count FROM (SELECT symbol, open_time, open_time - LAG(open_time) OVER (PARTITION BY symbol ORDER BY open_time) AS diff FROM klines) WHERE diff > 3600 GROUP BY symbol"
```
Expect: both symbols present, spanning 2021-01 → present, gap_count = 0 (or only gaps that Binance itself lacks).

### 4. Set up launchd (task 03-02)
```bash
mkdir -p ~/.config/btcethdivergence
chmod 700 ~/.config/btcethdivergence
echo "$INGEST_TOKEN" > ~/.config/btcethdivergence/ingest-token
chmod 600 ~/.config/btcethdivergence/ingest-token
```
Then save the two plists from 03-01-PLAN.md (`com.btcethdivergence.backfill.plist` @ 02:00 UTC for BTCUSDT, `com.btcethdivergence.backfill-eth.plist` @ 18:00 UTC for ETHUSDT) to `~/Library/LaunchAgents/` and run:
```bash
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill.plist
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist
launchctl list | grep btcethdivergence
```

### 5. Verify idempotency (task 03-03, SC2)
```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) AS before_count FROM klines WHERE symbol='BTCUSDT'"

WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts   # expect: { inserted: 0, skipped: N, ... }

npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) AS after_count FROM klines WHERE symbol='BTCUSDT'"
```
Expect `before_count == after_count` and the fetcher logging `skipped > 0`, `inserted: 0`.

### 6. Verify cron runs (SC3)
After 02:00 UTC and 18:00 UTC, check logs:
```bash
tail -20 ~/.config/btcethdivergence/backfill.log       # BTCUSDT
tail -20 ~/.config/btcethdivergence/backfill-eth.log   # ETHUSDT
```
Expect `{ inserted: N, skipped: M, cursor: X }` and/or `reached now`.

## Files (what exists / what Phase 3 relies on)

- `scripts/backfill-fetcher.mts` — cursor-aware fetcher (Phase 2) used unchanged for both the crawl and the daily cron.
- `src/routes/admin.ts` — `POST /api/admin/ingest` + `GET /api/admin/backfill-cursor`, Bearer-token gated.
- `src/lib/kline-insert.ts` — `INSERT OR IGNORE` chunked builder (idempotency guarantee, SC2).
- `src/lib/db.ts` — `getBackfillCursor` / `setBackfillCursor` / `insertKlinesBatch`.
- `src/lib/backoff.ts` — 429/418 handling, `Retry-After` honored.
- No new code was written this phase — Phase 3 is execution-only.

## Commit Range

No commits this phase — all tasks are owner-gated; nothing to commit. Summary written at `HEAD` = `d66c2e6`.

## Next Action

Owner runs the Stage 1 crawl (commands above). No PLAN-GATE markers exist in the plan. Once 03-01/03-02/03-03 complete, SC1/SC2/SC3 are provable with the commands in §3/§5/§6.