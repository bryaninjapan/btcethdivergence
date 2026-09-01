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
| SC2 | All backend time conversions use `TemporalConverter` (4 active modules: db, binance, klines, admin) | ⚠️ New |
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

#### 14-01-01: Verify & Commit Existing TemporalConverter Implementation (2 hours)
**W1 — Existing Implementation Found**: `src/domains/temporal-api.ts` already exists (untracked, created 2026-09-02 01:53), fully implemented with all 5 named methods + batch utilities and complete JSDoc.
- [ ] Review existing `src/domains/temporal-api.ts` against SC1 requirements
- [ ] Verify all 5 methods implemented: `msToSec`, `secToMs`, `dateToSec`, `secToDate`, `convertBatch`
- [ ] Verify comprehensive JSDoc is present for all methods
- [ ] Run `npm run typecheck` to verify syntax (should pass)
- [ ] Commit untracked file to git: `git add src/domains/temporal-api.ts && git commit`
- [ ] Expected output: File committed, ready for use by downstream tasks

#### 14-01-02: Verify & Commit Existing TemporalConverter Unit Tests (2 hours)
**W1 — Existing Tests Found**: `src/domains/temporal-api.test.ts` already exists (untracked), fully implemented with 36 passing test cases covering all boundary and batch scenarios.
- [ ] Review existing `src/domains/temporal-api.test.ts` against SC6 boundary case requirements (list below)
- [ ] Verify test file covers 30+ boundary and batch cases
- [ ] Verify all test suites pass: `npx vitest run src/domains/temporal-api.test.ts`
- [ ] Commit untracked test file to git: `git add src/domains/temporal-api.test.ts && git commit`
- [ ] Verify coverage ≥ 90% for temporal-api.ts: `npm run test:coverage -- src/domains/temporal-api.ts`
- [ ] Expected output: 36+ tests passing, file committed

**Existing Boundary Cases Verified** (summary, full list below)
Write tests covering all 30+ boundary cases in `src/domains/temporal-api.test.ts`:

**Existing Boundary Cases (36 tests cover all of the following)**:
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
Migrate actual time-conversion sites (binance.ts:18, klines.ts:30–31, db.ts:52/92/128). Audit remaining modules for any `Math.floor(ms/1000)` patterns; migrate if found. For each change, run `npm test -- <file>` after migration:

1. **`src/lib/db.ts`** (SC2 explicit):
   - [ ] Lines 52, 92, 128: `Timestamp.now().toSeconds()` currently produce seconds; these populate `created_at`/`updated_at`/backfill cursor (all in seconds)
   - [ ] Replace with: `TemporalConverter.dateToSec(new Date())` (NOT `secToMs`, which returns ms and would corrupt second-domain columns)
   - [ ] Verify: queryKlines passes start/end as raw numbers (no conversion in db.ts); migration scope is only the Timestamp.now() sites, not start/end params
   - [ ] Test: existing tests for `queryKlines`, `listRecords` pass

2. **`src/lib/validate.ts`** (SC2 explicit, audit-only):
   - [ ] Audit: Search for any `Math.floor(ms/1000)` or Timestamp time conversions
   - [ ] Line 43 (`start_time < end_time`) is pure comparison; no conversion to migrate
   - [ ] Test: validation tests pass (no code changes expected)

3. **`src/lib/binance.ts`**:
   - [ ] Line 18: `Timestamp.fromMillis(raw[0]).toSeconds()` → `TemporalConverter.msToSec(raw[0])`
   - [ ] Test: `parseKline` correctly converts Binance timestamps

4. **`src/routes/klines.ts`**:
   - [ ] Lines 30-31: `Timestamp.fromMillis(startMs).toSeconds()` → `TemporalConverter.msToSec(startMs)`
   - [ ] Lines 30-31: `Timestamp.fromMillis(endMs).toSeconds()` → `TemporalConverter.msToSec(endMs)`
   - [ ] Test: API endpoint tests pass

