# Phase 12 Plan Check — Goal-Backward Verification Report

**Checker:** gsd-plan-checker (adversarial, goal-backward)
**Date:** 2026-09-01
**Phase:** 12 (Service Layer Pattern)
**Plan(s) verified:** `.planning/phases/12-service-layer/PLAN.md` (covers 12-01 … 12-05)
**Status:** **ISSUES FOUND — 4 blocker(s), 7 warning(s), 3 info**

---

## 1. Coverage Summary

| Requirement / Criterion | Covering task(s) in plan | Coverage |
|---|---|---|
| CODE-04 (Service Layer Pattern) | 12-01, 12-02, 12-03 | ✅ Covered (with defects, see §3/§4) |
| SC1 — All business logic extracted to `src/services/` | 12-01, 12-02, 12-03 | ⚠️ Nominal — klines/admin "extraction" targets logic that does not exist in the routes |
| SC2 — Services accept already-validated input (Zod at route) | 12-01, 12-02, 12-03 | ⚠️ Contradicted by plan's own service-level validation steps (W1) |
| SC3 — Services have 20+ unit tests, real test D1 | 12-01/02/03 test subtasks + 12-04 | ⚠️ Counts sum to 16 min (W2); real D1 mechanism unspecified (B4) |
| SC4 — Routes refactored, thin (~10-20 lines) | 12-01, 12-02, 12-03 | ⚠️ Klines/records refactor as specified breaks behavior (B1, B2) |
| SC5 — Route integration tests pass | 12-01/02/03 + 12-04 step 3 | ⚠️ At risk (B1, B2) |
| SC6 — E2E tests pass | 12-04 step 4 | ⚠️ Command does not exist; flows listed have no specs (W5) |
| SC7 — Coverage ≥ 80% | 12-04 step 3 | ❌ Unverifiable as specified (B3) |
| SC8 — Code review complete (no HIGH) | 12-05 | ✅ Covered |

---

## 2. Success Criteria Traceability

| # | ROADMAP success criterion | Delivering task(s) | Verdict |
|---|---|---|---|
| 1 | All business logic extracted to `src/services/` (records, klines, admin) | 12-01, 12-02, 12-03 | ⚠️ 12-01 OK-ish; 12-02/03 attempt to extract functions that don't exist in the current routes (see B1, W6, W7) |
| 2 | Services accept already-validated input (Zod at route layer) | 12-01/02/03 service design | ⚠️ Plan steps explicitly put `Validate:` inside services, contradicting the locked Decision 3 (W1) |
| 3 | Services have 20+ unit tests using real test D1 | 12-01 (8+), 12-02 (5+), 12-03 (3+), 12-04 | ⚠️ 16 min < 20 (W2); "real D1" helper is unimplementable without vitest config change the plan does not specify (B4) |
| 4 | All routes refactored to use services (thin, 10-20 lines/endpoint) | 12-01, 12-02, 12-03 | ❌ Klines refactor drops `start`/`end` and references a non-existent schema (B1); records refactor drops filters + null/boolean semantics (B2) |
| 5 | Route integration tests pass (no regressions) | 12-01/02/03, 12-04 step 3 | ❌ Broken by B1/B2 (existing `records.test.ts`, `klines.test.ts`, `klines-public*.test.ts` test exactly the behavior the new signatures drop) |
| 6 | E2E tests pass (critical user flows work) | 12-04 step 4 | ⚠️ `npm run test:e2e` is not a script; only calculator E2E spec exists (W5) |
| 7 | Code coverage ≥ 80% | 12-04 step 3 | ❌ `npm run test:coverage` measures only `public/js/calculator*.js` at 95% thresholds — proves nothing about services (B3) |
| 8 | Code review complete (no HIGH) | 12-05 | ✅ Covered |

---

## 3. Dimension Results

