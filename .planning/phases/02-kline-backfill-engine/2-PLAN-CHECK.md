# Phase 2 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial)
**Date**: 2026-08-31
**Phase**: 2 — Kline Backfill Engine
**Plan(s) verified**: `02-01-PLAN.md`, `02-02-PLAN.md`
**Status**: **ISSUES FOUND — 0 blocker(s), 3 warning(s), 6 info**

## 1. Coverage Summary

Phase requirements (ROADMAP Phase 2): DATA-01, DATA-04, DATA-05, DATA-06.

| Requirement | Plan | Task(s) | Evidence |
|---|---|---|---|
| DATA-01 — fetch 1h OHLCV from Binance for BTCUSDT + ETHUSDT | 02-02 | T1 fetcher calls `fetchKlines('https://api.binance.com', SYMBOL, startTimeMs, 1000)` (default BTCUSDT, ETHUSDT via workflow input); T2 workflow `symbol` choice | `src/lib/binance.ts:31-67` signature `fetchKlines(host, symbol, startTime, limit=1000)` verified |
| DATA-04 — cursor-paginated admin backfill endpoint, 2021-01→present, no subrequest/CPU breach | 02-01 | T1 `backfill_state` table + `getBackfillCursor`/`setBackfillCursor`; T2 `POST /api/admin/ingest` + `GET /api/admin/backfill-cursor`, cursor advanced every call; origin 1609459200 = 2021-01-01 | T2 verify: two consecutive POSTs advance the cursor; ingest does zero external `fetch()` and 2 `db.batch()` calls |
| DATA-05 — rate limits: X-MBX-USED-WEIGHT-1M, Retry-After on 429, backoff on 418 | 02-02 | T1 `decideBackoff` (429→honor Retry-After, 60s floor; 418→abort no auto-retry) + vitest suite; `result.weight` logged per run | `binance.ts:40-59` already captures weight header + classifies 429/418 as `BinanceError(retryAfter)` — verified |
| DATA-06 — chunked `db.batch()` ≤16 rows/stmt, ≤100 bound params | 02-01 | T1 `buildKlineInsertChunks`: 14 rows/stmt × 7 params = 98 ≤ 100, statements grouped ≤40 per `db.batch()`; unit tests assert ≤98 params, 1000→72 stmts→2 batch calls | `0001_create_klines.sql` has exactly 7 columns; PK `(symbol, open_time)`; math independently re-checked (72=ceil(1000/14); 2=ceil(72/40); tail 6 rows × 7 = 42) |

**Coverage verdict**: All 4 requirements have concrete covering tasks. PASS.

## 2. Success Criteria Traceability

