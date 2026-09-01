---
phase: 14
name: Architecture Foundations (Temporal + Divergence)
status: planning
created: 2026-09-02
revised: 2026-09-02-gsd-plan-checker-fixes
---

# Phase 14 Plan: Architecture Foundations (Full Implementation)

## Overview

Build centralized time-domain abstraction module (`TemporalConverter`) and consolidate divergence type definitions across backend and frontend.

**Key Deliverables**:
1. `src/domains/temporal-api.ts` — New TemporalConverter class
2. Migration of 8+ backend modules to use TemporalConverter
3. 30+ boundary and batch operation tests
4. Unified divergence types across backend/frontend
5. Architecture documentation

**Duration**: 2.5 days  
**Work Type**: New module creation, backend migration, comprehensive testing, documentation  
**Risk Level**: Medium (new abstractions, but strong test coverage mitigates)

---

## Success Criteria (From ROADMAP Phase 14)

| SC# | Criterion | Status |
|-----|-----------|--------|
| SC1 | `src/domains/temporal-api.ts` exports `TemporalConverter` (5 named methods + batch utils) | ⚠️ New |
| SC2 | 8+ backend modules use `TemporalConverter` (incl. validate.ts, services) | ⚠️ New |
| SC3 | `src/domains/divergence.ts` single source of truth | ✅ Existing |
| SC4 | Frontend imports from centralized divergence module | ✅ Existing |
| SC5 | Zero time-conversion duplication in backend | ✅ Existing |
| SC6 | 30+ unit tests: temporal boundaries + batch operations | ⚠️ Expanded |
| SC7 | Code review: zero HIGH issues | ✅ Process |

---

## Task Breakdown

### Task 14-01: Create & Integrate TemporalConverter (2 days)

**Objectives**:
1. Create `src/domains/temporal-api.ts` with TemporalConverter class
2. Migrate 8+ backend modules to use TemporalConverter API
3. Fix remaining time-conversion edge cases
4. Write 30+ comprehensive boundary and batch tests

**Subtasks**:

#### 14-01-01: Create TemporalConverter Module (4 hours)
- [ ] Create `src/domains/temporal-api.ts`
- [ ] Implement TemporalConverter class with:
  - `msToSec(ms: number): number` — milliseconds → seconds
  - `secToMs(sec: number): number` — seconds → milliseconds
  - `dateToSec(date: Date): number` — Date → seconds
  - `secToDate(sec: number): Date` — seconds → Date
  - `convertBatch(millis: number[]): number[]` — batch ms → sec conversion
- [ ] Add comprehensive JSDoc for each method
- [ ] Run `npm run typecheck` to verify syntax
- [ ] Expected output: `src/domains/temporal-api.ts` (~100 lines, fully typed)

#### 14-01-02: Write TemporalConverter Unit Tests (4 hours)
Write tests covering all 30+ boundary cases in `src/domains/temporal-api.test.ts`:

**Boundary cases (20+)**:
- [ ] Epoch: `msToSec(0)` → 0, `secToMs(0)` → 0
- [ ] Epoch boundaries: `msToSec(999)` → 0, `msToSec(1000)` → 1
- [ ] Year 2038 boundary: `msToSec(2147483647000)` → 2147483647 (max 32-bit signed int)
- [ ] Negative timestamps: `msToSec(-1000)` should throw TimestampError
- [ ] Large timestamps (year 2100+): `msToSec(4102444800000)` works correctly
- [ ] Precision loss: `msToSec(1500)` → 1 (not 1.5)
- [ ] Round-trip consistency: `secToMs(msToSec(ms)) === floor(ms/1000)*1000`
- [ ] Date conversions: `dateToSec(new Date('2021-01-01T00:00:00Z')) === 1609459200`
- [ ] Date round-trip: `secToDate(dateToSec(d)).toISOString()` matches d's ISO string
- [ ] Batch conversion: `convertBatch([1000, 2000, 3000])` → `[1, 2, 3]`
- [ ] Batch empty array: `convertBatch([])` → `[]`
- [ ] Batch with negative: `convertBatch([1000, -1000])` should throw or skip
- [ ] DST transitions (if platform-specific): verify UTC consistency
- [ ] Very large batch (1000+): performance test passes
- [ ] Mixed precision: `msToSec(1500.5)` → 1 (consistent truncation)
- [ ] Floating-point edge: `msToSec(999.9)` → 0
- [ ] Multiple conversions: 100K rapid conversions < 50ms
- [ ] Memory: no leaks in batch loops (stress test)

