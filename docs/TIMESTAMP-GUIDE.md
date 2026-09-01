# TemporalConverter Guide

The single source of truth for millisecond/second and Date/second time
conversions in the BTC/ETH Divergence Tracker backend.

- Module: `src/domains/temporal-api.ts`
- Class: `TemporalConverter` (static, pure — never instantiated)
- Tests: `src/domains/temporal-api.test.ts` (36 boundary + batch cases)

---

## 1. Why TemporalConverter Matters

BTC/ETH data flows across two time domains with different native units:

- **Binance API** and the **browser** talk in **milliseconds** (epoch ms).
- **D1 columns** (`klines.open_time`, `divergence_records.start_time` /
  `end_time`, `backfill_state.cursor_open_time`, `created_at`, `updated_at`)
  are stored as **whole unix seconds**.

Historically every module that crossed that boundary inlined its own
`Math.floor(ms / 1000)` or `Timestamp.fromMillis(ms).toSeconds()`. That
scattered logic caused real unit-mix bugs — a "seconds" value occasionally
fed where milliseconds were expected (and vice versa), which silently shifted
records or queries by a factor of 1000 (e.g. year 1970 instead of 2026).

`TemporalConverter` centralizes the conversion so the **boundary semantics
live in exactly one place**, with one non-negotiable invariant:

> All timestamps are non-negative whole seconds (UTC).

Negative input throws `TimestampError` rather than silently producing a
negative "second" that could poison a D1 `BETWEEN` range query or a record's
`start_time`.

### Relation to the `Timestamp` class

- `Timestamp` (`src/lib/timestamp.ts`) is the **strongly-typed domain value**
  that wraps a seconds value and offers `toSeconds()`, `toMillis()`,
  `toDate()`, `plus/minus`, comparisons, and UTC parts.
- `TemporalConverter` is the **raw conversion utility** (plain numbers in,
  plain numbers out) used at parse/query boundaries before a value becomes a
  `Timestamp` or is handed to D1/Binance.

Use `Timestamp` when you need a typed value with methods; use
`TemporalConverter` when you just need a unit conversion at an edge.

---

## 2. TemporalConverter API Reference

All methods are `static`. They are pure (no instance state).

### `msToSec(ms: number): number`

Convert milliseconds to whole seconds (floor division).

| Param | Type | Notes |
|-------|------|-------|
| `ms` | `number` | Millisecond timestamp, non-negative |

**Returns**: whole seconds. **Throws**: `TimestampError` if `ms < 0`.

```ts
TemporalConverter.msToSec(1500); // 1
TemporalConverter.msToSec(0);    // 0
TemporalConverter.msToSec(999);  // 0  (floored)
```

### `secToMs(sec: number): number`

Convert whole seconds to milliseconds.

| Param | Type | Notes |
|-------|------|-------|
| `sec` | `number` | Second timestamp, non-negative |

**Returns**: milliseconds. **Throws**: `TimestampError` if `sec < 0`.

```ts
TemporalConverter.secToMs(1); // 1000
```

### `dateToSec(date: Date): number`

Convert a `Date` to whole unix seconds (UTC).

| Param | Type | Notes |
|-------|------|-------|
| `date` | `Date` | Any JS `Date` |

**Returns**: whole seconds. **Throws**: `TimestampError` if the date is
before the epoch (negative seconds).

```ts
TemporalConverter.dateToSec(new Date('2021-01-01T00:00:00Z')); // 1609459200
```

### `secToDate(sec: number): Date`

Convert whole unix seconds back to a UTC `Date`.

| Param | Type | Notes |
|-------|------|-------|
| `sec` | `number` | Second timestamp, non-negative |

**Returns**: `Date`. **Throws**: `TimestampError` if `sec < 0`.

```ts
TemporalConverter.secToDate(1609459200).toISOString(); // '2021-01-01T00:00:00.000Z'
```

### `convertBatch(millis: number[]): number[]`

Convert an array of millisecond timestamps to seconds in one pass.

**Returns**: array of whole seconds, same length/order. **Throws**:
`TimestampError` if any element is negative.

