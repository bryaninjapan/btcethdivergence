# Phase 12 Plan Check — Goal-Backward Verification Report

**Checker:** gsd-plan-checker (adversarial, goal-backward)
**Date:** 2026-09-01
**Phase:** 12 (Service Layer Pattern)
**Plan(s) verified:** `.planning/phases/12-service-layer/PLAN.md` (tasks 12-00 … 12-05, current 08:01 revision)
**Status:** **ISSUES FOUND — 0 blocker(s), 7 warning(s), 7 info**

> **Note on prior check:** the `12-PLAN-CHECK.md` previously on disk reviewed an **older PLAN.md revision** (it flags `fetchAndInsertKlines`, phantom `createTestDatabase()` helpers, a mock lacking `.batch()`, and dropped `skipped` — all of which the current 08:01 PLAN.md has already fixed). This report verifies the current revision from scratch against live source.

---

## 1. Coverage Summary

| Requirement / Criterion | Covering task(s) in plan | Coverage |
|---|---|---|
| CODE-04 (Service Layer Pattern) | 12-01 (records), 12-02 (klines), 12-03 (admin) | ✅ Covered for all three domains |
| SC1 — All business logic extracted to `src/services/` (records, klines, admin incl. binance-spike + ingest) | 12-01, 12-02, 12-03 | ⚠️ Covered; records/klines services are pass-through wrappers (W5); spike example miswires the route path (W2) |
| SC2 — Services accept already-validated input (Zod at route layer) | 12-01/02/03 service signatures | ✅ Matches CONTEXT D3; klines route validates manually today (I4) |
| SC3 — 20+ unit tests, isolated with **Mock D1** | 12-00 (mock + smoke) + 12-01 (11) + 12-02 (5) + 12-03 (6+) = 22+ | ✅ ≥20 and Mock-D1 approach matches ROADMAP verbatim. Mock spec gaps: `.batch()` arg shape (W3), WHERE/LIKE filter semantics for listRecords tests (W4) |
| SC4 — All routes refactored to services, thin ~10-20 lines/endpoint | 12-01/02/03 refactor subtasks + 12-04 step 3 | ⚠️ Line-count target now stated and checked in 12-04, but records PUT (37 lines) / klines GET (35 lines) can't reach ~15-20 without an unstated mechanism (W7) |
| SC5 — Route integration tests pass (no regressions) | 12-01/02/03 SCs + 12-04 step 2 | ⚠️ suites exist; refactor examples that drop try/catch would flip DATABASE_ERROR→INTERNAL_ERROR and fail klines.test.ts (W1); admin spike/ingest contract tests now planned (fixed from prior check) |
| SC6 — E2E tests pass (critical user flows) | 12-04 step 4 | ✅ Command real (`playwright.config.ts` → `webServer: npm run dev`); only calculator spec exists but scope decision is explicit and acceptable for backend-only changes (I7) |
| SC7 — Code coverage ≥ 80% (`src/**`, `public/js/**`) | 12-04 step 3 (script change + remediation loop) | ⚠️ Remediation loop now present; but silently drops existing 95% gates and unused/untested files drag the aggregate (W6) |
| SC8 — Code review complete (no HIGH) | 12-05 | ✅ Covered |

## 2. Success Criteria Traceability