| Dimension | Result |
|---|---|
| 1. Requirement Coverage | ✅ CODE-04 has covering tasks; several tasks mis-target real code (see §4) |
| 2. Task Completeness | ⚠️ Tasks name files and actions, but service signatures omit params/semantics the real routes depend on; verify steps for 12-04 use non-existent commands |
| 3. Dependency Correctness | ⚠️ 12-01/02/03 tests depend on `src/lib/test-db.ts` created only in 12-04 (ordering flaw, W3) |
| 4. Key Links / Wiring | ⚠️ Service APIs as written do not wire to existing route contracts (B1, B2); admin service misses the spike route's real logic (W7) |
| 5. Scope Sanity | ✅ 5 plans × 2-4 subtasks — reasonable sizing |
| 6. Success-Criteria Traceability | ❌ SC2/SC3/SC4/SC5/SC6/SC7 not fully deliverable as specified (see §2) |
| 7. Locked Decision Compliance | ⚠️ Contradicts CONTEXT.md Decision 3 ("Services trust input is valid, avoid double-validation") via in-service `Validate:` steps (W1) |
| 8. Scope Reduction Detection | ✅ No hedging/stub/placeholder language found on in-scope work |
| 9. Verification Plan Quality | ❌ Missing `npm run typecheck`; `npm run test:coverage` and `npm run test:e2e` cannot produce the claimed results (B3, W4, W5) |
| 10. Fact-check load-bearing claims | ❌ `queryKlinesBatch` does not exist (W6); `queryKlinesSchema` does not exist (B1); klines route never fetches from Binance (W6); coverage/E2E scripts don't exist (B3, W5) |

---

## 4. Issues

### Blockers

**B1 — Klines service/route refactor is incompatible with the real route; chart time-range query is dropped.**
The plan (12-02) defines `queryKlines(db, symbol, limit?)` and its route example calls `klinesService.queryKlines(c.env.DB, parsed.data.symbol)` with **no `start`/`end`**, and references `queryKlinesSchema` — which does not exist in `src/lib/validate.ts`. The current `routes/klines.ts:9-43` requires `symbol`, `start`, `end`, converts ms→seconds via `Timestamp`, and queries a time range (`db.ts:33` `queryKlines(db, symbol, start, end)`). Following the plan literally drops the range params that the charts (a critical user flow) depend on, and the refactor example cannot compile (`queryKlinesSchema` undefined). Existing `klines.test.ts` / `klines-public.test.ts` assert ms→seconds conversion and range binding and would fail.
- **fix_hint:** Service signature must be `queryKlines(db, symbol, start, end)` (or accept a validated range object) and the route example must pass `start`/`end`; add a real klines Zod schema in `validate.ts` (or keep manual parsing) — do not invent `queryKlinesSchema`. Remove the non-existent `queryKlinesBatch` reference.

**B2 — Records service signatures drop filters and null/boolean semantics the routes rely on (regression risk to Phase 5 filtering + 404 behavior).**
`12-01` defines `listRecords(db)` with no `filters` param, but `db.listRecords` takes `{type, tag}` and `routes/records.ts:22` passes them — dropping this breaks type/tag filtering (Phase 5 feature) and the filter tests in `records.test.ts:377-446`. `updateRecord` is typed `Promise<Record>` (db returns `Record | null`, route throws `NotFoundError` on null — `records.ts:82-84`) and `deleteRecord` is typed `Promise<void>` (db returns `boolean`, route needs it to return 404 — `records.ts:107-110`). As specified, the refactored routes cannot produce 404s and existing integration tests (`PUT→404`, `DELETE changes=0→404`) will fail.
- **fix_hint:** `listRecords(db, filters)`; `updateRecord` must preserve `null` (or throw `NotFoundError` inside the service); `deleteRecord` must return `boolean` (or throw `NotFoundError`). Keep signatures behavior-identical to the current DB layer contract.

