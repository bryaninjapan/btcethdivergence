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

## Scope: What Changes (Per Decision D1 Option B + D2 Option A)

### Backend Integration (10-01) — Boundaries Only

**Files to modify**:
1. `src/lib/db.ts` (3 lines: 51, 89, 124) — Replace `Math.floor(Date.now() / 1000)` with `Timestamp.now().toSeconds()`
2. `src/lib/binance.ts:17` — Replace `Math.floor(raw[0] / 1000)` with `Timestamp.fromMillis(raw[0]).toSeconds()`
3. `src/routes/klines.ts:21` — Replace `Math.floor(startMs / 1000)` with `Timestamp.fromMillis(startMs).toSeconds()`
4. `src/routes/klines.ts:22` — Replace `Math.floor(endMs / 1000)` with `Timestamp.fromMillis(endMs).toSeconds()`

**Files NOT modified** (per D1 Option B):
- ~~`src/types.ts`~~ — `Kline.open_time` stays as `number` (no type change)
- ~~`src/lib/kline-insert.ts`~~ — No change needed
- ~~`src/lib/validate.ts`~~ — No change needed
- ~~`src/routes/admin.ts`~~ — No change needed for backfill cursor
- ~~`src/lib/binance.test.ts`~~ — No type assertions to update

**Internal storage**: Remains seconds (Unix seconds for efficiency)
**API contract**: `/api/klines` wire format unchanged (numeric timestamps in seconds)

### Frontend Integration (10-02) — Duplicate Timestamp Class

**Files to create**:
1. `public/js/timestamp.js` — NEW, plain ESM module mirroring src/lib/timestamp.ts API

**Files to modify**:
1. `public/js/charts.js:96` — Replace 2x `Math.floor(ms / 1000)` in setPickersFromMs function
2. `public/js/datetime.js:42` — Replace `Math.floor(Date.UTC(...) / 1000)` in buildUtcEpoch function
3. `public/js/records.js:124` — Replace `Math.floor(Date.now() / 1000)` when creating new record

**Frontend Constraint** (locked decision from Phase 6):
- No build step, no bundler — ✅ Satisfied (duplicate JS, not bundled)
- Pure static ESM served from Worker — ✅ Public/js stays static
- Lightweight Charts v5 from CDN — ✅ No change
- Chart rendering uses numeric `time` field — ✅ Timestamp.toSeconds() provides this

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

## Decisions Made

### D1: Kline.open_time Type Boundary ✅ RESOLVED
**Decision**: **Option B — Boundaries Only**

**Chosen at**: 2026-09-01 during plan revision

**Rationale**:
- Binance API returns timestamps in **milliseconds** (raw[0])
- Database stores **seconds** (existing wire/DB contract)
- Converting entire domain model to Timestamp type would ripple to 5+ untouched files
- Boundaries-only approach: Convert at API input/output points only, keep internal storage/types as seconds
- Minimal risk, minimal ripple: Only 3 backend sites affected (vs. 10+ with full type change)

**Implementation**:
- `src/lib/binance.ts:17`: Convert Binance API ms → sec via `Timestamp.fromMillis(raw[0]).toSeconds()`
- `src/routes/klines.ts:21-22`: Convert query param ms → sec via `Timestamp.fromMillis(...).toSeconds()`
- All downstream files (types.ts, kline-insert.ts, etc.) unchanged; `Kline.open_time` stays as `number`

### D2: Frontend Timestamp Access ✅ RESOLVED
**Decision**: **Option A — Duplicate public/js/timestamp.js**

**Chosen at**: 2026-09-01 during plan revision

**Rationale**:
- Phase 6 constraint: No build step, no bundler (locked decision)
- Timestamp class is simple (112 lines) and can be safely duplicated
- Parity tests will verify frontend and backend implementations stay in sync
- No bundler complexity, maintains static ESM asset pipeline

**Implementation**:
- Create `public/js/timestamp.js` as plain ESM module, mirroring src/lib/timestamp.ts API
- Add parity tests to verify behavior consistency
- Update `public/js/charts.js` and `public/js/datetime.js` to import and use duplicated Timestamp class

## Risk Assessment (After Decision)

**✅ Resolved Risks**:
- ~~Kline.open_time type change ripples~~ — D1 Option B avoids full type change (only 3 boundary sites)
- ~~Frontend mechanism unresolved~~ — D2 Option A (duplicate JS) complies with no-build-step constraint
- ~~Conversion inventory incomplete~~ — All 5 sites identified and enumerated in PLAN.md

**Low Risk** (mitigated):
- Timestamp class already implemented + fully tested (44/44 passing)
- All conversion line numbers verified via grep
- Immutability guaranteed by class design
- Parity tests will verify frontend/backend consistency
- TypeScript strict mode will catch type errors (`npm run typecheck`)

**Contingency**:
- If Timestamp.toSeconds() call pattern becomes error-prone, grep verification catches remaining unconverted sites

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