| Success Criterion | Delivering task(s) | Verdict |
|---|---|---|
| SC1 — backfill endpoint fetches one bounded batch (≤1000 candles) of BTCUSDT/ETHUSDT and stores in D1 | 02-01 T2 (ingest persists ≤1000 via Zod `.max(1000)`, verify: 1000-candle POST → remote `COUNT=1000`) + 02-02 T1/T2 (fetcher pulls ≤1000/run and POSTs) | COVERED under locked external-fetcher architecture — see WARNING-03 |
| SC2 — repeated calls advance a stored cursor until "now", within Free CPU (10ms) / subrequest (50) | 02-01 T1 (`backfill_state`, cursor repo) + T2 (advance per call; two-POST verify) + 02-02 T2 (two consecutive fetcher runs, cursor non-decreasing, reached-now tail exits 0) | COVERED. "Until now" is mechanism-proven in Phase 2; full crawl is Phase 3 by roadmap design → INFO-06 |
| SC3 — 429/418 → back off / honor Retry-After, no error-out, no hammering | 02-02 T1 `decideBackoff` + tests (429 retry honoring Retry-After w/ 60s floor; 418 abort; single retry max) | COVERED |
| SC4 — insert split into chunks ≤16 rows via `db.batch()`, never exceed 100 bound params | 02-01 T1 `buildKlineInsertChunks` (14 rows, 98 params, ≤40 stmts per `db.batch()`) + tests (assert ≤98; 1000→72 stmts→2 calls) | COVERED |

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|---|---|---|
| 1 | Requirement Coverage | PASS | All 4 reqs covered |
| 2 | Task Completeness | PASS (1 WARNING) | 4/4 tasks have concrete files, actions, verify, done criteria. Residual typecheck risk → WARNING-01; task-level `<files>` mismatch → INFO-05 |
| 3 | Dependency Correctness | PASS | Acyclic: 01-03 → 02-01 (wave 1) → 02-02 (wave 2); per-task preconditions explicit |
| 4 | Key Links / Wiring | PASS | `admin.ts → db.ts → kline-insert.ts`; fetcher → `binance.ts` + `backoff.ts` → `/api/admin/ingest`; every artifact feeds a SC |
| 5 | Scope Sanity | PASS | 2 plans × 2 tasks, well within 2–3 target |
| 6 | Success-Criteria Traceability | PASS | All 4 SCs covered (§2); SC1 wording drift → WARNING-03 |
| 7 | Locked Decision Compliance | PASS | Single Worker + D1, Binance public API, 1h-only, external-fetcher path (SPIKE-REPORT verdict) honored; no cron in Phase 2 (correctly Phase 3); no CONTEXT.md / no D-XX decisions exist to violate |
| 8 | Scope Reduction Detection | PASS | No v1/stub/placeholder/for-now on any SC-required work; `schedule:` removal is correct scope separation, not hedging |
| 9 | Verification Plan Quality | PASS (1 WARNING) | typecheck + vitest + deployed curl + `d1 execute` counts + grep checks throughout. W-1: `typecheck:scripts` config as specified is fragile |
| 10 | Fact-check load-bearing claims | PASS | All verified against source: 7-col klines table + PK; `fetchKlines` signature, weight header, 429/418 `BinanceError(retryAfter)`; `app.route('/', admin)` mounted (`src/index.ts:12`); existing workflow has `schedule:` + raw-array POST + `WORKER_API_KEY`; `Env={DB}`; `jsonOk/jsonError` signatures; migration numbering 0001/0002→0003; `@types/node` absent, `tsx` absent; workers-types has no `process` global (basis of W-1); `db.batch()`/`D1Result.meta.changes` typed; commit 6866741 exists |

## 4. Issues

### Blockers
None.

### Warnings

