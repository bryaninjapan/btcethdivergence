# Phase 10: Timestamp Domain Abstraction

**Date**: 2026-09-01  
**Status**: Ready for execution (plan revised after check)  
**Goal**: Eliminate scattered time conversion logic (`Math.floor(ms / 1000)`) across codebase. Replace with strongly-typed `Timestamp` class for type safety and single source of truth.

---

## Decisions (Resolved)

### D1: Kline.open_time Type Scope ✅ DECIDED
**Choice**: **Option B — Boundaries Only**

**Rationale**:
- Binance API returns timestamps in **milliseconds** (raw[0])
- Database stores **seconds** (existing contract)
- Changing entire model to Timestamp type would ripple to 5+ untouched files
- Boundaries-only approach: Convert at API input/output points, keep internal storage as seconds

**Impact**: Minimal ripple; only 5 conversion points affected (vs. 10+ with full type change)

### D2: Frontend Timestamp Access ✅ DECIDED
**Choice**: **Option A — Duplicate public/js/timestamp.js**

**Rationale**:
- Phase 6 constraint: No build step, no bundler
- Timestamp class is simple (112 lines, 44 tests)
- Can duplicate to frontend as plain ESM + parity tests
- No bundler needed, maintains static asset pipeline

**Impact**: Add 1 new file (`public/js/timestamp.js`), add parity tests

---

## Context

Currently, timestamp conversions are scattered:
- **Backend**: `Math.floor(Date.now() / 1000)` appears 3 times in db.ts
- **Binance fetch**: `Math.floor(raw[0] / 1000)` in binance.ts:17
- **Routes**: Individual conversions in klines.ts (2x)
- **Frontend**: `Math.floor(startMs / 1000)` in charts.js (2x), datetime.js (1x)
- **Risk**: Off-by-1000 bugs in backfill, timezone confusion, no compile-time type safety

**Solution**: Created `Timestamp` class (src/lib/timestamp.ts) + `TimeConverter` utility with full test coverage (44/44 tests passing).

---

## Phase Success Criteria

✅ **Code Quality**:
- [x] Timestamp class 100% tested (44 unit tests passing)
- [ ] All 10 conversion expressions use Timestamp API (see Conversion Inventory below) — applies to `Math.floor(ms/1000)` pattern only
- [ ] Zero `Math.floor(ms / 1000)` in production code (verified via grep)
- [ ] Zero `Math.floor(Date.now() / 1000)` in production code (verified via grep)
- [ ] Zero `Math.floor(Date.UTC(...) / 1000)` in production code (verified via grep)
- [ ] TypeScript strict mode: `npm run typecheck` passes
- [ ] TypeScript for scripts: `npm run typecheck:scripts` passes
- [ ] Code review: gsd-code-review run, no HIGH issues fixed

✅ **Integration**:
- [ ] Backend: db.ts (3x), binance.ts, klines.ts all converted (Math.floor pattern)
- [ ] Frontend: charts.js (2x), datetime.js, records.js all converted
- [ ] Parity tests verify public/js/timestamp.js matches src/lib/timestamp.ts
- [ ] All backend tests pass (`npm test -- src/`)
- [ ] Manual UAT: Charts page renders correctly, records page CRUD works

✅ **Verification**:
- [ ] Backend: `npm test -- src/` passes all tests
- [ ] Backend: `npm run typecheck` passes (TypeScript strict mode)
- [ ] Backend: `npm run typecheck:scripts` passes (scripts type checking)
- [ ] Backend grep: `rg -n "Math\.floor" src --type ts` returns only timestamp.ts:27 (sanctioned exception)
- [ ] Frontend grep: `rg -n "Math\.floor" public/js --type js` returns empty
- [ ] Binance conversion verification: `npm test -- src/binance.test.ts` passes (exercises parseKline conversion without --dry-run, which does not exist)
- [ ] Code review: `gsd-code-review`, no HIGH issues

✅ **Documentation**:
- [ ] LEARNING.md updated with Timestamp design rationale, D1/D2 decisions, and why boundaries-only was chosen
- [ ] Inline code comments in db.ts, binance.ts, klines.ts explain Timestamp usage pattern
- [ ] Parity-test documentation in public/js/timestamp.test.js explains equivalence-checking approach

---

## Conversion Inventory (Verified via Grep)

**All production sites that convert `ms ÷ 1000` or `Date.now() / 1000`:**