**Integration cases (10+)**:
- [ ] Combined with Timestamp class: `Timestamp.fromSeconds(msToSec(ms))` works
- [ ] Reverse compatibility: existing `Timestamp` API not broken
- [ ] Cross-module: Records service uses both old and new APIs in same flow

#### 14-01-03: Migrate Backend Modules to TemporalConverter (8 hours)
Migrate the following 8+ modules. For each, run `npm test -- <file>` after migration:

1. **`src/lib/db.ts`** (SC2 explicit):
   - [ ] Line 39: `start` parameter: `Timestamp.fromMillis(start).toSeconds()` → `TemporalConverter.msToSec(start)`
   - [ ] Line 40: `end` parameter: `Timestamp.fromMillis(end).toSeconds()` → `TemporalConverter.msToSec(end)`
   - [ ] Lines 52, 92, 128: `Timestamp.now().toSeconds()` → `TemporalConverter.secToMs(Date.now())`? (or keep Timestamp for now/Date.now, clarify intent)
   - [ ] Verify SQL BETWEEN queries still correct after migration
   - [ ] Test: existing tests for `queryKlines`, `listRecords` pass

2. **`src/lib/validate.ts`** (SC2 explicit, W2 warning):
   - [ ] Line 43: Time validation (`start_time < end_time`) — no direct conversion, but document intent
   - [ ] Import TemporalConverter for documentation
   - [ ] Test: validation tests pass

3. **`src/lib/binance.ts`**:
   - [ ] Line 18: `Timestamp.fromMillis(raw[0]).toSeconds()` → `TemporalConverter.msToSec(raw[0])`
   - [ ] Test: `parseKline` correctly converts Binance timestamps

4. **`src/routes/klines.ts`**:
   - [ ] Lines 30-31: `Timestamp.fromMillis(startMs).toSeconds()` → `TemporalConverter.msToSec(startMs)`
   - [ ] Lines 30-31: `Timestamp.fromMillis(endMs).toSeconds()` → `TemporalConverter.msToSec(endMs)`
   - [ ] Test: API endpoint tests pass

5. **`src/routes/admin.ts`**:
   - [ ] Line 38: `Date.now() - 2*60*60*1000` → `TemporalConverter.msToSec(Date.now() - 2*60*60*1000)` OR use TemporalConverter for arithmetic
   - [ ] Test: admin spike-test endpoint works

6. **`src/services/klines.service.ts`** (W2 warning, services layer):
   - [ ] Audit for any `Math.floor(ms/1000)` patterns
   - [ ] Migrate to TemporalConverter if found
   - [ ] Test: service layer tests pass

7. **`src/services/records.service.ts`** (W2 warning):
   - [ ] Audit for time logic
   - [ ] Migrate if found
   - [ ] Test: service layer tests pass

8. **`src/services/admin.service.ts`** (W2 warning):
   - [ ] Audit for time logic
   - [ ] Migrate if found
   - [ ] Test: admin service tests pass

#### 14-01-04: Fix Remaining Timezone/Edge Cases (2 hours)
- [ ] Audit `src/lib/binance.ts:parseKline` — verify UTC consistency (no local time leakage)
- [ ] Audit `src/lib/db.ts` — verify BETWEEN comparisons use same units (all seconds)
- [ ] Audit `src/routes/klines.ts` — verify query parameter conversion doesn't assume local timezone
- [ ] Fix `src/routes/admin.ts:38` — replace `Date.now() - 2*60*60*1000` pattern
- [ ] Test: no timezone-related test failures

