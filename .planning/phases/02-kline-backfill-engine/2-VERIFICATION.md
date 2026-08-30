# Phase 2 Verification Report

**Date:** 2026-08-31
**Verifier:** gsd-verifier (goal-backward, read-only pass)

## Summary

**4 of 4 criteria PASS** against the real, current state of the repo and live infrastructure (deployed Worker `btcethdivergence.gn01968711.workers.dev`, remote D1, live Binance API).

All four success criteria are confirmed with live/current evidence. One **non-criterion quality-gate regression** was found: `npm run typecheck:scripts` now fails (TS18047), contradicting `2-SUMMARY.md`'s claim that it was "proven clean." It does not falsify any of the four success criteria (the deployed Worker typechecks clean and `tsx` executes the fetcher without typechecking), but it breaks the phase's own PLAN verification track and should be fixed.

Also noted: the stored cursor currently reads `1620273600` (2021-05-06), behind the `1627473600` value `2-SUMMARY.md` recorded, and behind the max stored kline. This is consistent with the synthetic-data purge + re-backfill (the cursor is exactly 1000 hours after the min stored kline) and does not violate SC2's advance mechanism, but it is a state discrepancy vs. the summary's wording.

## Criterion-by-Criterion Verification

### 1. "Calling the admin backfill endpoint fetches one bounded batch (up to 1000 candles) of BTCUSDT or ETHUSDT klines from Binance and stores them in D1."

- Evidence (live, current — not re-run writes; the endpoint was exercised read-only where safe):
  - Auth gate live: `curl -X POST .../api/admin/ingest` (no token) → `HTTP 401`.
  - Bound cap live: POST of 1001 klines with valid Bearer token → `HTTP 400` (rejected by `ingestSchema.klines.max(1000)` **before any DB call**).
  - Validation live: bogus symbol → `HTTP 400`; empty klines array → `HTTP 400`; malformed JSON → `HTTP 400`.
  - Persistence (current remote D1 state): `SELECT symbol, COUNT(*) AS c, MIN(open_time), MAX(open_time) FROM klines GROUP BY symbol` → `[{"symbol":"BTCUSDT","c":3000,"min_ot":1616659200,"max_ot":1627473600}]` — 3000 real Binance klines are stored in D1, i.e. storage half is true right now.
  - Fetch half: live Binance reachable from this machine: `GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1` → `HTTP 200`; `scripts/backfill-fetcher.mts` reads the stored cursor and POSTs fetched klines to the ingest endpoint.
  - Schema: `ingestSchema` (`src/lib/validate.ts:37`) is `symbol: z.enum(['BTCUSDT','ETHUSDT'])`, `klines: z.array(...).min(1).max(1000)`.
- Verdict: **PASS**

### 2. "Repeated calls to the backfill endpoint advance a stored cursor forward in time until reaching 'now,' each call completing within the Workers Free-plan CPU (10ms) and subrequest (50) limits."

- Evidence (live, current):
  - Stored cursor live and readable: `GET /api/admin/backfill-cursor?symbol=BTCUSDT` with Bearer → `{"ok":true,"data":{"symbol":"BTCUSDT","cursor":1620273600,"default":1609459200}}`.
  - Cursor persisted in D1: `SELECT symbol, cursor_open_time, updated_at FROM backfill_state` → `[{"symbol":"BTCUSDT","cursor_open_time":1620273600,"updated_at":1788106015}]`.
  - Advance mechanism in code: `POST /api/admin/ingest` sets `cursor = klines[klines.length-1].open_time` via `setBackfillCursor` (`src/routes/admin.ts:80-81`, `src/lib/db.ts:94-106`); fetcher starts next run at `cursor + 3600` (`scripts/backfill-fetcher.mts:74-78`), so repeated calls march forward.
  - Free-limit evidence: ingest handler performs **0 external subrequests** and only D1 `db.batch()` calls (`src/routes/admin.ts:77-86`); a full 1000-candle batch = 72 statements = **2 `db.batch()` round trips** (verified independently below), under the 50-subrequest cap. Full 1000-candle batches have demonstrably been stored on the deployed Worker (3000 rows present), empirically proving the D1 batch path succeeds within Free limits.
- Verdict: **PASS**

### 3. "When Binance returns a 429 or 418, the backfill endpoint backs off or honors `Retry-After` instead of erroring out or hammering the API."

- Evidence (live logic + tests):
  - `decideBackoff` executed live via `tsx` against the actual module:
    - 429 + `Retry-After: 30` → `{"action":"retry","waitSeconds":30}`
    - 429, no header → `{"action":"retry","waitSeconds":60}` (floor only)
    - 418 + `Retry-After: 300` → `{"action":"abort","waitSeconds":300}` (never auto-retry)
    - 418, no header → `{"action":"abort","waitSeconds":120}`
    - 451 (the geo-block) → `{"action":"abort","waitSeconds":null}`; 403 → abort
  - Fetcher behavior (`scripts/backfill-fetcher.mts:16-42`): on `retry` it `sleep(Retry-After seconds)` then retries **once**; if the retry also fails it exits 1 (no further hammering). On `abort` it exits 1. 451 is a non-retryable status → abort, no hammering.
  - `binance.ts` surfaces `Retry-After` and `X-MBX-USED-WEIGHT-1M`; 429/418 classified as `BinanceError` with `retryAfter` (`src/lib/binance.ts:44-63`).
  - Unit tests green: `npx vitest run` → 6 files, **38 tests passed**, including all 8 `backoff.test.ts` cases (429 Retry-After / 60s floor, 418 abort, 403 abort).
