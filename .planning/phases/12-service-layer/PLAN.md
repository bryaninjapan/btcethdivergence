---
phase: 12
title: "Service Layer Pattern — Extraction & Testing"
date_created: 2026-09-01
status: ready_for_execution
estimated_duration: "3-4 days"
---

# Phase 12: Detailed Execution Plan

## Overview

Extract business logic from 3 route files into dedicated service layer. Implement unit tests for services using real test D1. Verify all routes continue to work.

## Task Breakdown

### **12-00: Create Mock D1 Test Helper (before all tasks)**

**Goal:** Set up mock D1 database for service unit tests so 12-01/02/03 can verify service logic independently.

**Subtasks:**

1. **Create src/lib/test-db.ts helper**
   - `function createMockD1Database(): D1Database`
     - Mock the D1Database interface
     - Implement `prepare(sql).bind(...).all/first/run()` methods
     - Implement `batch(statements: {sql, params}[])` → returns array of `{meta: {changes}}`
     - Use vitest `vi.fn()` for tracking calls
     - Store inserted data in memory for assertions
   
   - `function createMockD1WithData(initialData): D1Database`
     - Helper to pre-populate mock with test data
     - Returns a fresh createMockD1Database() with initial rows seeded

2. **Create src/lib/test-db.test.ts**
   - Verify mock interface matches real D1
   - Test: `prepare().bind().all()` → returns mocked rows
   - Test: `prepare().bind().first()` → returns single row or null
   - Test: `prepare().bind().run()` → tracks mutation
   - Test: `batch([{sql,params}, ...])` → executes all, returns changes array

3. **Verify helper works & establish cleanup contract**
   - Write smoke test: `createMockD1() → service call → verify calls`
   - Confirm vitest mocks are called correctly
   - Note: Each test gets a fresh mock via beforeEach + createMockD1Database()

**Success Criteria:**
- [ ] test-db.ts created with `createMockD1Database()` and `createMockD1WithData()`
- [ ] Mock D1Database implements `.prepare()` + `.batch()`
- [ ] All 4 mock tests (all, first, run, batch) passing
- [ ] Simple smoke test passes
- [ ] No changes to vitest.config.ts, no new dependencies

---

### **12-01: Records Service Extraction & Testing (1 day)**

**Goal:** Extract `createRecord`, `updateRecord`, `listRecords`, `deleteRecord` logic from routes/records.ts into services/records.service.ts with full unit tests.

**Subtasks:**

1. **Create services/records.service.ts**
   - `async function createRecord(db: D1Database, input: CreateRecordInput): Promise<Record>`
     - Trust input is valid (Zod already checked)
     - Insert via existing DB function
     - Return created record
   
   - `async function updateRecord(db: D1Database, id: number, input: UpdateRecordInput): Promise<Record | null>`
     - Trust input is valid
     - Update via existing DB function
     - Return Record or null (route handles 404)
   
   - `async function listRecords(db: D1Database, filters?: {type?: string, tag?: string}): Promise<Record[]>`
     - Trust filters are valid
     - Call existing DB function with filters
     - Return all matching records
   
   - `async function deleteRecord(db: D1Database, id: number): Promise<boolean>`
     - Trust id is valid
     - Call existing DB function
     - Return boolean (route handles 404)

2. **Write services/records.service.test.ts**
   - Setup: Use beforeEach(() => db = createMockD1Database())
   - Test createRecord: valid input → creates record
   - Test createRecord: edge case (very long notes) → succeeds
   - Test createRecord: tags preserved → returns correct tags
   - Test updateRecord: updates existing → returns Record
   - Test updateRecord: non-existent id → returns null
   - Test updateRecord: partial update (only type) → other fields preserved
   - Test listRecords: no filters → returns all
   - Test listRecords: filter by type → returns matching only
   - Test listRecords: filter by tag → returns matching only
   - Test deleteRecord: existing id → returns true
   - Test deleteRecord: non-existent id → returns false
   - Cleanup: afterEach auto-cleans (fresh db per test)

3. **Refactor routes/records.ts**
   - Replace inline logic with service calls
   - Keep validation layer (Zod) at route level
   - Keep HTTP response formatting at route level
   - Example:
     ```typescript
     records.post('/api/records', async (c) => {
       const body = await c.req.json();
       const parsed = createRecordSchema.safeParse(body);
       if (!parsed.success) throw new ValidationError(...);
       
       // Service handles business logic
       const record = await recordService.createRecord(c.env.DB, parsed.data);
       return c.json({ ok: true, data: record });
     });
     ```

