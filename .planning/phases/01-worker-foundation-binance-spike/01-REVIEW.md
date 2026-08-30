---
phase: 01-worker-foundation-binance-spike
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - .github/workflows/fetch-binance.yml
  - .gitignore
  - migrations/0001_create_klines.sql
  - migrations/0002_create_divergence_records.sql
  - migrations/0003_create_backfill_state.sql
  - package.json
  - public/index.html
  - scripts/backfill-fetcher.mts
  - scripts/tsconfig.json
  - src/index.ts
  - src/lib/backoff.test.ts
  - src/lib/backoff.ts
  - src/lib/binance.test.ts
  - src/lib/binance.ts
  - src/lib/db.ts
  - src/lib/kline-insert.test.ts
  - src/lib/kline-insert.ts
  - src/lib/response.ts
  - src/routes/admin.ts
  - src/routes/klines.ts
  - src/routes/records.ts
  - src/types.ts
  - tsconfig.json
  - wrangler.jsonc
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 1 establishes the Worker foundation with D1 schema, Binance client, and REST routes. The implementation demonstrates solid architectural patterns (repository pattern, parameterized queries, Zod validation) and includes test coverage for core utilities. However, **one critical bug was found that breaks the klines query endpoint**, and several warnings indicate missing error handling and incomplete input validation.

The klines route accepts millisecond timestamps but queries a database that stores timestamps in seconds, causing all queries to return empty results. Additionally, multiple routes lack error handling for database failures, and the binance-spike endpoint does not validate symbol input before passing it to the Binance API.

## Critical Issues

### CR-01: Timestamp Unit Mismatch in Klines Query

**File:** `src/routes/klines.ts:8-22`

**Issue:** The klines route accepts `start` and `end` query parameters, converts them to numbers with variable names `startMs` and `endMs` (milliseconds), and passes them directly to `queryKlines()`. However, the database stores `open_time` in **seconds** (see `src/lib/binance.ts:17` where `parseKline` does `Math.floor(raw[0] / 1000)`). The SQL query then compares seconds to milliseconds:

```
WHERE open_time BETWEEN 1705334400000 AND 1705420800000  ← milliseconds
```

against

```
open_time = 1705334400  ← seconds (stored in DB)
```

This causes all klines queries to return empty result sets. The backfill script correctly assumes cursor is in seconds and converts to milliseconds, but the public klines endpoint does not perform the reverse conversion.

**Fix:**
```typescript
const startMs = Number(start);
const endMs = Number(end);
if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
  return jsonError('start and end must be numeric timestamps', 400);
}
// Convert milliseconds to seconds for database query
const startSec = Math.floor(startMs / 1000);
const endSec = Math.floor(endMs / 1000);
const rows = await queryKlines(c.env.DB, symbol, startSec, endSec);
return jsonOk(rows);
```

---

## Warnings

### WR-01: Missing Error Handling in Klines Route

**File:** `src/routes/klines.ts:8-22`

**Issue:** The route calls `queryKlines()` without try-catch. If the database query throws an error, the route will crash with an unhandled promise rejection. Database operations can fail due to connection issues, permission errors, or query errors.

**Fix:**
```typescript
try {
  const rows = await queryKlines(c.env.DB, symbol, startSec, endSec);
  return jsonOk(rows);
} catch (error) {
  console.error(`Database query failed: ${String(error)}`);
  return jsonError('Internal server error', 500);
}
```

---

### WR-02: Missing Error Handling in Records Routes

**File:** `src/routes/records.ts:9-49`

**Issue:** The GET route (line 10), POST route (line 25), and PUT route (line 44) all call database functions (`listRecords`, `createRecord`, `updateRecord`) without try-catch. Any database error will crash the route.

**Fix:** Wrap each database call in try-catch:
```typescript
records.get('/api/records', async (c) => {
  try {
    const rows = await listRecords(c.env.DB);
    return jsonOk(rows);
  } catch (error) {
    console.error(`Failed to list records: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

