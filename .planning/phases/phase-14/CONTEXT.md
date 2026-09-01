# Phase 14: Context and Dependencies

## Background

The BTC/ETH Divergence Tracker accumulates time-series data (klines) and analyzes divergence patterns. Time-domain conversions are scattered throughout the codebase, leading to:

1. **Maintenance burden**: Each module implements its own `Math.floor(ms / 1000)` pattern
2. **Bug risk**: Easy to mix milliseconds and seconds accidentally
3. **Frontend/backend drift**: Hardcoded divergence-type strings in HTML vs. backend definitions
4. **Type fragility**: No central definition of valid divergence types

Phase 14 addresses these by consolidating temporal logic and unifying divergence definitions.

## Problem Statement

### Time-Domain Confusion
- Binance klines arrive in milliseconds (e.g., `1693526400000`)
- D1 database stores times in seconds (e.g., `1693526400`)
- Conversion formulas scattered: `Timestamp.fromMillis(x).toSeconds()`, `Math.floor(ms/1000)`
- Easy to pass milliseconds where seconds expected (and vice versa)

### Divergence Type Duplication
- Backend defines `DIVERGENCE_TYPES` in `src/domains/divergence.ts`
- Frontend hardcodes the same values in `public/index.html` (lines 27-30, 80-83)
- When backend types change, frontend easily falls out of sync
- No automated verification that they match

### Scope

Phase 14 specifically addresses:
- ✅ Centralize time-conversion logic (`TemporalConverter`)
- ✅ Unify divergence-type definitions (sync test)
- ✅ Remove hardcoded type strings from HTML (runtime generation)
- ✅ Document the architecture (TIMESTAMP-GUIDE.md)

Does NOT address:
- ❌ Timezone handling beyond UTC (may be Phase 15+)
- ❌ Distributed time-sync or NTP (infrastructure concern)
- ❌ Historical data reprocessing (data migration concern)

## Domain Constraints

### Time Units by Module

| Module | Stores | Consumes | Boundary |
|--------|--------|----------|----------|
| Binance | milliseconds | milliseconds | Raw API data |
| D1 Database | seconds | seconds | `created_at`, `updated_at`, `start_time`, `end_time` |
| Query params (HTTP) | milliseconds | milliseconds | User browser `Date.now()` |
| Admin spike probe | milliseconds | milliseconds | Binance API `startTime` |

**Rule**: Never pass milliseconds to a seconds-storage system, or vice versa.

### Divergence Types (4 combinations)

```
btc_hh_eth_lh  ← BTC High-High,  ETH Low-High   (BTC strength, ETH weakness)
btc_lh_eth_hh  ← BTC Low-High,   ETH High-High  (BTC weakness, ETH strength)
btc_ll_eth_hl  ← BTC Low-Low,    ETH High-Low   (BTC weakness, ETH strength)
btc_hl_eth_ll  ← BTC High-Low,   ETH Low-Low    (BTC strength, ETH weakness)
```

**Rule**: Always import `DIVERGENCE_TYPES` from the SSoT; never hardcode.

## Dependencies

### Upstream (Assumptions from Prior Phases)

1. **Phase 1-13**: Codebase established with:
   - `Timestamp` domain type (src/lib/timestamp.ts)
   - D1 database schema with second-precision time columns
   - Binance API integration (millisecond-precision klines)
   - Frontend form with divergence-type filter

2. **Language/Ecosystem**:
   - TypeScript 4.6+ with strict mode
   - Vitest for unit testing
   - D1 SQL database
   - ESM modules (import/export)

### Downstream (Assumptions for Phase 15+)

1. **Phase 15** (expected):
   - Query optimization using TemporalConverter (BETWEEN queries, index usage)
   - Possibly: Date-picker UI for time-range selection

2. **Phase 16-17** (expected):
   - Unified divergence-type rendering across UI
   - Time-series charting (may need batch conversions)
   - Admin tools (data cleanup, time-range analysis)

## Locked Decisions

These decisions are **not** re-examined in Phase 15+:

1. ✅ **TemporalConverter is a static utility** — Call sites assume `TemporalConverter.msToSec(x)`
2. ✅ **Negative input throws** — Callers must pre-validate or use guaranteed-safe sources
3. ✅ **Floor division** — No rounding; `999ms → 0sec`
4. ✅ **admin.ts:38 stays milliseconds** — Binance API contract; never convert
5. ✅ **Divergence types are 4 strings** — Not enums, not numbers, not objects
6. ✅ **Runtime HTML generation** — populateTypeOptions() is the source of truth

