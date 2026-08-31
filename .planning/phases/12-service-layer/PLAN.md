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

### **12-00: Create Test Database Helper (before all tasks)**

**Goal:** Set up test D1 infrastructure so 12-01/02/03 can use it.

**Subtasks:**

1. **Configure vitest for D1 testing**
   - Update `vitest.config.ts` to use `@cloudflare/vitest-pool-workers`
   - Enable D1 miniflare bindings
   - Set up test database instance

2. **Create src/lib/test-db.ts helper**
   - `async function createTestDatabase(): Promise<D1Database>`
     - Create isolated D1 miniflare instance
     - Run 0001, 0002, 0003 migrations
     - Return fresh D1 instance
   - `async function cleanupTestDatabase(db: D1Database): Promise<void>`
     - Drop all tables, close connection

3. **Verify helper works**
   - Write simple test: `createTestDatabase() → insert record → query → cleanup`

**Success Criteria:**
- [ ] vitest.config.ts updated with workers pool + D1
- [ ] test-db.ts helper created and tested
- [ ] Simple smoke test passes

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
   - Setup: Use createTestDatabase()
   - Test createRecord: valid input → creates record
   - Test createRecord: edge case (very long notes) → succeeds
   - Test updateRecord: updates existing → returns Record
   - Test updateRecord: non-existent id → returns null
   - Test listRecords: no filters → returns all
   - Test listRecords: filter by type → returns matching only
   - Test listRecords: filter by tag → returns matching only
   - Test deleteRecord: existing id → returns true
   - Test deleteRecord: non-existent id → returns false
   - Teardown: cleanupTestDatabase()

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
   - Setup: Use createTestDatabase() + insert test klines
   - Test queryKlines: valid range → returns matching klines
   - Test queryKlines: empty range → returns empty array
   - Test queryKlines: range with data gaps → returns only in-range klines
   - Test queryKlines: BTCUSDT vs ETHUSDT → returns only requested symbol
   - Test queryKlines: large time range → handles correctly
   - Teardown: cleanupTestDatabase()

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

### **12-03: Admin Service Extraction & Testing (0.5 day)**

**Goal:** Extract admin DB operations into services/admin.service.ts (NOT the Binance fetch logic).

**Subtasks:**

1. **Create services/admin.service.ts**
   - `async function getBackfillCursor(db: D1Database, symbol: string): Promise<number | null>`
     - Trust symbol is valid (Zod checked)
     - Call existing `db.getBackfillCursor(db, symbol)`
     - Return cursor (unix seconds) or null if not set

   - `async function setBackfillCursor(db: D1Database, symbol: string, cursor: number): Promise<void>`
     - Trust symbol and cursor are valid
     - Call existing DB function
     - Return void

   - **Note:** Binance fetch/spike logic stays in routes/admin.ts + lib/binance.ts (not extracted)

2. **Write services/admin.service.test.ts**
   - Setup: Use createTestDatabase()
   - Test getBackfillCursor: unset symbol → returns null
   - Test getBackfillCursor: after set → returns cursor
   - Test setBackfillCursor: sets and persists
   - Teardown: cleanupTestDatabase()

3. **Refactor routes/admin.ts**
   - Replace inline cursor queries with service calls
   - Keep: Binance fetch logic, fallback handling, CF Access token validation
   - Example:
     ```typescript
     admin.get('/api/admin/cursor', async (c) => {
       // Auth + validation at route level
       const symbol = c.req.query('symbol');
       
       // Service: data access
       const cursor = await adminService.getBackfillCursor(c.env.DB, symbol);
       return c.json({ ok: true, data: { symbol, cursor, default: 1609459200 } });
     });
     ```

**Success Criteria:**
- [ ] services/admin.service.ts created with 2 cursor functions
- [ ] services/admin.service.test.ts created with 3 tests
- [ ] All 3 tests passing
- [ ] routes/admin.ts refactored (cursor logic only, fetch stays)
- [ ] Integration tests pass (routes/admin.test.ts)

---

### **12-04: Verification & Coverage (0.5 day)**

**Goal:** Verify all services work correctly, check code quality, and measure coverage.

**Subtasks:**

1. **Run type checking**
   - `npm run typecheck` — verify no TypeScript errors in new services + refactored routes
   - `npm run typecheck:scripts` — verify if any scripts were changed

2. **Run test suite**
   - `npm test` — all unit tests (services + routes integration) must pass
   - Should include: 12-00 smoke test + 12-01 (8 tests) + 12-02 (5 tests) + 12-03 (3 tests) = 16+ tests

3. **Measure code coverage**
   - Update `package.json` script:
     ```json
     "test:coverage": "vitest run --coverage --coverage.include='src/**,public/js/**' --coverage.thresholds.lines=80"
     ```
   - Run `npm run test:coverage` — verify ≥ 80% overall
   - Report: which files need more tests (if any)

4. **Run existing E2E tests**
   - `npx playwright test` — run calculator E2E tests
   - Verify no regressions in critical flows

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
- `src/services/records.service.ts` (~60 lines) — createRecord, updateRecord, listRecords, deleteRecord wrappers
- `src/services/records.service.test.ts` (~180 lines) — 8 test cases
- `src/services/klines.service.ts` (~30 lines) — queryKlines wrapper
- `src/services/klines.service.test.ts` (~120 lines) — 5 test cases
- `src/services/admin.service.ts` (~40 lines) — getBackfillCursor, setBackfillCursor wrappers
- `src/services/admin.service.test.ts` (~100 lines) — 3 test cases
- `src/lib/test-db.ts` (~60 lines) — createTestDatabase(), cleanupTestDatabase() helpers

### **Modified Files**
- `vitest.config.ts` — add workers pool + D1 miniflare bindings (for test DB)
- `package.json` — update test:coverage script to include src/**
- `src/routes/records.ts` (~15 lines reduction) — replace logic with service calls
- `src/routes/klines.ts` (~10 lines reduction) — replace query logic with service calls
- `src/routes/admin.ts` (~15 lines reduction) — replace cursor logic with service calls

### **Unchanged**
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

1. ✅ All business logic extracted to services/ (records, klines, admin)
2. ✅ 16+ unit tests created, all passing (12-00 smoke + 12-01/02/03 tests)
3. ✅ Integration tests pass (routes still work, no regressions)
4. ✅ E2E tests pass (calculator flows work)
5. ✅ `npm run typecheck` passes (no TypeScript errors)
6. ✅ `npm run test:coverage` ≥ 80% overall
7. ✅ Code review complete (no HIGH issues)
8. ✅ LEARNING.md updated with lessons
9. ✅ Ready to commit

---

## Estimated Effort

- 12-00: 0.5 day (2-3 hours) — vitest config + test-db helper
- 12-01: 1 day (4-6 hours) — records service + 8 tests
- 12-02: 1 day (4-6 hours) — klines service + 5 tests (can run parallel with 12-01)
- 12-03: 0.5 day (2-3 hours) — admin service + 3 tests
- 12-04: 0.5 day (2-3 hours) — verification, coverage, E2E check
- 12-05: 0.5 day (2-3 hours) — code review, JSDoc, LEARNING.md

**Total: 3.5-4 days** (with 12-01/12-02 parallel: effectively 3-3.5 days)

---

**Next Step:** Plan check → Execution

---

*Plan created 2026-09-01 as part of Phase 12 Service Layer Pattern*