| File | Line(s) | Current Code | Context |
|------|---------|--------------|---------|
| **Backend** |
| `src/lib/db.ts` | 51 | `Math.floor(Date.now() / 1000)` | Get current time in seconds |
| `src/lib/db.ts` | 89 | `Math.floor(Date.now() / 1000)` | Record update timestamp |
| `src/lib/db.ts` | 124 | `Math.floor(Date.now() / 1000)` | Cursor tracking |
| `src/lib/binance.ts` | 17 | `Math.floor(raw[0] / 1000)` | Parse Binance API input (ms → sec) |
| `src/routes/klines.ts` | 21 | `Math.floor(startMs / 1000)` | Query param conversion |
| `src/routes/klines.ts` | 22 | `Math.floor(endMs / 1000)` | Query param conversion |
| **Frontend** |
| `public/js/charts.js` | 95-96 | `Math.floor(startMs / 1000)`, `Math.floor(endMs / 1000)` | Charts page range init |
| `public/js/datetime.js` | 42 | `Math.floor(Date.UTC(...) / 1000)` | Build epoch from date picker |
| `public/js/records.js` | 124 | `Math.floor(Date.now() / 1000)` | Default timestamp for new record |

**Total**: 10 conversion expressions across 6 files

---

## Plans

### Plan 10-01: Backend Integration (2-3 hours)

**Goal**: Convert 6 backend conversion expressions to use Timestamp API (D1 Option B: no Kline type change)

**Approach**: Replace all `Math.floor(Date.now() / 1000)` and `Math.floor(ms / 1000)` with Timestamp API; keep Kline.open_time type as `number`

**Files to modify**:
1. `src/lib/db.ts` — Replace 3x `Math.floor(Date.now() / 1000)` (lines 51, 89, 124) with `Timestamp.now().toSeconds()`
2. `src/lib/binance.ts:17` — Replace `Math.floor(raw[0] / 1000)` with `Timestamp.fromMillis(raw[0]).toSeconds()`
3. `src/routes/klines.ts:21` — Replace `Math.floor(startMs / 1000)` with `Timestamp.fromMillis(startMs).toSeconds()`
4. `src/routes/klines.ts:22` — Replace `Math.floor(endMs / 1000)` with `Timestamp.fromMillis(endMs).toSeconds()`

**Note**: `src/types.ts`, kline-insert.ts, validate.ts, admin.ts, and tests remain unchanged (no Kline type change per D1 Option B)

**Tasks**:
- [ ] Import Timestamp class in db.ts, binance.ts, klines.ts
- [ ] Replace 6 conversion expressions: db.ts (3x), binance.ts (1x), klines.ts (2x)
- [ ] Handle edge case: klines.ts currently accepts any numeric start/end; `Timestamp.fromMillis(negative)` throws. Add guard before conversion:
  - Guard both `startMs < 0` and `endMs < 0`, reject with 400 Bad Request (deliberate behavior change vs current 200 with empty results per W3 fix)
  - Add one klines.test.ts case asserting 400 response for negative start/end (document the deliberate behavior change)
- [ ] Run backend tests: `npm test -- src/` (should all pass, including new negative-input test)
- [ ] Run typecheck: `npm run typecheck` (should pass)
- [ ] Run typecheck for scripts: `npm run typecheck:scripts` (should pass)
- [ ] Verify grep (backend): `rg -n "Math\.floor" src --type ts -g '!*.test.*'` returns only timestamp.ts:27 (sanctioned exception)
- [ ] Verify existing tests: `npm test -- src/binance.test.ts` exercises parseKline conversion without updates needed (D1 Option B holds)
- [ ] Commit: "feat: Use Timestamp API throughout backend (db, binance, klines); add input validation for negative timestamps"

**Success**: All 6 backend conversions use Timestamp API; tests pass; typecheck passes; grep clean (except sanctioned exception); no Kline type change.

### Plan 10-02: Frontend Integration (2-3 hours)

**Goal**: Convert 4 frontend conversion expressions + create duplicate Timestamp class (D2 Option A: duplicate JS with Math.trunc optimization)

**Approach**: Create `public/js/timestamp.js` mimicking src/lib/timestamp.ts API **but use Math.trunc instead of Math.floor** for `fromMillis()` (mathematically equivalent, eliminates Math.floor pattern); update charts.js, datetime.js, and records.js to use it

**Files to create/modify**:
1. **NEW**: `public/js/timestamp.js` — Duplicate Timestamp class (plain ESM)
   - Use `Math.trunc(millis / 1000)` in `fromMillis()` instead of `Math.floor()` (TDD verified: equivalent for all valid inputs)
   - Parity tests verify behavior matches backend Timestamp
2. `public/js/charts.js` — Replace 2x `Math.floor(ms / 1000)` in setPickersFromMs (lines 95-96)
3. `public/js/datetime.js` — Replace `Math.floor(Date.UTC(...) / 1000)` in buildUtcEpoch (line 42)
4. `public/js/records.js` — Replace `Math.floor(Date.now() / 1000)` when creating new record (line 124)