**Success Criteria:**
- [ ] services/records.service.ts created with 4 functions
- [ ] services/records.service.test.ts created with 8+ tests
- [ ] All 8+ tests passing
- [ ] routes/records.ts refactored (logic moved to service)
- [ ] Integration tests still pass (routes/records.test.ts)

---

### **12-02: Klines Service Extraction & Testing (1 day)**

**Goal:** Extract klines query logic into services/klines.service.ts with unit tests.

**Subtasks:**

1. **Create services/klines.service.ts**
   - `async function queryKlines(db: D1Database, symbol: string, start: number, end: number): Promise<Kline[]>`
     - Trust symbol, start, end are valid (Zod checked in route)
     - Call existing `db.queryKlines(db, symbol, start, end)`
     - Return klines array
   
   - Naming: Avoid collision with db.ts; consider `queryKlinesService` or keep simple `queryKlines` with route import alias

2. **Write services/klines.service.test.ts**
   - Setup: Use beforeEach(() => db = createMockD1Database())
   - Test queryKlines: valid range → returns matching klines
   - Test queryKlines: empty range → returns empty array
   - Test queryKlines: range with data gaps → returns only in-range klines
   - Test queryKlines: BTCUSDT vs ETHUSDT → returns only requested symbol
   - Test queryKlines: large time range → handles correctly
   - Cleanup: afterEach auto-cleans (fresh db per test)

3. **Refactor routes/klines.ts**
   - Replace inline query logic with service call
   - Keep Zod validation + ms→sec conversion at route level
   - Example:
     ```typescript
     klines.get('/api/klines', async (c) => {
       const symbol = c.req.query('symbol');
       const start = c.req.query('start');
       const end = c.req.query('end');
       
       // Validate (Zod or manual checks)
       // Convert ms → sec
       
       // Service: pure query logic
       const klines = await klinesService.queryKlines(c.env.DB, symbol, startSec, endSec);
       return c.json({ ok: true, data: klines });
     });
     ```

**Success Criteria:**
- [ ] services/klines.service.ts created with 1 function
- [ ] services/klines.service.test.ts created with 5 tests
- [ ] All 5 tests passing
- [ ] routes/klines.ts refactored (ms→sec conversion stays in route)
- [ ] Integration tests pass (routes/klines.test.ts, routes/klines-public*.test.ts)

---

### **12-03: Admin Service Extraction & Testing (1 day)**

**Goal:** Extract admin business logic (cursor management, Binance fetch, ingest orchestration) into services/admin.service.ts.

**Subtasks:**

1. **Create services/admin.service.ts**
   - `async function getBackfillCursor(db: D1Database, symbol: string): Promise<number | null>`
     - Trust symbol is valid
     - Call existing `import { getBackfillCursor } from '../lib/db'` function
     - Return cursor (unix seconds) or null
   
   - `async function setBackfillCursor(db: D1Database, symbol: string, cursor: number): Promise<void>`
     - Trust symbol and cursor are valid
     - Call existing `import { setBackfillCursor } from '../lib/db'` function
   
   - `async function probeBinanceReachability(symbol: string, startTime: number): Promise<{endpoint: string, status: 200|500, count: number, weight: number}>`
     - Extract read-only spike probe logic (admin.ts:36-97)
     - Attempt api.binance.com, fallback to data-api.binance.vision
     - Return {endpoint, status, count, weight} — NO D1 writes
   
   - `async function processIngest(db: D1Database, symbol: string, klines: Kline[]): Promise<{inserted: number, skipped: number, newCursor: number}>`
     - Implement ingest orchestration (insert + update cursor)
     - Call `import { insertKlinesBatch } from '../lib/db'`
     - Query last kline open_time
     - Call `setBackfillCursor(db, symbol, lastTime)`
     - Return {inserted, skipped, newCursor} (preserve skipped from insertKlinesBatch)

2. **Write services/admin.service.test.ts**
   - Setup: Use beforeEach(() => db = createMockD1Database())
   - Test getBackfillCursor: unset → null, after set → returns cursor
   - Test setBackfillCursor: persists cursor
   - Test probeBinanceReachability: mock fetch, verify {endpoint, status, count, weight}
   - Test processIngest: inserts klines, updates cursor, returns {inserted, skipped, newCursor}
   - Add integration tests (contract assertions for spike/ingest routes post-refactor)
   - Total: 6+ tests
   - Cleanup: afterEach auto-cleans