#### 14-01-05: Run Comprehensive Tests (2 hours)
- [ ] Command: `npm test` — verify all 365+ existing tests pass
- [ ] Command: `npm run typecheck` — zero TypeScript errors
- [ ] Command: `npx vitest run src/domains/temporal-api.test.ts` — all 30+ new tests pass
- [ ] Performance: `time npx vitest run` — edge case tests complete < 100ms
- [ ] Coverage: `npm run test:coverage` — temporal-api.ts ≥ 90% coverage (all methods exercised)

**Expected Deliverables**:
- `src/domains/temporal-api.ts` (new) — ~120 lines, 5 methods + batch
- `src/domains/temporal-api.test.ts` (new) — ~200 lines, 30+ test cases
- 8+ backend modules migrated (git diff shows Math.floor → TemporalConverter swaps)
- All 365+ tests passing
- Zero TypeScript errors
- Performance benchmark: < 100ms for 30+ tests

---

### Task 14-02: Divergence Verification & Documentation (0.5 days)

**Objectives**:
1. Verify divergence type sync (backend ↔ frontend)
2. Remove hardcoded divergence strings
3. Write architecture documentation
4. Enhance JSDoc comments

**Subtasks**:

#### 14-02-01: Backend Import Verification (1 hour)
- [ ] Command: `rg "DIVERGENCE_TYPES|TYPE_LABELS" src/ --type ts`
- [ ] Verify all results import from `src/domains/divergence`
- [ ] Expected: only imports, no local definitions
- [ ] Audit: `src/lib/validate.ts`, `src/services/*.service.ts`, `src/routes/*.ts`

#### 14-02-02: Frontend Import Verification (1 hour)
- [ ] Command: `rg "DIVERGENCE_TYPES|TYPE_LABELS" public/ --type js`
- [ ] Verify all results import from `public/js/divergence.js`
- [ ] Expected: `public/js/records.js:import { TYPE_LABELS } from './divergence.js'`
- [ ] No hardcoded definitions

#### 14-02-03: Hardcoded String Search & Refactor (2 hours)
- [ ] Command: `rg "BTC_HH_ETH_LH|BTC_LH_ETH_HH|BTC_LL_ETH_HL|BTC_HL_ETH_LL" src/ public/`
- [ ] For each match: refactor to use `DIVERGENCE_TYPES[i]` or named constant
- [ ] Example fix: `if (type === 'BTC_HH_ETH_LH')` → `if (type === DIVERGENCE_TYPES[0])`
- [ ] Test: all tests pass after refactor

#### 14-02-04: Type Sync Automated Test (1 hour)
- [ ] Create `src/domains/divergence.test.ts` (if not existing)
- [ ] Add test: "backend and frontend types match"
  - Read `src/domains/divergence.ts` DIVERGENCE_TYPES
  - Read `public/js/divergence.js` DIVERGENCE_TYPES
  - Assert arrays equal byte-for-byte
  - Assert TYPE_LABELS in both have same keys
- [ ] Test: `npx vitest run src/domains/divergence.test.ts` passes

#### 14-02-05: Write Architecture Documentation (2 hours)
- [ ] Create `docs/TIMESTAMP-GUIDE.md` (if not existing)
- [ ] Contents (2-3 pages):
  1. **Why TemporalConverter Matters** — mm/sec confusion history, bugs it prevents
  2. **TemporalConverter API Reference** — each method, parameters, return, examples
  3. **Usage Patterns**
     - Binance kline parsing: `TemporalConverter.msToSec(raw[0])`
     - DB queries: `TemporalConverter.msToSec(userInput)`
     - Date creation: `TemporalConverter.secToDate(sec)`
  4. **Common Pitfalls** — mixing units, assuming local TZ, precision loss
  5. **Migration from Math.floor** — before/after examples
  6. **Divergence Type Pattern** — why DIVERGENCE_TYPES is centralized
- [ ] Link from README.md or docs/index.md

#### 14-02-06: Enhance JSDoc Comments (1 hour)
- [ ] `src/domains/temporal-api.ts`: add @param, @returns, @throws, @example to all methods
- [ ] `src/lib/timestamp.ts`: verify existing JSDoc is complete
- [ ] `src/domains/divergence.ts`: add comments explaining each type (e.g., "BTC HH + ETH LH = ETH weakness")