- Verdict: **PASS**

### 4. "Each backfill batch insert is split into chunks of at most 16 rows via `db.batch()`, never exceeding D1's 100 bound-parameter ceiling."

- Evidence (independent live execution of the builder):
  - `buildKlineInsertChunks('BTCUSDT', 1000 klines)` → `totalStmts: 72 | db.batch() groups: 2 | max bound params/stmt: 98`.
  - Rows per statement = 14 (14 × 7 params = 98 ≤ 100; 14 ≤ 16 per the criterion). Statements grouped 40 per `db.batch()` call.
  - Unit tests (`src/lib/kline-insert.test.ts`) assert: 1000 rows → 72 chunks of ≤14; 2 groups (40 + 32 stmts); max params 98; final partial chunk 42 params; symbol embedded per row. All green in the 38-test run.
- Verdict: **PASS**

## Regression Check (prior phase)

No `VERIFICATION.md` exists for Phase 1 (none in `01-worker-foundation-binance-spike/`), so a spot-check against Phase 1's confirmed behaviors:

- `{ok, data|error}` envelope intact: `GET /api/health` → `{"ok":true,"data":{"status":"ok"}}` (live).
- Static asset bundle served via the Worker: `GET /` → `HTTP 200` (live).
- `.dev.vars` / `.wrangler/` not git-tracked: `git ls-files` shows no matches; both in `.gitignore`.
- Result: **no Phase 1 regression detected.**

## Deviations Honesty Check

- **`npm run typecheck:scripts` fails** — `tsc --project scripts` exits 1: `scripts/backfill-fetcher.mts(32,17): error TS18047: 'decision.waitSeconds' is possibly 'null'.` This was introduced by commit `4413779` (the IN-01 code-review "fix", in the phase-2 commit range), which replaced `await sleep((decision.waitSeconds ?? 0) * 1000)` with `await sleep(decision.waitSeconds * 1000)`. `BackoffDecision` is an interface (not a discriminated union), so TS does not narrow `waitSeconds` to `number` after the `action !== 'retry'` early-exit. This contradicts `2-SUMMARY.md`'s claim that the node+workers-types combo typechecks "the whole src tree + fetcher." It does not falsify any SC (the deployed Worker typechecks clean via `npm run typecheck`; `tsx` runs the fetcher without typechecking), but it breaks the PLAN's own verification track (`02-02` Task 1 verify: "`npm run typecheck:scripts` exits 0").
- **Cursor state vs. summary**: `2-SUMMARY.md` records the cursor advancing to `1627473600`; it now reads `1620273600` (exactly 1000h after the min stored kline). Consistent with the post-purge re-backfill; the advance mechanism is intact. Not a criterion violation, but a factual drift from the summary.
- GitHub-runner 451 geo-block: honestly logged in the summary; it blocks only the GH-runner path, not the local path (verified live: Binance HTTP 200 from this machine). Does not silently violate any criterion.
- `02-REVIEW.md` findings: CR-01, WR-01, WR-02, WR-03, IN-02 are genuinely fixed in the current files (verified by reading `scripts/backfill-fetcher.mts`, `src/routes/admin.ts`, `src/lib/validate.ts`, and `scripts/backfill-fetcher.test.mts`). IN-01's "fix" is the cause of the `typecheck:scripts` regression above.

## Conclusion

All 4 criteria PASS with current live evidence.

- C1 (bounded batch stored in D1): PASS
- C2 (cursor advance + Free-plan limits): PASS
- C3 (429/418 backoff / Retry-After): PASS
- C4 (≤16-row chunks, ≤100 bound params): PASS

Non-blocking for the criteria but must be fixed for repo hygiene and to restore the plan's verification gate:

1. **Restore `npm run typecheck:scripts` (exit 0)** — `scripts/backfill-fetcher.mts:32`: revert the IN-01 change to `await sleep((decision.waitSeconds ?? 0) * 1000)` (or use `decision.waitSeconds!`). Small, obvious fix; the summary's "typecheck clean" claim is currently false.
2. Optional: reconcile the stored-cursor value/documentation (`1620273600` vs `1627473600`) if the owner expected it further advanced.

Recommendation: **READY FOR PRODUCTION** for the Phase 2 goal (all 4 success criteria true right now), with the `typecheck:scripts` regression fixed first in priority order — it breaks the phase's own verification command and the claim in `2-SUMMARY.md`.