3. **Refactor routes/admin.ts**
   - Extract binance-spike logic (lines 36-97) → `probeBinanceReachability` service call (read-only)
   - Extract ingest logic (lines 114-118) → `processIngest` service call
   - Keep: CF Access token validation, HTTP response formatting
   - Routes should be ~15-20 lines each
   - Example spike refactor (after extraction):
     ```typescript
     admin.get('/api/admin/binance-spike/:symbol', async (c) => {
       const symbol = c.req.param('symbol');
       const startTime = getBackfillCursor(...) || defaultStart();
       
       const result = await adminService.probeBinanceReachability(symbol, startTime);
       return c.json({ ok: true, data: result });
     });
     ```

**Success Criteria:**
- [ ] services/admin.service.ts created with 4 functions (getBackfillCursor, setBackfillCursor, probeBinanceReachability, processIngest)
- [ ] services/admin.service.test.ts created with 6+ tests + integration contract tests
- [ ] All tests passing
- [ ] routes/admin.ts refactored (~15-20 lines/endpoint for spike + ingest routes)
- [ ] Integration tests pass (existing admin.test.ts + new spike/ingest contract tests)
- [ ] probeBinanceReachability returns {endpoint, status, count, weight} (read-only, no D1 writes)
- [ ] processIngest returns {inserted, skipped, newCursor} (skipped preserved from insertKlinesBatch)

---

### **12-04: Verification & Coverage (0.5 day)**

**Goal:** Verify all services work correctly, check code quality, and measure coverage.

**Subtasks:**

1. **Run type checking**
   - `npm run typecheck` — verify no TypeScript errors in new services + refactored routes
   - `npm run typecheck:scripts` — verify if any scripts were changed

2. **Run test suite**
   - `npm test` — all unit tests (services + routes integration) must pass
   - Should include: 12-00 (1 smoke + 1 batch test) + 12-01 (11 tests) + 12-02 (5 tests) + 12-03 (6+ tests) + admin integration = 23+ tests
   - Verify no regressions in existing route integration tests (records.test.ts, klines.test.ts, admin.test.ts)

3. **Verify line-count targets & measure code coverage**
   - Measure refactored routes (records PUT, klines GET, admin spike, admin ingest) — each should be ~15-20 lines
   - Record observed line counts in verification checklist
   - Update `package.json` script:
     ```json
     "test:coverage": "vitest run --coverage --coverage.include='src/**,public/js/**' --coverage.thresholds.lines=80"
     ```
   - Run `npm run test:coverage` — verify ≥ 80% overall
   - If coverage < 80%: add unit tests for uncovered files (e.g. response.ts, db.ts edge paths) and re-run until ≥ 80%
   - Report: final coverage %, which files (if any) still need tests

4. **Run existing E2E tests**
   - `npx playwright test` — run all E2E tests (currently only calculator-init.spec.ts)
   - Verify no regressions in critical flows
   - **Scope note:** Phase 12 changes backend services only. Route-level integration tests (records.test.ts, klines.test.ts, admin.test.ts + new spike/ingest contract tests) provide SC5/SC6 validation. If adding records+klines smoke E2E desired, defer to post-phase.

**Success Criteria:**
- [ ] `npm run typecheck` passes (no errors)
- [ ] `npm test` passes (all tests green)
- [ ] `npm run test:coverage` ≥ 80% overall
- [ ] `npx playwright test` passes (calculator E2E)
- [ ] All integration tests pass (existing routes.test.ts files)

---

### **12-05: Code Review & Documentation (0.5 day)**

**Goal:** Review extracted code for quality, document service APIs.

**Subtasks:**

1. **Code Review**
   - Check service functions follow consistent patterns
   - Verify error handling is complete
   - Verify no hardcoded values or magic numbers
   - Verify input validation is comprehensive

2. **Document Service APIs**
   - Add JSDoc comments to all service functions
   - Example:
     ```typescript
     /**
      * Create a new divergence record.
      * @param db D1 database instance
      * @param input Validated record input (startTime < endTime, type valid)
      * @returns Created record with ID
      * @throws ValidationError if business rules violated
      */
     export async function createRecord(db: D1Database, input: CreateRecordInput): Promise<Record>
     ```

3. **Update LEARNING.md**
   - Document what was learned
   - List any unforeseen complications
   - Record any refactoring opportunities for future