**B3 — `npm run test:coverage` cannot verify "coverage ≥ 80%" for the new code.**
`package.json:13` runs `vitest run --coverage --coverage.include='public/js/calculator*.js'` with 95% thresholds. It measures **only** calculator frontend JS — new `src/services/*` files are excluded from instrumentation entirely. Running the plan's stated command proves nothing about service coverage, so SC7 is unverifiable as planned.
- **fix_hint:** Add a coverage script/target that includes `src/**` (and `public/js/**` where applicable) with an 80% line/statement threshold, and have 12-04 run that; state the command explicitly and list `package.json` in the Modified Files summary.

**B4 — "Real test D1" helper is unimplementable under the current test config, and the plan specifies no config change.**
`vitest.config.ts` sets `pool: undefined` (plain Node, `jsdom`); `@cloudflare/vitest-pool-workers` is installed but unused, and there is no miniflare/workers pool or D1 binding configuration anywhere. `createTestDatabase()` in `src/lib/test-db.ts` cannot return a real `D1Database` without switching the vitest pool to workers, wiring `miniflare` bindings, and running the 3 migrations (`0001`–`0003`). The plan's File Changes Summary does not list `vitest.config.ts` (or a new config) as modified and gives no mechanism.
- **fix_hint:** Specify the mechanism: use `defineWorkersConfig` / `@cloudflare/vitest-pool-workers` with a `d1Databases` binding + migration setup, OR relax SC3 to the current fake-D1 approach; add the config files to the change summary and a migration-apply step in `createTestDatabase()`.

### Warnings

**W1 — Plan contradicts locked Decision 3 / SC2 ("services accept already-validated input, avoid double-validation").**
CONTEXT.md Decision 3 and ROADMAP SC2 require routes to own Zod validation and services to trust input. 12-01/02/03 steps put `Validate: startTime < endTime`, `Validate: type in DIVERGENCE_TYPES`, `Validate: id is positive integer`, etc. inside services, and test that services *throw ValidationError* — duplicating the Zod `.refine` already in `validate.ts:41,46-49`. `createRecordSchema` already rejects reversed times before any service is reached.
- **fix_hint:** Pick one and align SC2's wording: either services trust route-validated input (remove in-service validation + drop the "throws ValidationError" tests), or keep services as a last line of defense and re-word SC2/CONTEXT Decision 3 accordingly.

**W2 — Planned minimum service-test count (8+5+3=16) is below the "20+" success criterion.**
SC3 requires 20+ unit tests; the plan's enumerated cases sum to 16 minimum with no task forcing the remainder.
- **fix_hint:** Add edge-case tests per service (empty list, symbol allowlist, limit bounds, cursor null, invalid id formats, tags/notes preservation) to reach ≥20, or explicitly set per-file test counts that sum ≥20.

**W3 — Dependency ordering: 12-01/02/03 test subtasks assume `src/lib/test-db.ts` exists, but it is created in 12-04 (afterwards).**
12-01/02/03 subtask "Setup: Create test D1 database with schema" and 12-04's "Update all service test files — use `createTestDatabase()`" imply the helper must already exist while those plans run first.
- **fix_hint:** Move the `test-db.ts` helper creation into 12-01 (or a task 12-00), so service tests can use it; 12-04 then only audits isolation and runs the full suite.

**W4 — No type-check step.**
The plan changes typed code (new service files, refactored routes). `package.json` provides `npm run typecheck`, but no task runs it. B1's broken example would have been caught.
- **fix_hint:** Add `npm run typecheck` (and `npm run typecheck:scripts` if scripts touched) to 12-04's verification steps before the test suite.

**W5 — `npm run test:e2e` does not exist; E2E specs only cover the calculator.**
`package.json` has no `test:e2e` script (Playwright runs via `npx playwright test`). `e2e/` contains only `calculator-init.spec.ts`; the plan lists "Records CRUD flow" and "Charts data loading" as E2E flows to verify, but no such specs exist and 12-04 does not plan to write them.
- **fix_hint:** Either add a `test:e2e` script (and the playwright `webServer` command it needs) and scope SC6 to existing specs, or add a task to write records/charts E2E specs; state the real invocation command.