- **WARNING-01 — `npm run typecheck:scripts` (02-01 T1, 02-02 T1/T2) will likely fail as specified.**
  The plan says scripts/tsconfig.json "extends the root tsconfig" without overriding `types`. Root tsconfig has `"types": ["@cloudflare/workers-types"]`. Verified: workers-types declares **no** `process` global (grep of installed `@cloudflare/workers-types` finds none), so the fetcher's `process.env` / `process.exit(1)` fail typecheck (TS2304). The alternative — `types: ["node"]` — breaks the transitively-imported `src/types.ts` (`Env.DB: D1Database` is a workers-types-only global) because the fetcher imports `fetchKlines` from `src/lib/binance.ts` → `import type {…} from '../types'`. Both obvious configurations have a failure mode; the plan's claim that the command "exits 0" is unproven.
  *fix_hint*: specify the isolation strategy explicitly in the plan: either (a) scripts/tsconfig.json sets `"types": ["node", "@cloudflare/workers-types"]` and verify duplicate-global handling under `skipLibCheck`, or (b) refactor so the fetcher does not transitively import `src/types.ts` (e.g., a local minimal type in the script, or a `src/lib/binance.ts` export surface that doesn't drag `Env`). Add the exact config content to the plan so execution doesn't stall on it.

- **WARNING-02 — "GitHub's IPs reach Binance successfully" is asserted but never verified, and the real GH run is optional.**
  The workflow deliverable's premise (SPIKE-REPORT `## Phase 2 Path`) rests on GH Actions runners reaching Binance. This was never executed — the repo has no successful GH run record, and the plan's T2 step 4 makes `gh workflow run` optional. GH Actions runners are Azure datacenter IPs (often US-region) — exactly the class Binance geo-blocks/DC-blocks that killed Worker-side fetching. If blocked, the workflow artifact (and Phase 3's planned reuse of the same fetcher for cron) is dead on arrival. Phase 2 SCs remain provable via the local-machine path (verified 200 in the spike), so this is not a goal blocker — but it is an unverified load-bearing assumption.
  *fix_hint*: make step 4 mandatory (or add a minimal reachability probe job first), and document the local-machine `launchd`/`crontab` fallback for Phase 3 in case GH runners are blocked.

- **WARNING-03 — ROADMAP SC1's literal wording is not satisfiable by any single endpoint and is never amended.**
  SC1 says "Calling the admin backfill endpoint fetches … from Binance." Under the locked architecture the Worker cannot reach Binance (deterministic 403, SPIKE-REPORT verdict); fetching happens in the external fetcher and the endpoint only persists. Both plans correctly reinterpret SC1 and gate on owner sign-off (PLAN-GATE in user_setup), but neither schedules updating the ROADMAP text, so a literal completion review could judge SC1 failed.
  *fix_hint*: after the owner confirms option (c), amend ROADMAP SC1 to e.g. "the backfill pipeline fetches one bounded batch … from Binance and the admin ingest endpoint stores them in D1" at the phase transition.

### Info

- **INFO-01 — PLAN-GATE is real and pre-execution.** Owner sign-off on SPIKE-REPORT `## Phase 2 Path` (option c) is pending (1-SUMMARY.md checkpoint; commit 6866741 was acted on but the summary still records it as awaiting sign-off). Both plans carry the gate. If the owner overrides, both plans need rework. Do not start Task 1 before confirmation.

- **INFO-02 — `getBackfillCursor` sketch needs `.first('cursor_open_time')`.** Plain `.first()` on the D1 binding returns a record object (`D1Result`-style) or null, not the raw `number`. The plan says "`.first()` value or null" for a `Promise<number|null>` — the executor should use `.first('cursor_open_time')` (or `.first<{cursor_open_time:number}>()?.cursor_open_time`). Typecheck would catch the naive version, but specifying it avoids the surprise.

- **INFO-03 — Origin constants duplicated.** `1609459200` (cursor `default`, 02-01 T2) and `1609459200000` + the `+3600` offset (fetcher, 02-02 T1) are hardcoded in two places. Extract one shared constant to prevent drift.

- **INFO-04 — `/api/admin/binance-spike` stays unauthenticated.** The new token guard covers only the ingest/cursor routes; the spike route carries over SPIKE-REPORT INFO-04 until Phase 9 (Cloudflare Access). Confirm this is acceptable.

- **INFO-05 — 02-01 T2 `<files>` still lists `src/index.ts`** while the front matter omits it and the action only "verifies the new subroutes are reachable" (route is already mounted at `src/index.ts:12`). Metadata noise in the audit trail.

- **INFO-06 — SC2's "until reaching now" is mechanism-proven, not fully attained, in Phase 2.** Two-three fetcher runs + the reached-now tail handler prove the mechanism; the ~40k-run 2021→now crawl is Phase 3's job by roadmap design. State this explicitly at phase completion so Phase 2 isn't judged on an unreachable full crawl. Related: ROADMAP/STATE.md still show Phase 2 plans as "TBD" and STATE.md says Phase 1 — stale tracking docs.

## 5. Recommendation

**Proceed to execution once the two PLAN-GATE user_setup items are satisfied (owner confirms the external-fetcher path) and WARNING-01's scripts-tsconfig isolation strategy is pinned down.** The plans are goal-backward coherent: all four Phase 2 requirements and all four success criteria map to concrete, wired, verifiable tasks; dependencies are acyclic and correctly ordered; the SC4 chunking math (14 rows × 7 params = 98, 72 stmts in 2 `db.batch()` calls) and cursor semantics are fact-checked against the real schema and D1 types; SC3 backoff behavior matches PITFALLS.md guidance; and the earlier review's W-02 (reached-now tail), W-03 (files_modified), W-04 (done flag) are genuinely fixed in the current plan text.

The residual risks are verification-quality and forward-looking, not goal-killing: W-01 could stall a verify gate at execution (cheap to fix by spelling out the tsconfig), W-02 could invalidate the GH workflow (but not Phase 2 SCs, which use the proven local path), and W-03 is a doc-word drift on SC1. No success criterion is left uncovered and no requirement is zero-covered.