5. **`src/routes/admin.ts`**:
   - [ ] Line 38: `Date.now() - 2*60*60*1000` is Binance probe `startTime` in MILLISECONDS; do NOT apply `msToSec` (would break spike-test)
   - [ ] Clarify intent: if converting from ms to sec, use `TemporalConverter.msToSec(value)`; if staying in ms, leave arithmetic as-is
   - [ ] Verify: spike-test endpoint still correctly fetches 2 hours of backfill data
   - [ ] Test: admin spike-test endpoint works

6. **`src/services/klines.service.ts`** (audit-only):
   - [ ] Audit for any `Math.floor(ms/1000)` or time-domain conversions
   - [ ] Migrate to TemporalConverter if found (likely no-op)
   - [ ] Test: service layer tests pass

7. **`src/services/records.service.ts`** (audit-only):
   - [ ] Audit for any `Math.floor(ms/1000)` or time-domain conversions
   - [ ] Migrate to TemporalConverter if found (likely no-op)
   - [ ] Test: service layer tests pass

8. **`src/services/admin.service.ts`** (audit-only):
   - [ ] Audit for any `Math.floor(ms/1000)` or time-domain conversions
   - [ ] Migrate to TemporalConverter if found (likely no-op)
   - [ ] Test: admin service tests pass

#### 14-01-04: Fix Remaining Timezone/Edge Cases (1 hour) — **W3 Fix**
- [ ] Audit `src/lib/binance.ts:parseKline` — verify UTC consistency (no local time leakage)
- [ ] Audit `src/lib/db.ts` — verify BETWEEN comparisons use same units (all seconds)
- [ ] Audit `src/routes/klines.ts` — verify query parameter conversion doesn't assume local timezone
- [ ] **`src/routes/admin.ts:38` — NO CHANGE**: `Date.now() - 2*60*60*1000` is Binance probe `startTime` in MILLISECONDS; this is correct and should remain as-is (not converted to seconds)
  - This value is passed directly to Binance API which expects milliseconds
  - Do NOT apply `TemporalConverter.msToSec()` here — would corrupt the timestamp
  - Add regression assertion in spike-test that `startTime` is in milliseconds
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

#### 14-02-03: Hardcoded String Search & Refactor (2 hours) — **B3 Fix**
- [ ] Command (lowercase): `rg "btc_hh_eth_lh|btc_lh_eth_hh|btc_ll_eth_hl|btc_hl_eth_ll" src/ public/ --type ts --type js`
- [ ] Check `public/index.html` lines 27–30 & 80–83 for hardcoded option values
- [ ] For each match: refactor to use the typed `DivergenceType` constant or imported `DIVERGENCE_TYPES` array
- [ ] Example fix: `if (type === 'btc_hh_eth_lh')` → reference a named constant like `const types = ['btc_hh_eth_lh', 'btc_lh_eth_hh', …]` imported from divergence module (NOT array index, which breaks on reorder)
- [ ] **`public/index.html` MUST generate `<option>` values from `public/js/divergence.js` at runtime** — NO hardcoded escape hatch (W3: removed "or add hardcoded values to sync test")
  - Use JavaScript in `records.js` to populate filter `<select>` and dialog radio options from `DIVERGENCE_TYPES` at page load
  - This ensures frontend and backend definitions stay in sync without manual duplication
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

### Task 14-03: Code Review (0.5 days) — **B1 Fix**

**Objective**: Satisfy SC7 requirement — verify zero HIGH/CRITICAL severity issues in Phase 14 changes.

**Subtasks**:

#### 14-03-01: Review Phase 14 Diffs (2 hours)
- [ ] Run `git log --oneline phase-14..HEAD` to list all commits from this phase
- [ ] Run `git diff phase-14-start..HEAD -- src/domains/ src/lib/ src/routes/ src/services/` to view all changes
- [ ] Use gsd-code-review agent or manual review to audit:
  - **Correctness**: Time-domain conversions are consistent (no ms/sec mixing), math is accurate
  - **Type Safety**: All `DivergenceType` usages use constants, not string literals
  - **Error Handling**: TemporalConverter throws TimestampError for negative inputs; callers handle appropriately
  - **Performance**: No O(n²) loops in batch conversions; TemporalConverter stays < 500ms for 100K ops
  - **Security**: No hardcoded secrets, API credentials, or sensitive data in code
  - **Test Coverage**: All modified functions have corresponding unit tests
  - **JSDoc**: All public methods have complete documentation
