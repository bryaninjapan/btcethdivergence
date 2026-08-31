# Phase 10 Context: Timestamp Domain Abstraction

## Problem Statement

Time conversions are scattered across the codebase:
- **Backend**: `Math.floor(Date.now() / 1000)` appears 3x in db.ts
- **Binance fetch**: `Math.floor(raw[0] / 1000)` in binance.ts:17
- **Routes**: Individual `Math.floor(ms / 1000)` in klines.ts, admin.ts
- **Frontend**: `Math.floor(startMs / 1000)`, `Math.floor(endMs / 1000)` in charts.js, records.js
- **Frontend utility**: `Math.floor(Date.UTC(...) / 1000)` in datetime.js:42

This creates:
1. **Type safety gap**: Milliseconds/seconds confusion possible anywhere
2. **Maintenance burden**: Conversions repeated across 6+ files
3. **Bug surface**: Off-by-1000 errors in backfill, chart rendering, record timestamps
4. **No single source of truth**: Logic scattered, hard to audit

## Solution: Timestamp Value Object

Replace scattered conversions with a strongly-typed `Timestamp` class:
- Wraps Unix seconds (UTC)
- Prevents ms/sec confusion through type system
- Centralizes conversion logic
- Single source of truth for all time operations

**Already implemented** (verified):
- `src/lib/timestamp.ts` — 112 lines, fully type-safe
- `src/lib/timestamp.test.ts` — 44/44 tests passing
- `TimeConverter.fromParts()` — UTC year/month/day/hour → Timestamp
- All arithmetic immutable (no mutation)

## Scope: What Changes

### Backend Integration (10-01)

**Files to modify**:
1. `src/types.ts` — Import Timestamp, update `Kline.open_time` type
2. `src/lib/db.ts` — Replace 3x `Math.floor(Date.now() / 1000)` with `Timestamp.now().toSeconds()`
3. `src/routes/klines.ts` — Use `Timestamp.fromMillis()` for query params
4. `src/lib/binance.ts` — Convert `Math.floor(raw[0] / 1000)` to `Timestamp.fromMillis(raw[0])`
5. `src/routes/admin.ts` — Use Timestamp for time arithmetic (if scope includes backfill cursor)

**Affected downstream** (must update if Kline.open_time type changes):
- `src/lib/kline-insert.ts` — expects `Kline.open_time` format
- `src/lib/binance.ts` — produces Kline instances
- `src/lib/validate.ts` — schema definitions
- `src/routes/admin.ts` — reads open_time as cursor
- `src/lib/binance.test.ts` — type assertions

### Frontend Integration (10-02)

**Files to modify**:
1. `public/js/charts.js` — Replace `Math.floor(startMs / 1000)`, `Math.floor(endMs / 1000)` at lines 95-96
2. `public/js/records.js` — Replace `Math.floor(Date.now() / 1000)` at line 124
3. `public/js/datetime.js` — Central utility holds `buildUtcEpoch()` that returns `Math.floor(Date.UTC(...) / 1000)` (line 42, used by both charts + records)

**Frontend Constraint** (locked decision from Phase 6):
- No build step, no bundler
- Pure static ESM served from Worker
- Lightweight Charts v5 from CDN
- Chart rendering uses numeric `time` field (must convert Timestamp.toMillis() for chart library)

**Challenge**: How does frontend import `Timestamp`?
- Option A: Duplicate `Timestamp` class in `public/js/timestamp.js` + consistency tests
- Option B: Add bundler (contradicts no-build-step constraint)
- Option C: Keep conversions in frontend, migrate only backend (partial solution)

## Locked Constraints

From earlier phases and PROJECT.md:
- **No build step**: Phase 6 SC4, PROJECT.md frontend section
- **Single source of truth**: Phase 10 goal itself
- **Type safety**: TypeScript strict mode enabled
- **D1 contract**: `open_time` stored as seconds (Unix seconds for efficiency)
- **API contract**: `/api/klines` wire format uses numeric timestamps

## Success Criteria (as-planned)

1. **SC1**: All backend time operations use Timestamp API (no `Math.floor(ms / 1000)`)
2. **SC2**: All frontend time operations use Timestamp API
3. **SC3**: Zero `Math.floor(ms / 1000)` in production code
4. **SC4**: Timestamp 44/44 unit tests pass (already true)
5. **SC5**: Code review approval, no HIGH issues

## Outstanding Decisions

### D1: Kline.open_time Type Boundary

**Current state**: `Kline.open_time` is `number` (Unix seconds)

**Options**:
- **Option A** (full): Change to `Timestamp` type throughout (binance.ts producer → kline-insert → D1 storage → charts/admin consumers)
  - Pro: Type safety end-to-end, prevents future ms/sec bugs
  - Con: Ripples to 5+ untasked files, requires serialization decision for wire/DB format
  - Con: `Timestamp` instances don't JSON.stringify as plain numbers
  
- **Option B** (boundaries only): Keep `Kline.open_time: number`, convert at request/function entry points
  - Pro: Minimal ripple (binance.ts input, klines.ts query params, admin.ts cursor, charts.js toCandle)
  - Con: Type safety only at edges, not at the core domain model
  - Con: DB/API contracts stay unchanged (lower risk)

### D2: Frontend Timestamp Access

**Current state**: No Timestamp in frontend; all conversions inline

**Options**:
- **Option A** (duplicate): `public/js/timestamp.js` as plain-ESM reimplementation
  - Pro: No build step, no bundler needed
  - Pro: Consistency tests can verify parity with `src/lib/timestamp.ts`
  - Con: Manual sync required; two source-of-truth definitions
  
- **Option B** (bundler): Add build step to compile `src/lib/timestamp.ts` for browser
  - Pro: Single source of truth (import from src)
  - Con: Violates locked no-build-step constraint (Phase 6, PROJECT.md)
  - Con: Adds complexity to static asset pipeline
  
- **Option C** (hybrid): Keep datetime.js as is, convert only charts.js/records.js locally
  - Pro: Minimal change
  - Con: Partial solution, doesn't address datetime.js:42 scattered conversion

## Risk Assessment

**High Risk**:
- Kline.open_time type change ripples to untouched files (B3 in plan check)
- Frontend mechanism unresolved, conflicts with locked decisions (B2)
- Conversion inventory incomplete (B1, 3 sites unaccounted)

**Medium Risk**:
- Code review gate (SC5) not scoped as a task
- No typecheck step for type-heavy changes
- Backward-compatibility claim needs verification

**Low Risk**:
- Timestamp class already implemented + fully tested
- Line numbers verified accurate
- Immutability guaranteed by class design

## Recommendation for Plan Revision

Before execution, decide:
1. **Kline.open_time scope**: Full type change (enumerate all ripples) or boundaries-only (keep wire/DB contracts)
2. **Frontend mechanism**: Duplicate (plain ESM) or add build step (re-decide constraint)
3. **Conversion inventory**: Expand to verified grep list (binance.ts, datetime.js, charts.js:96)
4. **Verification**: Add `npm run typecheck` + concrete grep command

---

**Context created**: 2026-09-01  
**Timestamp class status**: ✅ Implemented + tested (44/44)  
**Plan check status**: 4 blockers found; revision recommended before execution