## ADR References

No formal ADRs created for this phase, but key decisions documented in:
- IMPLEMENTATION-NOTES.md (this directory)
- TIMESTAMP-GUIDE.md (docs/)
- 14-REVIEW.md (sign-off)

## Data Flow

### Kline Ingestion
```
Binance API
  ↓ (milliseconds)
parseKline(raw[0]) → TemporalConverter.msToSec()
  ↓ (seconds)
D1 insert (open_time)
```

### Query Processing
```
User query (JavaScript Date, milliseconds)
  ↓
klines route (startMs, endMs)
  ↓ TemporalConverter.msToSec()
D1 query (BETWEEN startSec AND endSec)
```

### UI Rendering
```
Page load
  ↓
records.js: populateTypeOptions()
  ↓ reads DIVERGENCE_TYPES
<select> + radio options populated
  ↓
User picks divergence type (e.g., 'btc_hh_eth_lh')
  ↓
Records filtered by type
```

## Risk Mitigation

### Risk: Regression in Spike Test
**Mitigation**: Regression test in `admin-spike-ingest.test.ts` asserts `startTime ≥ 1e12` (ms-scale)

### Risk: Frontend/Backend Divergence Type Drift
**Mitigation**: Automated sync test in `divergence.test.ts` (runs on every test suite)

### Risk: Hardcoded Strings Return in HTML
**Mitigation**: Grep gate in UAT + negative assertions in verification

### Risk: TypeScript Missed Errors
**Mitigation**: `allowJs: true` + type-checked tests for both domains

## Testing Assumptions

1. **D1 database returns seconds** for all time columns
2. **Binance API sends milliseconds** in kline tuples
3. **Browser's `Date.now()` returns milliseconds**
4. **HTTP query params are sent/parsed as JavaScript numbers**

All tests assume these; if any changes, Phase 14 tests will fail fast.

## Performance Considerations

### TemporalConverter
- Pure function; no allocation per call
- `Math.floor(ms / 1000)` is ~1 nanosecond
- 100K calls complete in <500ms (incl. function call overhead)
- No bottleneck for typical usage

### runtime option generation
- Runs once at page load
- 4 `createElement` + `append` calls
- <10ms (negligible)
- Cached in DOM; no re-runs

### Sync test
- Runs with every test suite
- Simple array equality comparison
- <1ms
- No performance impact

## Future Extensibility

### Adding More Time Conversions
If new conversion types are needed (e.g., Unix timestamps to ISO strings):
1. Add method to `TemporalConverter`
2. Implement with same negative-input validation
3. Add unit tests (boundaries, round-trip)
4. Document in TIMESTAMP-GUIDE.md

### Adding More Divergence Types
If trading patterns need new divergence classifications:
1. Add string to `DIVERGENCE_TYPES` array in both backend + frontend
2. Add label to `TYPE_LABELS`
3. Sync test will fail until both files match (good signal)
4. Update frontend UI (already uses runtime generation, so auto-picks up)

### Timezone Support
If timezone-aware conversions are needed:
1. New methods in TemporalConverter (e.g., `dateToSecInTZ`)
2. Keep UTC-based methods unchanged
3. New tests for timezone boundaries (DST, etc.)
4. Document carefully (timezone bugs are common)

## Glossary

| Term | Definition |
|------|-----------|
| **TemporalConverter** | Static utility class for ms↔s and Date↔s conversions |
| **DivergenceType** | Union type: `'btc_hh_eth_lh' \| 'btc_lh_eth_hh' \| ...` (4 values) |
| **SSoT** | Single Source of Truth (DIVERGENCE_TYPES in src/domains/) |
| **D1** | Cloudflare's SQLite database |
| **Kline** | Candlestick data (OHLCV: open, high, low, close, volume) |
| **Binance API** | Cryptocurrency exchange; source of kline data |
| **Floor division** | `Math.floor(a / b)` — truncates remainder (no rounding) |
| **Regression test** | Test that ensures a bug doesn't resurface |
| **Sync test** | Test that verifies two systems stay in sync |