#### 14-02-07: Final Verification (1 hour)
- [ ] Command: `npm test` — all 365+ tests pass
- [ ] Command: `npm run typecheck` — zero errors
- [ ] Manual spot-check: create a record with edge-case time, verify it displays correctly
- [ ] Manual spot-check: filter by time range, verify correct results
- [ ] Manual spot-check: divergence type labels display correctly in UI

**Expected Deliverables**:
- `docs/TIMESTAMP-GUIDE.md` (new)
- Enhanced JSDoc in `temporal-api.ts`, `timestamp.ts`, `divergence.ts`
- Automated divergence sync test in `divergence.test.ts`
- All hardcoded divergence strings refactored
- All 365+ tests passing
- Zero TypeScript errors

---

## Success Checklist

**SC1 — TemporalConverter Module**:
- [ ] `src/domains/temporal-api.ts` exists
- [ ] Exports TemporalConverter class
- [ ] 5 named methods: msToSec, secToMs, dateToSec, secToDate, convertBatch
- [ ] Unit tests: 30+ covering boundaries, batch ops, edge cases
- [ ] All tests pass

**SC2 — 8+ Backend Module Migration**:
- [ ] ✅ `src/lib/db.ts`
- [ ] ✅ `src/lib/validate.ts`
- [ ] ✅ `src/lib/binance.ts`
- [ ] ✅ `src/routes/klines.ts`
- [ ] ✅ `src/routes/admin.ts`
- [ ] ✅ `src/services/klines.service.ts`
- [ ] ✅ `src/services/records.service.ts`
- [ ] ✅ `src/services/admin.service.ts`
- [ ] All modules use TemporalConverter, zero `Math.floor(ms/1000)`
- [ ] All tests pass post-migration

**SC3-SC5 (Divergence)**:
- [ ] Backend imports unified (only from `src/domains/divergence.ts`)
- [ ] Frontend imports unified (only from `public/js/divergence.js`)
- [ ] Automated sync test added
- [ ] No hardcoded divergence strings in code
- [ ] All tests pass

**SC6 — 30+ Boundary & Batch Tests**:
- [ ] 30+ new tests added to `temporal-api.test.ts`
- [ ] All tests pass
- [ ] Coverage ≥ 90% for TemporalConverter
- [ ] 44 existing Timestamp tests still pass
- [ ] Total: 365+ tests passing

**SC7 — Code Review**:
- [ ] Zero HIGH/CRITICAL issues
- [ ] TypeScript compilation clean
- [ ] JSDoc complete for new APIs
- [ ] Architecture documentation clear

---

## Verification Commands (W1 — Explicit Verification)

Run these before marking phase complete:

```bash
# All tests pass
npm test

# Type check passes
npm run typecheck

# TemporalConverter tests all pass
npx vitest run src/domains/temporal-api.test.ts

# Divergence sync tests all pass
npx vitest run src/domains/divergence.test.ts

# Coverage report
npm run test:coverage

# No hardcoded divergence strings remain
rg "BTC_HH_ETH_LH|BTC_LH_ETH_HH|BTC_LL_ETH_HL|BTC_HL_ETH_LL" src/ public/ || echo "None found"

# All imports centralized
rg "DIVERGENCE_TYPES" src/ | grep -v "import"  || echo "Only imports, good"
rg "DIVERGENCE_TYPES" public/ | grep -v "import" || echo "Only imports, good"
```

---

## Handoff Criteria

Phase 14 is complete when:

- ✅ `src/domains/temporal-api.ts` created with TemporalConverter (SC1)
- ✅ 8+ backend modules migrated to TemporalConverter (SC2)
- ✅ 30+ boundary & batch tests pass (SC6)
- ✅ Divergence types verified in sync (SC3-SC5)
- ✅ Architecture documentation complete (docs/TIMESTAMP-GUIDE.md)
- ✅ All 365+ tests passing, zero TypeScript errors
- ✅ Code review: zero HIGH/CRITICAL issues
- ✅ Verification commands all pass (W1)
- ✅ Ready for Phase 15-16 (unified temporal API, stable divergence types)