```ts
TemporalConverter.convertBatch([1000, 2000, 3000]); // [1, 2, 3]
TemporalConverter.convertBatch([]);                 // []
```

### `convertDateBatch(dates: Date[]): number[]`

Convert an array of `Date` objects to whole unix seconds in one pass.

```ts
TemporalConverter.convertDateBatch([new Date('2021-01-01T00:00:00Z')]); // [1609459200]
```

---

## 3. Usage Patterns

### Binance kline parsing (`src/lib/binance.ts`)

Binance returns kline open times in milliseconds. Convert with `msToSec`:

```ts
open_time: TemporalConverter.msToSec(raw[0]),
```

### DB queries / record fields (seconds)

`queryKlines`, `createRecord`, `updateRecord`, `setBackfillCursor` all deal in
**seconds**. Create the current timestamp with `dateToSec(new Date())`:

```ts
const now = TemporalConverter.dateToSec(new Date());
```

`queryKlines` passes `start`/`end` through unchanged (they are already whole
seconds) — no conversion inside the DB layer.

### Route query-param conversion (`src/routes/klines.ts`)

The `/api/klines` endpoint receives `start`/`end` in milliseconds from the
frontend and converts them once at the boundary:

```ts
const startSec = TemporalConverter.msToSec(startMs);
const endSec = TemporalConverter.msToSec(endMs);
```

### Date creation

```ts
const d = TemporalConverter.secToDate(sec); // Date at UTC
```

---

## 4. Common Pitfalls

1. **Mixing units** — feeding milliseconds where seconds are expected (or
   vice versa) shifts data by 1000×. Decide the unit at the boundary and use
   the matching converter.
2. **Assuming local timezone** — `Date.getTime()` and the converters are
   timezone-agnostic (epoch-based UTC). Never add/subtract a local offset
   manually; `secToDate`/`dateToSec` are already UTC-correct.
3. **Precision loss** — `msToSec` floors, so `1500.5ms → 1s`. This is
   intentional and consistent (see the round-trip test). Don't add rounding
   that would make `secToMs(msToSec(x))` inconsistent.
4. **Negative input** — always handled by throwing `TimestampError`. Validate
   user input (e.g. the `>= 0` guard in `klines.ts`) before converting, or
   catch the error.
5. **Binance `startTime` is milliseconds** — `admin.ts` probes Binance with
   `Date.now() - 2h` which **must stay in ms**. Do not apply `msToSec` there
   (a regression test guards this).

---

## 5. Migration from Math.floor

**Before** (scattered, easy to get wrong):

```ts
// binance.ts
open_time: Timestamp.fromMillis(raw[0]).toSeconds(),
// klines.ts
const startSec = Timestamp.fromMillis(startMs).toSeconds();
// db.ts
const now = Timestamp.now().toSeconds();
```

**After** (centralized, one source of truth):

```ts
// binance.ts
open_time: TemporalConverter.msToSec(raw[0]),
// klines.ts
const startSec = TemporalConverter.msToSec(startMs);
// db.ts
const now = TemporalConverter.dateToSec(new Date());
```

---

## 6. Divergence Type Pattern

The divergence **types** follow the same single-source-of-truth philosophy as
time conversions:

- **Backend SSoT**: `src/domains/divergence.ts` defines `DIVERGENCE_TYPES`
  and `TYPE_LABELS` (plus `MSB_LABELS` and the `DivergenceType` type).
- **Frontend mirror**: `public/js/divergence.js` mirrors the same constants
  for the browser (no build step).
- **Sync guard**: `src/domains/divergence.test.ts` asserts the two stay in
  lockstep byte-for-byte, so a one-sided edit fails CI/tests immediately.
- **Runtime generation**: `public/index.html` no longer hardcodes divergence
  strings; `records.js` builds the filter `<select>` and dialog radios from
  `DIVERGENCE_TYPES` / `TYPE_LABELS` at page load.

This means adding a divergence type requires editing exactly two files
(backend + frontend mirror); the sync test and runtime generation prevent any
third place from drifting.

---

*Last updated: 2026-09-02 (Phase 14)*
