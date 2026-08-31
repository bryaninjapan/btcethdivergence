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
- [ ] All 10 conversion expressions use Timestamp API (see Conversion Inventory below)
- [ ] Zero `Math.floor(ms / 1000)` in production code (verified via grep)
- [ ] Zero `Math.floor(Date.now() / 1000)` in production code (verified via grep)
- [ ] Zero `Math.floor(Date.UTC(...) / 1000)` in production code (verified via grep)
- [ ] TypeScript strict mode: `npm run typecheck` passes
- [ ] TypeScript for scripts: `npm run typecheck:scripts` passes
- [ ] Code review: gsd-code-review run, no HIGH issues fixed

✅ **Integration**:
- [ ] Backend: db.ts (3x), binance.ts, klines.ts all converted
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
- [ ] Backfill dry-run: `npx tsx scripts/backfill-fetcher.mts --dry-run` completes without error
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
| `public/js/charts.js` | 96 | `Math.floor(startMs / 1000)` | Charts page range init |
| `public/js/charts.js` | 96 | `Math.floor(endMs / 1000)` | Charts page range init |
| `public/js/datetime.js` | 42 | `Math.floor(Date.UTC(...) / 1000)` | Build epoch from date picker |
| `public/js/records.js` | 124 | `Math.floor(Date.now() / 1000)` | Default timestamp for new record |

**Total**: 8 conversion sites (10 expressions across 5 files)

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
- [ ] Handle edge case: klines.ts currently accepts any numeric start/end; `Timestamp.fromMillis(negative)` throws. Keep or add guard: reject `startMs < 0` before conversion.
- [ ] Run backend tests: `npm test -- src/` (should all pass)
- [ ] Run typecheck: `npm run typecheck` (should pass)
- [ ] Run typecheck for scripts: `npm run typecheck:scripts` (should pass)
- [ ] Verify grep (db.ts): `rg "Math\.floor\(Date\.now" src --type ts` returns empty
- [ ] Verify grep (comprehensive): `rg -n "Math\.floor" src --type ts` returns only timestamp.ts:27 (sanctioned exception)
- [ ] Test backfill: `npx tsx scripts/backfill-fetcher.mts --dry-run` (verify no crashes)
- [ ] Commit: "feat: Use Timestamp API throughout backend (db, binance, klines)"

**Success**: All 6 backend conversions use Timestamp API; tests pass; typecheck passes; grep clean; negative-input guard in place; no Kline type change.

### Plan 10-02: Frontend Integration (2-3 hours)

**Goal**: Convert 4 frontend conversion expressions + create duplicate Timestamp class (D2 Option A: duplicate JS)

**Approach**: Create `public/js/timestamp.js` mimicking src/lib/timestamp.ts API; update charts.js, datetime.js, and records.js to use it

**Files to create/modify**:
1. **NEW**: `public/js/timestamp.js` — Duplicate Timestamp class (plain ESM)
2. `public/js/charts.js` — Replace 2x `Math.floor(ms / 1000)` in setPickersFromMs (lines 95-96)
3. `public/js/datetime.js` — Replace `Math.floor(Date.UTC(...) / 1000)` in buildUtcEpoch (line 42)
4. `public/js/records.js` — Replace `Math.floor(Date.now() / 1000)` when creating new record (line 124)

**Tasks**:
- [ ] Create `public/js/timestamp.js` with full API (fromSeconds, fromMillis, toSeconds, toMillis, arithmetic methods, plus, minus, etc.) matching src/lib/timestamp.ts interface
- [ ] Add parity tests in `public/js/timestamp.test.js` verifying key operations (fromMillis + toSeconds, now + toSeconds, fromParts + toParts) match src/lib/timestamp.ts behavior
- [ ] Update charts.js: Import Timestamp, replace lines 95-96 conversions with `Timestamp.fromMillis(ms).toSeconds()`
- [ ] Update datetime.js: Import Timestamp, replace line 42 conversion with `Timestamp.fromMillis(Date.UTC(...)).toSeconds()`
- [ ] Update records.js: Import Timestamp, replace line 124 with `Timestamp.now().toSeconds()`
- [ ] Manual UAT charts page: Load records, render chart, verify time picker syncs correctly with Timestamp arithmetic
- [ ] Manual UAT records page: Create/edit/delete records, verify timestamps calculate and display correctly
- [ ] Run parity tests: `npm test public/js/timestamp.test.js` (verify both implementations behave identically)
- [ ] Verify grep (Date.now): `rg "Math\.floor\(Date\.now" public/js --type js` returns empty
- [ ] Verify grep (Date.UTC): `rg "Math\.floor\(Date\.UTC" public/js --type js` returns empty
- [ ] Verify grep (comprehensive): `rg -n "Math\.floor" public/js --type js` returns empty
- [ ] Commit: "feat: Use Timestamp API throughout frontend (charts, datetime, records); add duplicate Timestamp class"

**Success**: All 4 frontend conversions use Timestamp API; parity tests pass (public/js/timestamp.js mirrors src/lib/timestamp.ts); charts + records UI fully functional.

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

### W1: Grep Verification Pattern (Resolved)

**Decision**: Option 1 — Broad pattern with explicit exclusions

**Pattern**:
```bash
rg "Math\.floor\(.*/ 1000\)" src public/js --type ts --type js | grep -v "\.test\." | grep -v "chart-range"
```

**Verification**:
- Should find **11 matches** total:
  - 10 production Math.floor(ms/1000) sites (will be converted to Timestamp)
  - 1 sanctioned exception: `src/lib/timestamp.ts:27` (internal Timestamp implementation)
- Excludes: test files (`.test.ts/.test.js`), chart-range.js (`* 1000` pattern)

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

**Tasks**:
- [ ] Run code review: `gsd-code-review`
- [ ] Fix CRITICAL issues if any (should be none)
- [ ] Fix HIGH issues if any (should be none)
- [ ] MEDIUM issues: fix if time permits, document if deferred
- [ ] Verify backfill script: `npx tsx scripts/backfill-fetcher.mts --dry-run`
- [ ] Manual UAT: Charts page and records page fully functional
- [ ] Commit code review results (if any fixes made)

**Success**: Code review clean (no HIGH/CRITICAL), backfill verified, UAT pass.

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