**W6 — `queryKlinesBatch` does not exist; `fetchAndStoreKlines` (12-02) and `backfillKlines` (12-03) are new logic, not extraction, and overlap each other.**
`db.ts` has `queryKlines`, `insertKlinesBatch`, `getBackfillCursor`, `setBackfillCursor` — no `queryKlinesBatch`. The klines route never fetches from Binance (fetch lives in `lib/binance.ts` + `scripts/backfill-fetcher.mts`), so a service "Fetch from Binance… Handle 429" is invented scope, and it duplicates 12-03's `backfillKlines` (also "fetch + insert"). The plan invents two near-identical functions in two services.
- **fix_hint:** Drop `fetchAndStoreKlines` from 12-02 (not an extraction; duplicates 12-03); have 12-02's service wrap only the real `queryKlines` range query; align 12-03's function names with the actual admin route operations (see W7).

**W7 — Admin extraction misses the real route business logic and mismatches return shapes.**
`admin.ts`'s genuine route-level logic is the `attempt()`/fallback-endpoint logic of `binance-spike` (lines 36-97) — not covered by 12-03. `getCursor(db, symbol): Promise<number>` ignores that the route returns `{symbol, cursor, default: 1609459200}` (`admin.ts:140-144`) and that `getBackfillCursor` returns `number | null`; `ingest` computes the cursor from the last kline. The plan's `BackfillResult` shape is never consumed by any current route.
- **fix_hint:** Map each admin route to a service function with a compatible return shape (e.g. `getCursor` returning `number | null`; a `processIngest` that inserts + sets cursor), and decide explicitly whether `binance-spike`'s fallback logic moves into the service or stays (flag if staying).

### Info

**I1 — Naming collision between service and DB functions.**
Service functions are named `createRecord`, `updateRecord`, `listRecords`, `deleteRecord`, `queryKlines` — identical to the `lib/db` functions they wrap. Routes that import the service version must alias, and the collision is error-prone. CONTEXT.md's example uses `createRecordService`/`queryKlinesService` naming — prefer it.

**I2 — No `*‑RESEARCH.md` exists for phase 12.**
The plan is consistent with CONTEXT.md but was not validated against a research doc; several load-bearing claims about "existing logic" are wrong (B1/W6) — a research pass over the three route files would have caught them.

**I3 — `listRecords` service has no pagination/order concern.**
`db.ts:13` notes `listRecords` is unbounded (L4 LOW). Since the service is the natural place to later add `LIMIT/OFFSET`, note this in 12-02 service JSDoc but do not implement (out of scope).

---

## 5. Recommendation

**Do not execute yet.** The plan's skeleton is sound (one service per domain, routes stay thin, 12-05 review), but four blockers mean executing as-written would (a) break the klines time-range query the charts depend on, (b) break records type/tag filtering and 404 semantics, (c) be unable to verify the 80% coverage criterion, and (d) be unable to create the "real test D1" the phase explicitly requires. Three of the eight success criteria (SC4, SC5, SC7) cannot be met on the current task text.

Recommended revision order:
1. Fix B1 and B2 (service signatures must mirror the existing DB-layer contracts the routes already use).
2. Fix B3 and B4 (add a coverage command that instruments `src/`; specify the real-D1 mechanism and config changes, plus typecheck).
3. Resolve W1 (pick one validation stance and align SC2/CONTEXT Decision 3), bump test counts to ≥20 (W2), reorder test-db creation before 12-01 (W3), and correct the E2E command/scope (W5).
4. Trim invented scope (W6/W7) so "extraction" is factually true of the current routes.

Plans verified — see report. **4 blocker(s) found — plan needs revision before execution.**