- [ ] Document any issues found in PHASE-14-REVIEW.md (empty if no issues)
- [ ] Severity levels: CRITICAL (breaks functionality), HIGH (correctness issue), MEDIUM (style/performance), LOW (documentation)
- [ ] Target: zero CRITICAL/HIGH issues; accept MEDIUM/LOW with documented rationale

#### 14-03-02: Verify TypeScript & Linter (30 min)
- [ ] Run `npm run typecheck` — must pass with exit code 0
- [ ] Run `npx eslint src/domains/ src/lib/ src/routes/` (if configured) — zero errors in changed files
- [ ] Verify no `console.log` or `debugger` statements in production code

**Expected Deliverables**:
- PHASE-14-REVIEW.md with review checklist and sign-off (zero HIGH/CRITICAL or documented acceptance)
- All review findings addressed or documented

---

## Success Checklist

**SC1 — TemporalConverter Module**:
- [ ] `src/domains/temporal-api.ts` exists
- [ ] Exports TemporalConverter class
- [ ] 5 named methods: msToSec, secToMs, dateToSec, secToDate, convertBatch
- [ ] Unit tests: 30+ covering boundaries, batch ops, edge cases
- [ ] All tests pass

**SC2 — Backend Time Conversion Migration (W2 — Actual Count: 4 Active Modules)**:
Time conversions exist only in 4 backend modules (verified by grep):
- [ ] ✅ `src/lib/db.ts` — creates/updated_at timestamps
- [ ] ✅ `src/lib/binance.ts` — Binance kline parsing
- [ ] ✅ `src/routes/klines.ts` — query parameter conversion
- [ ] ✅ `src/routes/admin.ts` — spike-test Binance query

Audit-only (zero conversions expected):
- [ ] ✅ `src/lib/validate.ts` — no time conversions (comparisons only)
- [ ] ✅ `src/services/klines.service.ts` — no conversions
- [ ] ✅ `src/services/records.service.ts` — no conversions
- [ ] ✅ `src/services/admin.service.ts` — no conversions

- [ ] All 4 active modules use TemporalConverter, zero `Math.floor(ms/1000)` outside TemporalConverter class
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
- [ ] 36 existing Timestamp tests still pass
- [ ] Total: 365+ tests passing

**SC7 — Code Review** (Task 14-03):
- [ ] PHASE-14-REVIEW.md created with sign-off
- [ ] Zero HIGH/CRITICAL issues found or documented acceptance
- [ ] TypeScript compilation clean (npm run typecheck passes)
- [ ] JSDoc complete for new APIs (temporal-api.ts, divergence.ts)
- [ ] Architecture documentation clear (docs/TIMESTAMP-GUIDE.md)

---

## Verification Commands (W4 — Comprehensive End-to-End Verification)

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

# No hardcoded divergence strings remain (lowercase check)
rg "btc_hh_eth_lh|btc_lh_eth_hh|btc_ll_eth_hl|btc_hl_eth_ll" src/ public/ --type ts --type js || echo "None found"
# Also check public/index.html for hardcoded option values
rg "btc_hh_eth_lh|btc_lh_eth_hh|btc_ll_eth_hl|btc_hl_eth_ll" public/index.html || echo "None found"

# All imports centralized (negative assertion: no scattered conversions)
rg "Timestamp\.fromMillis|Math\.floor\(ms / 1000\)" src/ --type ts | grep -v "domains/temporal-api" || echo "Zero scattered conversions, good"

# All imports centralized
rg "DIVERGENCE_TYPES" src/ | grep -v "import"  || echo "Only imports, good"
rg "DIVERGENCE_TYPES" public/ | grep -v "import" || echo "Only imports, good"

# Code review pass
test -f PHASE-14-REVIEW.md && echo "Review complete" || echo "Review file missing"
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