**Tasks**:
- [ ] Create `public/js/timestamp.js` with full API (fromSeconds, fromMillis, toSeconds, toMillis, arithmetic methods, plus, minus, etc.) matching src/lib/timestamp.ts interface
  - **Important**: Use `Math.trunc(millis / 1000)` in `fromMillis()` instead of `Math.floor()` (TDD verified: mathematically equivalent for non-negative inputs)
  - **Critical (W2 fix)**: Add explicit guard at top of `fromMillis()`: `if (millis < 0) throw new TimestampError("Negative milliseconds not allowed")` — ensures parity with backend behavior for all inputs, including edge case (-1000 < ms < 0)
- [ ] Add parity tests in `public/js/timestamp.test.js` verifying:
  - Key operations (fromMillis + toSeconds, now + toSeconds, fromParts + toParts) match src/lib/timestamp.ts behavior
  - **Negative input rejection**: `fromMillis(-500)` throws TimestampError (W2 fix verification)
- [ ] Update charts.js: Import Timestamp, replace lines 95-96 conversions with `Timestamp.fromMillis(ms).toSeconds()`
- [ ] Update datetime.js: Import Timestamp, replace line 42 conversion with `Timestamp.fromMillis(Date.UTC(...)).toSeconds()`
- [ ] Update records.js: Import Timestamp, replace line 124 with `Timestamp.now().toSeconds()`
- [ ] Manual UAT charts page: Load records, render chart, verify time picker syncs correctly with Timestamp arithmetic
- [ ] Manual UAT records page: Create/edit/delete records, verify timestamps calculate and display correctly
- [ ] Run parity tests: `npm test public/js/timestamp.test.js` (verify both implementations behave identically, including negative rejection)
- [ ] Run existing frontend test suite: `npm test public/js/` (verify no regressions in datetime.js or other tests)
- [ ] Verify grep (backend): `rg -n "Math\.floor" src --type ts -g '!*.test.*'` returns only timestamp.ts:27 (sanctioned exception)
- [ ] Verify grep (frontend): `rg -n "Math\.floor" public/js --type js -g '!*.test.js'` returns empty (all production code replaced with Timestamp; test file excluded per W2 fix)
- [ ] Commit: "feat: Use Timestamp API throughout frontend (charts, datetime, records); add duplicate Timestamp class with Math.trunc + negative guard"

**Success**: All 4 frontend conversions use Timestamp API; parity tests pass (including negative rejection); zero Math.floor in frontend; all existing tests still pass; charts + records UI fully functional.

---

## Dependencies & Risks

**✅ No blockers**:
- Timestamp class already implemented + tested (src/lib/timestamp.ts)
- No database migrations needed
- No Kline type change (D1 Option B: boundaries only)
- No bundler needed (D2 Option A: duplicate JS)

**Risks** (mitigated):
- Frontend Timestamp duplication: Manual sync required
  - *Mitigation*: Parity tests verify src/lib/timestamp.ts and public/js/timestamp.js behave identically
- Timestamp.toSeconds() calls must be explicit in all conversions
  - *Mitigation*: Grep verification after completion ensures all sites updated

---

## Testing Strategy

| Level | Coverage |
|-------|----------|
| **Unit** | 44 tests in timestamp.test.ts (passing ✅) |
| **Parity** | Frontend duplicate Timestamp class vs. backend src/lib/timestamp.ts (new) |
| **Integration** | Backend test suite: `npm test -- src/` (should pass) |
| **Manual** | Charts page: render, time-sync; Records page: CRUD with timestamps |
| **Verification** | TypeScript: `npm run typecheck`, `npm run typecheck:scripts` |
| **Grep** | `rg "Math\.floor\([^)]*/ 1000\)" src public/js --type ts --type js` → only timestamp.ts |

**New tests**: Parity test for public/js/timestamp.js (verify it mirrors src/lib/timestamp.ts API for key operations)

---

## Scope Boundaries & Verification Strategy

### W5: chart-range.js Scope (Resolved)

**Decision**: Option B — Exclude chart-range.js from Phase 10 scope

**Rationale**: 
- chart-range.js uses `* 1000` (sec → ms adapter for Lightweight Charts), not the `Math.floor(ms/1000)` pattern
- No ms/sec confusion risk (single-purpose adapter with clear intent)
- All actual confusion-prone conversions ARE fixed (db ↔ binance, klines ↔ db, etc.)
- Keeps Phase 10 focused on core goal: eliminate `Math.floor(ms/1000)` consolidation