records.post('/api/records', async (c) => {
  // ... validation ...
  try {
    const row = await createRecord(c.env.DB, parsed.data);
    return jsonOk(row, 201);
  } catch (error) {
    console.error(`Failed to create record: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

records.put('/api/records/:id', async (c) => {
  // ... validation ...
  try {
    const row = await updateRecord(c.env.DB, id, parsed.data);
    if (!row) {
      return jsonError('Record not found', 404);
    }
    return jsonOk(row);
  } catch (error) {
    console.error(`Failed to update record: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});
```

---

### WR-03: Missing Error Handling in Admin Ingest Route

**File:** `src/routes/admin.ts:45-64`

**Issue:** The POST `/api/admin/ingest` route calls `insertKlinesBatch()` and `setBackfillCursor()` without try-catch (lines 60, 62). Database failures during bulk insert or cursor update will crash the route.

**Fix:**
```typescript
admin.post('/api/admin/ingest', async (c) => {
  const denied = auth(c, c.env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${validationMessage(parsed.error)}`, 400);
  }
  
  try {
    const { symbol, klines } = parsed.data;
    const res = await insertKlinesBatch(c.env.DB, symbol, klines);
    const cursor = klines[klines.length - 1].open_time;
    await setBackfillCursor(c.env.DB, symbol, cursor);
    return jsonOk({ inserted: res.inserted, skipped: res.skipped, cursor });
  } catch (error) {
    console.error(`Ingest failed: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});
```

---

### WR-04: Missing Symbol Validation in Binance Spike Endpoint

**File:** `src/routes/admin.ts:23-43`

**Issue:** The GET `/api/admin/binance-spike` endpoint accepts a `symbol` query parameter and passes it directly to `fetchKlines()` without validation:

```typescript
const symbol = c.req.query('symbol') ?? 'BTCUSDT';
const success = await attempt('https://api.binance.com', symbol, startTime);
```

An attacker could pass `symbol=BTCUSDT&foo=bar` to inject additional query parameters into the URL constructed in `binance.ts:37`:
```typescript
const url = `${host}/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}&startTime=${startTime}`;
```

While this endpoint is likely internal/admin, the lack of validation violates the principle of input validation at system boundaries.

**Fix:**
```typescript
const symbol = c.req.query('symbol') ?? 'BTCUSDT';
if (!['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
  return jsonError('Invalid symbol', 400);
}
```

---

### WR-05: Unsafe URL Construction in Binance Client

**File:** `src/lib/binance.ts:31-38`

**Issue:** The `fetchKlines()` function constructs a URL by string interpolation without encoding query parameters:

```typescript
const url = `${host}/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}&startTime=${startTime}`;
```

If `symbol` contains special characters (e.g., `&`, `?`, `#`), the URL will be malformed or unintended query parameters will be added. While the current code should only receive validated symbols, it's defensive to encode them.

**Fix:**
```typescript
const url = new URL(`${host}/api/v3/klines`);
url.searchParams.set('symbol', symbol);
url.searchParams.set('interval', '1h');
url.searchParams.set('limit', String(limit));
url.searchParams.set('startTime', String(startTime));
const response = await fetch(url.toString());
```

---

## Info

### IN-01: Unused Type Alias

**File:** `src/lib/db.ts:87`

**Issue:** The type alias `D1Env` is exported but never imported or used elsewhere in the codebase:

```typescript
export type D1Env = Env;
```

This adds unnecessary exports and cognitive overhead.

**Fix:** Remove the unused type alias, or document its purpose if it's intended for future use.

---

### IN-02: Type Assertion Too Narrow

**File:** `src/lib/db.ts:89-94`

**Issue:** The `getBackfillCursor()` function uses a type assertion that doesn't account for the null case:

```typescript
return db
  .prepare('SELECT cursor_open_time FROM backfill_state WHERE symbol = ?')
  .bind(symbol)
  .first<number>('cursor_open_time');
```

The D1 `.first()` method returns the value of the specified column, or `null` if no rows exist. The type `<number>` is too narrow; it should be `<number | null>`. This works at runtime due to JavaScript's loose typing, but TypeScript's type system expects `number`.

**Fix:**
```typescript
return db
  .prepare('SELECT cursor_open_time FROM backfill_state WHERE symbol = ?')
  .bind(symbol)
  .first<number | null>('cursor_open_time');
```

---

## Summary of Findings

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1     | Must fix before shipping |
| Warning  | 5     | Should fix for robustness |
| Info     | 2     | Nice to have |
| **Total**| **8** | **Issues found** |

The critical bug (klines query returning empty results) must be fixed before the endpoint is used. The warning-level issues (missing error handling, incomplete validation) should be addressed to improve reliability and security.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