| # | ROADMAP success criterion | Delivering task(s) | Verdict |
|---|---|---|---|
| 1 | All business logic extracted to `src/services/` (records, klines, admin incl. binance-spike + ingest) | 12-01, 12-02, 12-03 | ✅ All three domains. Caveat: only admin gains real logic (`probeBinanceReachability`, `processIngest`); records/klines services are pass-throughs (W5), and 12-03's spike example shows the wrong route path (W2) |
| 2 | Services accept already-validated input (Zod at route layer) | 12-01/02/03 designs | ✅ Signatures trust input; routes retain validation. Klines uses manual validation, not Zod (I4) |
| 3 | Services have 20+ unit tests (isolated with **Mock D1**) | 12-00 (mock) + 12-01 (11) + 12-02 (5) + 12-03 (6+) | ✅ 22+ ≥ 20, Mock-D1 per ROADMAP. Mock under-specified: `batch()` arg shape (W3), filter semantics for listRecords tests (W4) |
| 4 | All routes refactored to use services (HTTP thin, ~10-20 lines/endpoint) | 12-01/02/03 refactor subtasks + 12-04 check | ⚠️ Target now stated/checked, but no mechanism specified to slim records PUT (37 lines) / klines GET (35 lines) (W7); error-translation ownership decides feasibility (W1) |
| 5 | Route integration tests pass (no regressions) | 12-01/02/03 SCs + 12-04 step 2 | ⚠️ Existing suites cover records/klines and would catch a regression; the plan's own examples would trigger one if followed literally (W1). Admin spike/ingest contract tests now added to 12-03 (fixed) |
| 6 | E2E tests pass (critical user flows work) | 12-04 step 4 | ✅ `npx playwright test` runnable; only `e2e/calculator-init.spec.ts` exists; phase changes backend only, so calculator E2E + route integration tests carry SC6 — explicitly scoped in 12-04 (I7) |
| 7 | Code coverage ≥ 80% aggregate (`src/**` + `public/js/**`) | 12-04 step 3 | ⚠️ Script + remediation loop planned; 95% calculator gates silently relaxed to one 80% lines gate (W6) |
| 8 | Code review complete (no HIGH severity issues) | 12-05 | ✅ Covered |

## 3. Dimension Results

| Dimension | Result |
|---|---|
| 1. Requirement Coverage | ✅ CODE-04 covered by 12-01/02/03 |
| 2. Task Completeness | ⚠️ Files, signatures, and test lists are concrete. Gaps: error-translation ownership unspecified (W1); spike route example wrong (W2); mock `.batch()` arg shape (W3); mock filter semantics (W4); line-count mechanism (W7) |
| 3. Dependency Correctness | ✅ Acyclic: 12-00 → (12-01 ∥ 12-02) → 12-03 → 12-04 → 12-05. 12-03 only needs 12-00 (over-constrained serial order, I5) |
| 4. Key Links / Wiring | ⚠️ Service signatures map onto real `db.ts` exports (verified). Wiring defects: refactor examples would break DATABASE_ERROR contract (W1), spike example rewires to wrong path/startTime (W2), mock can't run admin tests as specced (W3/W4) |
| 5. Scope Sanity | ✅ 6 tasks (12-00..12-05), 2-3 subtasks each, one domain per service, reasonably sized |
| 6. Success-Criteria Traceability | ✅ All 8 criteria have covering tasks; quality of delivery degraded by W1-W7 |
| 7. Locked Decision Compliance | ✅ CONTEXT D1 (services wrap repositories), D2 (one file per domain), D3 (route-layer-only validation) respected. ⚠️ W2's example route path would violate CONTEXT "Out of Scope: change API contracts" if followed literally |
| 8. Scope Reduction Detection | ✅ No hedging ("v1", "for now", "placeholder", "stub") on in-scope deliverables. E2E deferral is explicit, documented, and justified (I7), not hidden hedging |
| 9. Verification Plan Quality | ✅ All five commands (`typecheck`, `typecheck:scripts`, `test`, `test:coverage`, `playwright test`) are real existing scripts; typed code is typechecked. Gaps: no dry-run of the coverage command before execution (W6); no route-contract gate that would catch W1/W2 before 12-04 |
| 10. Fact-check load-bearing claims | ✅ Verified: `listRecords` (db.ts:9), `queryKlines` (db.ts:33), `createRecord` (db.ts:48), `updateRecord`→`Record\|null` (db.ts:73), `deleteRecord`→`boolean` (db.ts:109), `getBackfillCursor` (db.ts:114), `setBackfillCursor` (db.ts:121), `insertKlinesBatch`→`{inserted,skipped}` (db.ts:135, `db.batch(...)` at db.ts:143), `CreateRecordInput`/`UpdateRecordInput` (validate.ts:51-52), `validatePositiveInteger` (validate.ts:14), `errorMiddleware` maps non-AppError → INTERNAL_ERROR (error-middleware.ts:47-55), `vitest.config.ts` jsdom/`pool: undefined`, admin spike = admin.ts:51-97 + `attempt()` 36-49, ingest = 114-118, `src/lib/response.ts` imported by nothing, `e2e/` has only `calculator-init.spec.ts`, `public/` has zero `/api/admin/` references. **Mismatches:** 12-03 spike example shows `GET /api/admin/binance-spike/:symbol` + `c.req.param('symbol')` — real route is `GET /api/admin/binance-spike` with `?symbol=` query (admin.ts:51-54) (W2); example's `startTime = getBackfillCursor(...) \|\| defaultStart()` differs from real `Date.now() - 2h` (admin.ts:59) (W2); 12-00 `batch({sql, params}[])` differs from real call passing prepared statements (W3); 12-01/02 refactor examples drop try/catch that today yields DATABASE_ERROR (W1) |