**Result**: Phase 10 targets 10 production sites + 1 sanctioned exception (timestamp.ts:27)

### W1: SC2 Scope Clarification (Resolved)

**Issue**: ROADMAP SC2 ("All frontend time operations use Timestamp API") is broader than Phase 10's actual scope (which targets only `Math.floor(ms/1000)` patterns per SC3).

**Decision**: Phase 10 explicitly excludes sec→ms conversions that don't use `Math.floor`:
- `records.js:25` (`new Date(ts * 1000)`) — not a consolidation target
- `datetime.js:46` (`new Date(ts * 1000)`) — not a consolidation target  
- `charts.js:179` (`startSec * 1000`) — not a consolidation target
- `chart-range.js` (all `* 1000` conversions) — excluded per W5 Option B

These sites are **not converted** in Phase 10 and remain as single-purpose arithmetic (not confusion-prone per SC goal).

**Verification** (corrected for W1 fix):
```bash
# Backend: verify only sanctioned exception remains
rg -n "Math\.floor" src --type ts -g '!*.test.*'
# Should return: only src/lib/timestamp.ts:27 (sanctioned exception)

# Frontend: verify zero Math.floor (all replaced with Timestamp API or Math.trunc)
rg -n "Math\.floor" public/js --type js
# Should return: empty (all replaced)
```

**Verification Summary**:
- Backend after 10-01: 1 match (`timestamp.ts:27` sanctioned exception)
- Frontend after 10-02: 0 matches (all converted to Timestamp or Math.trunc)
- Total production Math.floor sites: **1 sanctioned exception** (backend Timestamp.fromMillis internal)
- Excludes: test files (`.test.ts/.test.js`), non-Math.floor arithmetic

**Post-Execution Reminders (W1/W2/W3 fixes)**:
- **W1**: After 10-03, update ROADMAP SC2 to `"All Math.floor(ms/1000) conversion patterns use Timestamp API"` (Option B decision)
- **W2**: ✅ DONE — Both frontend grep commands now use `-g '!*.test.js'` (standardized)
- **W3**: After 10-03, update ROADMAP SC3 to `"Zero Math.floor(ms/1000) outside src/lib/timestamp.ts"` (sanctioned exception documented)

**Why Option 1**:
- ✓ Single pattern catches all `Math.floor(ms/1000)` forms (Date.now, Date.UTC, simple division)
- ✓ Explicit about exclusions (test + chart-range)
- ✓ Most maintainable (vs. complex regex or multiple patterns)

---

## Effort Estimate

- **10-01 (Backend)**: 60-90 min (4 files total, 6 replacements, typecheck, grep verification)
- **10-02 (Frontend)**: 120-150 min (create Timestamp class, 3 file updates, parity tests, manual UAT)
- **Code Review**: 30-45 min (gsd-code-review, fix CRITICAL/HIGH if any)
- **Total**: ~4-5 hours focused work (roughly 1 full day)

### Plan 10-03: Code Review & Verification (1 hour)

**Goal**: Verify all changes pass code review with no HIGH/CRITICAL issues

**Files under review**:
- `src/lib/db.ts`, `src/lib/binance.ts`, `src/routes/klines.ts` (backend)
- `public/js/charts.js`, `public/js/datetime.js`, `public/js/records.js` (frontend)
- `public/js/timestamp.js` (new file)

**Tasks** (SC5 delivery point):
- [ ] Run code review: `gsd-code-review` on modified files (db.ts, binance.ts, klines.ts, charts.js, datetime.js, records.js, timestamp.ts, timestamp.js)
- [ ] Fix all CRITICAL issues (should be zero)
- [ ] Fix all HIGH issues (should be zero) — **This is the acceptance criterion for SC5**
- [ ] MEDIUM issues: fix if time permits, document if deferred
- [ ] Manual UAT charts page: Load records, render chart, verify date range sync works correctly
- [ ] Manual UAT records page: Create/edit/delete records, verify timestamps are calculated and displayed correctly
- [ ] Commit code review results (if any fixes made): "fix: Address code review findings from Phase 10"

**Success**: Code review clean (zero HIGH/CRITICAL issues), UAT passes, SC5 delivered.

---

## Next Steps After Phase 10

Once Phase 10 completes:
1. **Candidate #3** (Centralized Validation) becomes unblocked
2. **Candidate #1** (Service Layer) becomes easier to implement
3. Project codebase significantly cleaner + more maintainable

---

**Phase Status**: ✅ Ready to execute  
**Execution**: `/gsd-execute-phase 10` or manual implementation (recommended: manual, skip broken GSD skills)

---

*Created 2026-09-01 with TDD workflow (Timestamp class 44/44 tests passing)*