**Success Criteria:**
- [ ] Code review completed (no HIGH issues)
- [ ] All service functions have JSDoc
- [ ] LEARNING.md updated
- [ ] Ready for commit

---

## Dependencies & Order

```
12-00: Test DB Helper (FIRST — needed by all)
        ↓
12-01: Records Service  ← Can run in parallel with 12-02
12-02: Klines Service   ← Can run in parallel with 12-01
        ↓ (both complete)
12-03: Admin Service
        ↓
12-04: Verification & Coverage
        ↓
12-05: Code Review & Documentation
```

**Critical Dependency:** 12-00 must complete first (test-db.ts is a prerequisite).
**Parallel Execution:** 12-01 and 12-02 can run simultaneously (separate domains).

---

## File Changes Summary

### **New Files**
- `src/services/records.service.ts` (~70 lines) — createRecord, updateRecord, listRecords, deleteRecord wrappers
- `src/services/records.service.test.ts` (~220 lines) — 11 test cases
- `src/services/klines.service.ts` (~40 lines) — queryKlines wrapper
- `src/services/klines.service.test.ts` (~140 lines) — 5 test cases
- `src/services/admin.service.ts` (~120 lines) — getBackfillCursor, setBackfillCursor, probeBinanceReachability, processIngest
- `src/services/admin.service.test.ts` (~200 lines) — 6+ unit tests + integration contract tests for spike/ingest
- `src/lib/test-db.ts` (~80 lines) — Mock D1Database helper (createMockD1Database, createMockD1WithData)

### **Modified Files**
- `package.json` — update test:coverage script to include `src/**` (no new dependencies)
- `src/routes/records.ts` (~15 lines reduction) — replace logic with service calls
- `src/routes/klines.ts` (~10 lines reduction) — replace query logic with service calls
- `src/routes/admin.ts` (~25 lines reduction) — extract binance-spike + ingest to services

### **Unchanged**
- `vitest.config.ts` (NO CHANGES — remains jsdom/pool:undefined for existing tests)
- `src/lib/db.ts` (DB functions stay as-is, act as repository layer)
- `src/types.ts`
- `src/lib/errors.ts`
- `src/lib/validate.ts`
- All frontend files (`public/js/`, `public/*.html`)
- Routes integration tests (existing tests should still pass)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Extraction introduces bugs | Comprehensive before/after tests, integration tests verify routes work |
| Over-extraction | Keep services coarse-grained (one per domain), no premature abstraction |
| Test isolation fails | Use separate test D1 per test, cleanup in afterEach |
| Routes regress | Keep integration tests, run E2E before commit |

---

## Success Criteria (Phase-Level)

1. ✅ All business logic extracted to services/ (records, klines, admin including probeBinanceReachability + processIngest)
2. ✅ 23+ unit tests created, all passing (12-00: 2 + 12-01: 11 + 12-02: 5 + 12-03: 6+ = 23+)
3. ✅ Integration tests pass (route contracts verified before/after refactor, no regressions)
4. ✅ E2E tests pass (calculator flows work; route-level tests cover SC6 for changed endpoints)
5. ✅ `npm run typecheck` passes (no TypeScript errors)
6. ✅ Refactored routes measure ~15-20 lines/endpoint (verified in 12-04)
7. ✅ `npm run test:coverage` ≥ 80% overall (with remediation if needed)
8. ✅ Code review complete (no HIGH issues)
9. ✅ LEARNING.md updated with lessons
10. ✅ Ready to commit

---

## Estimated Effort

- 12-00: 0.25 day (1-1.5 hours) — Mock D1 helper + .batch() support (no dependencies, no config changes)
- 12-01: 1 day (4-6 hours) — records service + 11 tests
- 12-02: 1 day (4-6 hours) — klines service + 5 tests (can run parallel with 12-01)
- 12-03: 1.25 days (5-7 hours) — admin service (spike read-only, ingest with skipped) + 6+ unit tests + integration contract tests
- 12-04: 0.75 day (3-4 hours) — line-count verification, coverage check w/ remediation loop, E2E validation
- 12-05: 0.5 day (2-3 hours) — code review, JSDoc, LEARNING.md

**Total: 4.75 days** (with 12-01/12-02 parallel: effectively 4 days)

---

**Next Step:** Plan check → Execution

---

*Plan created 2026-09-01 as part of Phase 12 Service Layer Pattern*