## 4. Issues

### Blockers

None. Every ROADMAP success criterion has at least one covering task, the Mock-D1 approach matches ROADMAP SC3 verbatim, dependencies are acyclic, and no scope-reduction hedging is present.

### Warnings

**W1 — Error-translation ownership is undefined; the refactor examples drop the try/catch and would flip DATABASE_ERROR → INTERNAL_ERROR, breaking existing tests.**
- Today records/klines routes wrap DB calls in try/catch and throw `DatabaseError` (records.ts:21-30, 46-55, 80-93, 106-119; klines.ts:33-42). The 12-01 and 12-02 refactor examples call the service bare with no try/catch. Since `errorMiddleware` maps any non-`AppError` to INTERNAL_ERROR (error-middleware.ts:47-55), a raw DB throw from the service would return `error.code: INTERNAL_ERROR`. Existing integration test klines.test.ts:152-182 asserts `DATABASE_ERROR`, so SC5 ("Integration tests pass (no regressions)") fails if the examples are followed literally.
- `fix_hint`: State explicitly where error translation lives: either (a) services catch and rethrow `DatabaseError` (recommended — that's the business-logic seam SC1 wants), or (b) routes keep the try/catch. Keep either choice consistent across 12-01/12-02/12-03, and re-run the existing route suites to confirm the error-code contract is preserved.

**W2 — 12-03's spike refactor example is factually wrong about the route path and startTime source.**
- Real route: `GET /api/admin/binance-spike` with `?symbol=` query (default BTCUSDT), validated against BTCUSDT/ETHUSDT (admin.ts:51-57). Real startTime: `Date.now() - 2 * 60 * 60 * 1000` (admin.ts:59). The plan's example registers `admin.get('/api/admin/binance-spike/:symbol', ...)` and reads `c.req.param('symbol')`, and computes `startTime = getBackfillCursor(...) || defaultStart()`. Following it changes the route path, the param source, and the probe's start time — a contract change CONTEXT marks Out of Scope.
- `fix_hint`: Fix the example to `admin.get('/api/admin/binance-spike', ...)` with `c.req.query('symbol') ?? 'BTCUSDT'`, and keep `startTime = Date.now() - 2h` (pass it into `probeBinanceReachability(symbol, startTime)`). Do not derive startTime from the backfill cursor unless that is an intentional, documented behavior change.

**W3 — 12-00 mock `batch()` signature doesn't match how `insertKlinesBatch` actually calls it.**
- Plan specs `batch(statements: {sql, params}[]) → [{meta:{changes}}]`. But `insertKlinesBatch` (db.ts:143-144) calls `db.batch(group.map((stmt) => db.prepare(stmt.sql).bind(...stmt.params)))` — an array of **prepared-statement objects**, not `{sql, params}`. As specced, 12-03's `processIngest` tests cannot run against the real db.ts.
- `fix_hint`: Spec the mock's `batch()` to accept prepared-statement objects (i.e., the bound objects returned by `prepare().bind()`), execute each (e.g., call `.run()`), accumulate `meta.changes`, and return the results array. Add an explicit 12-00 test that calls `db.batch([db.prepare(sql).bind(...), ...])` exactly as db.ts does.

**W4 — 12-00 mock omits the WHERE/LIKE filtering and SELECT-then-merge semantics the stated service tests depend on.**
- 12-01 requires "listRecords: filter by type → returns matching only" and "filter by tag → returns matching only", and "updateRecord: partial update → other fields preserved". The plan's mock spec ("store inserted data in memory for assertions") never states that `all()` applies the SQL's WHERE/LIKE-ESCAPE filtering, nor that `first()` serves the seeded row for `updateRecord`'s SELECT. With a naive mock that returns all rows, two of the 11 stated listRecords tests fail; without seeded-row `first()`, the update-merge assertions fail. The existing FakeD1Database (records.test.ts:12-84) implements exactly this logic (including `simpleLikeMatch` for tag `%…%` ESCAPE `\`) and is the reference.
- `fix_hint`: Explicitly require the mock to implement type-equality and `tags LIKE ? ESCAPE '\\'` filtering in `all()` and row-serving for `first()` over seeded data (or reuse/port the FakeD1Database semantics from records.test.ts into `createMockD1WithData`). Add a 12-00 test proving a `WHERE type = ?`/`tags LIKE ?` query returns only matching seeded rows.

**W5 — records/klines services are pure pass-through wrappers over db.ts; SC1 "business logic extracted" is thin for 2 of 3 domains.**
- As designed, `records.service.ts`/`klines.service.ts` functions only "call existing DB function" with no added behavior; only admin gains real logic. If W1's option (a) is chosen (services own error translation), that restores real substance to the layer. Otherwise the phase delivers an indirection seam with no logic for records/klines, and their unit tests assert nothing beyond pass-through call sequences.
- `fix_hint`: Decide and state which business behavior moves into records/klines services (error translation per W1 is the natural candidate; alternatively call/sequence orchestration). If pass-through is intended, document that the services exist as the testable seam for future logic and that db.ts is the repository per CONTEXT D1 — so SC1's "extraction" is honest for all three domains.

**W6 — Coverage change silently relaxes the existing 95% calculator gates to a single 80% lines gate; feasibility unverified.**
- Current `test:coverage` enforces 95% lines/functions/statements/branches on `public/js/calculator*.js`. The proposed script drops all four gates to one `--coverage.thresholds.lines=80` over `src/**,public/js/**`. No rationale is given for relaxing the calculator. Also, known uncovered files (`src/lib/response.ts` — imported by nothing; `public/js/records.js`, `public/js/divergence.js` — no test files) will drag the aggregate; 12-04's remediation loop exists but the 95%→80% relaxation is unexamined and the command has never been dry-run.
- `fix_hint`: Keep per-project calculator thresholds (e.g. `--coverage.include='src/**,public/js/**'` plus separate calculator gate or a documented rationale for relaxing it). Dry-run `npm run test:coverage` once before execution to know the baseline aggregate, and list the files expected to need remediation (response.ts, records.js, divergence.js).

**W7 — The ~15-20 lines/endpoint targets for records PUT (37 lines) and klines GET (35 lines) are asserted without a mechanism to reach them.**
- 12-04 step 3 requires records PUT / klines GET / admin spike / admin ingest to measure ~15-20 lines, and 12-03 states "~15-20 lines each". But records PUT (records.ts:58-94, 37 lines) keeps id validation + JSON parse + Zod parse + 404 + response + try/catch; klines GET (klines.ts:9-43, 35 lines) keeps manual validation + conversion + try/catch. Neither target is reachable unless validation is condensed (`validatePositiveInteger`, validate.ts:14) and/or error translation moves to services (W1).
- `fix_hint`: In each route-refactor subtask, state the concrete slimming levers: use `validatePositiveInteger` for `:id`, keep `errorMiddleware` doing the fallthrough, and move DB-error translation into services per W1. If any endpoint stays >20 lines, state that as an accepted deviation rather than asserting the target.

### Info

**I1 — Leftover name inconsistency in 12-00 sub-task 3.**
- Sub-task 3 writes a smoke test using `createMockD1()`; the canonical helper created is `createMockD1Database()`. Rename for consistency.
- `fix_hint`: Use `createMockD1Database()` in the smoke test.

**I2 — Test-count arithmetic is inconsistent across the plan.**
- 12-01 SC says "8+ tests" but enumerates 11; 12-04 step 2 says "12-00 (1 smoke + 1 batch test)" while 12-00 defines 4 mock tests + a smoke test (= 5). Totals still satisfy SC3 (≥20), but the executor could under-count.
- `fix_hint`: Unify on the enumerated counts (12-00: 5, 12-01: 11, 12-02: 5, 12-03: 6+ = 27+) and state "≥20 required by SC3" in 12-04.

**I3 — `processIngest` "Query last kline open_time" is ambiguous.**
- Current behavior sets `cursor = klines[klines.length - 1].open_time` from the **payload** (admin.ts:117), not by querying D1. The plan's wording could be read as a DB query.
- `fix_hint`: Write "cursor = last kline in the payload (`klines[klines.length-1].open_time`)".

**I4 — 12-02 "Keep Zod validation" doesn't match the klines route.**
- routes/klines.ts:14-27 validates manually (missing params, `Number.isNaN`, negatives); there is no Zod. The plan's own example hedges "(Zod or manual checks)", so this is cosmetic.
- `fix_hint`: Word as "keep existing manual validation + ms→sec conversion at route level".

**I5 — `db.queryKlines` / `db.getBackfillCursor` phrased as D1 methods.**
- These are module exports of `../lib/db` (imported at routes/klines.ts:3, routes/admin.ts:4), not methods on the D1 instance.
- `fix_hint`: Rephrase as `import { queryKlines } from '../lib/db'` / `await queryKlines(db, symbol, start, end)`.

**I6 — `processIngest` returns `newCursor`, but the route response uses `cursor`.**
- Current `/api/admin/ingest` returns `{inserted, skipped, cursor}` (admin.ts:120-123). The route must map `{inserted, skipped, newCursor}` → `{inserted, skipped, cursor: newCursor}` to preserve the contract.
- `fix_hint`: Note the field mapping in 12-03's refactor step.

**I7 — E2E scope: only the calculator spec exists; SC6 evidence for changed routes rests on integration tests.**
- The plan explicitly documents this in 12-04 step 4 and defers a records+klines smoke E2E to post-phase. Since Phase 12 changes backend routes only (no `public/` files), calculator E2E + route integration suites are reasonable SC6 evidence. Verify `npx playwright test` actually boots `npm run dev` once during 12-04 rather than assuming it.

## 5. Recommendation

The plan is **executable as designed**: service signatures map cleanly onto the real `db.ts` repository exports, dependencies are acyclic, tasks are reasonably sized, all 8 success criteria have covering tasks, the Mock-D1 approach matches ROADMAP SC3 verbatim, and every verification command exists in the repo. **No blockers.**

Resolve before or during execution: (W1) decide error-translation ownership — moving it into services both preserves the DATABASE_ERROR contract the route tests assert and gives records/klines services real substance (W5); (W2) fix the spike refactor example to the real `/api/admin/binance-spike` path + `?symbol=` + `Date.now() - 2h` startTime; (W3) spec the mock's `batch()` to accept prepared statements as db.ts passes them; (W4) require the mock to implement WHERE/LIKE-ESCAPE filtering and seeded-row `first()` so the stated listRecords/updateRecord tests can pass; (W6) keep or justify the calculator 95% gates and dry-run the coverage command; (W7) name the slimming levers (e.g. `validatePositiveInteger`, W1's service-owned errors) for the line-count targets. Infos are small wording/spec cleanups.

**Plans verified. Ready to execute.**