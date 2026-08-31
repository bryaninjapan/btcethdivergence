---
phase: 12
title: "Service Layer Pattern — Implementation Notes"
date: 2026-09-01
---

# Phase 12 Implementation Notes

Technical deep-dive for future maintainers and pattern extension.

---

## Error Translation Pattern (W1 Option A)

### Rationale

Services own `DatabaseError` translation because:

1. **Single Responsibility:** Services handle DB errors; routes handle HTTP formatting
2. **Centralized Logic:** All database-layer errors translated in one place (3 services)
3. **Substance to Services:** Records/Klines services gain real business logic (error handling)
4. **Contract Preservation:** DATABASE_ERROR code stays the same; clients unaffected

### Implementation

Each service wraps db calls in try-catch:

```typescript
async function createRecord(db: D1Database, input: CreateRecordInput): Promise<DivergenceRecord> {
  try {
    return await dbCreateRecord(db, input);
  } catch (error) {
    throw new DatabaseError('Failed to create record', { originalError: String(error) });
  }
}
```

**Key Points:**
- Raw D1 errors become `DatabaseError` with human-readable message
- `originalError` field captures root cause for logging
- Routes catch `DatabaseError` and respond with 500 DATABASE_ERROR

### Double-Wrap Fix

When service calls another service (e.g., `processIngest` → `setBackfillCursor`):

```typescript
// BEFORE (Bug)
catch (error) {
  throw new DatabaseError('Ingest failed', { originalError: String(error) });
  // If 'error' is already DatabaseError from setBackfillCursor,
  // this wraps it again, losing original message
}

// AFTER (Fixed)
catch (error) {
  if (error instanceof DatabaseError) throw error;  // Pass through
  throw new DatabaseError('Ingest failed', { originalError: String(error) });
}
```

This pattern applies **whenever services call other services**.

---

## Mock D1 Implementation

### Scope & Limitations

`test-db.ts` is a **SQL-aware in-memory mock** that handles:

✅ **Supported Operations:**
- `prepare(sql).bind(...args).all()` — SELECT with WHERE/LIKE filtering
- `prepare(sql).bind(...args).first()` — SELECT single row
- `prepare(sql).bind(...args).run()` — INSERT/UPDATE/DELETE
- `batch([prepared-statements])` — Batch operations
- `WHERE col = ?` equality filtering
- `WHERE col LIKE ? ESCAPE '\\'` escape-aware LIKE matching
- `WHERE col BETWEEN ? AND ?` range filtering
- `ORDER BY col DESC` sorting
- `INSERT ... RETURNING *` — return inserted/updated row
- `INSERT ... ON CONFLICT(pk) DO UPDATE` — upsert
- `INSERT OR IGNORE` — PK dedup

❌ **Not Supported:**
- JOIN operations
- Subqueries
- Window functions (ROW_NUMBER, RANK, etc.)
- LIMIT/OFFSET (future extension)
- COUNT(*) aggregates (future extension)

### Key Implementation Details

#### 1. Prepared Statement Format

D1.prepare() returns a prepared statement. When bound, it looks like:

```typescript
{
  sql: "INSERT INTO klines (symbol, open_time, ...) VALUES (?, ?, ...)",
  params: ["BTCUSDT", 1627473600000, ...]
}
```

Mock's `batch()` accepts an array of these bound objects:

```typescript
db.batch([
  db.prepare("INSERT INTO klines ...").bind("BTCUSDT", 1627473600000, ...),
  db.prepare("INSERT INTO klines ...").bind("BTCUSDT", 1627473700000, ...),
])
```

#### 2. WHERE Filtering

SQL query parsing is **regex-based, not a full parser**:

```typescript
// Example: WHERE type = ? AND tags LIKE ? ESCAPE '\\'
WHERE type = 'BTC'
  AND tags LIKE 'trend\\%' ESCAPE '\\'

// Extracted patterns:
// - type = ? → equality match on param[0]
// - tags LIKE ? ESCAPE '\\' → LIKE with escape on param[1]
```

**Escape Handling:**
- `LIKE '%text\\%text%' ESCAPE '\\'` matches strings with literal `%`
- Mock converts LIKE patterns to regex: `text\%text` → `/text%text/`

#### 3. INSERT-OR-IGNORE for PK Dedup

When batch-inserting klines with the same `(symbol, open_time)` PK:

```sql
INSERT OR IGNORE INTO klines (symbol, open_time, ...) VALUES (?, ?, ...)
```

Mock checks existing rows for matching PK; skips insert if found:

```typescript
if (existingRow && existingRow.symbol === symbol && existingRow.open_time === openTime) {
  skipped++;
  continue;  // Don't insert
}
```

#### 4. RETURNING Semantics

`INSERT ... RETURNING *` must return the inserted row:

```typescript
const row = { symbol, open_time, ..., id: generatedId };
this.rows.get('klines').push(row);
return { success: true, meta: { changes: 1 }, results: [row] };
```

#### 5. Upsert (ON CONFLICT)

```sql
INSERT INTO backfill_state (symbol, cursor_open_time)
VALUES (?, ?)
ON CONFLICT(symbol) DO UPDATE SET cursor_open_time = excluded.cursor_open_time
```

Mock finds existing row by symbol; updates in place:

```typescript
const existing = this.rows.get('backfill_state').find(r => r.symbol === symbol);
if (existing) {
  existing.cursor_open_time = newCursor;
  existing.updated_at = Date.now();
} else {
  this.rows.get('backfill_state').push({ symbol, cursor_open_time: newCursor, ... });
}
```

### Testing the Mock

`test-db.test.ts` covers:

```typescript
it('batch() executes prepared statements', async () => {
  const db = createMockD1Database();
  const result = await db.batch([
    db.prepare("INSERT INTO klines ...").bind(...),
    db.prepare("INSERT INTO klines ...").bind(...),
  ]);
  expect(result.meta.changes).toBe(2);
});

it('WHERE type = ? filters correctly', async () => {
  const db = createMockD1WithData({
    records: [
      { id: 1, type: 'BTC' },
      { id: 2, type: 'ETH' },
    ],
  });
  const rows = await db.prepare("SELECT * FROM records WHERE type = ?")
    .bind('BTC')
    .all();
  expect(rows.length).toBe(1);
  expect(rows[0].type).toBe('BTC');
});
```

---

## Route Refactoring Pattern

### Template for Thin Routes

```typescript
// BEFORE
export default router.post('/api/records', async (c) => {
  try {
    const body = await c.req.json();
    const input = createRecordSchema.parse(body);
    const record = await db.createRecord(c.env.DB, input);
    return c.json({ ok: true, data: record }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json({ ok: false, error: 'Validation failed' }, 400);
    }
    if (error instanceof DatabaseError) {
      return c.json({ ok: false, error: error.message }, 500);
    }
    return c.json({ ok: false, error: 'Internal error' }, 500);
  }
});

// AFTER
export default router.post('/api/records', async (c) => {
  const body = await c.req.json();
  const input = createRecordSchema.parse(body);  // Zod error propagates to middleware
  const record = await recordsService.createRecord(c.env.DB, input);  // Delegate
  return c.json({ ok: true, data: record }, 201);  // Format response
});
```

**Key Principles:**
1. **No business logic** — Service layer owns it
2. **No error translation** — Service layer owns it
3. **Only HTTP concerns:** Zod validation (route-layer), response formatting, auth checks

### Error Middleware (error-middleware.ts)

Handles all non-AppError exceptions and routes them to 500:

```typescript
if (error instanceof ZodError) {
  return c.json({ ok: false, error: 'Validation failed' }, 400);
}
if (error instanceof DatabaseError) {
  return c.json({ ok: false, error: error.message }, 500);
}
// Everything else → 500 INTERNAL_ERROR
return c.json({ ok: false, error: 'Internal error' }, 500);
```

Routes don't duplicate this; errors bubble up.

---

## Test Structure

### Service Test Pattern

```typescript
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { recordsService } from './records.service';
import { ErrorCode } from '../lib/errors';

describe('recordsService.createRecord', () => {
  // Happy path
  it('creates a new record and returns it', async () => {
    const db = createMockD1Database();
    const input = { start_time: 100, end_time: 200, type: 'BTC', tags: ['test'] };
    
    const record = await recordsService.createRecord(db as unknown as D1Database, input);
    
    expect(record).toMatchObject({ start_time: 100, end_time: 200 });
    expect(record.id).toBeGreaterThan(0);  // ID assigned
  });

  // Error case
  it('translates database failures into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('run');  // Next .run() call fails
    
    const input = { start_time: 100, end_time: 200, type: 'BTC', tags: [] };
    await expect(recordsService.createRecord(db as unknown as D1Database, input))
      .rejects.toMatchObject({
        code: ErrorCode.DATABASE_ERROR,
        message: expect.stringContaining('Failed to create record'),
      });
  });

  // State-based test (requires seeded data)
  it('creates record with seeded data present', async () => {
    const db = createMockD1WithData({
      records: [{ id: 1, start_time: 0, end_time: 50, type: 'BTC', tags: [] }],
    });
    
    const input = { start_time: 100, end_time: 200, type: 'ETH', tags: [] };
    const record = await recordsService.createRecord(db as unknown as D1Database, input);
    
    expect(record.id).toBe(2);  // Next ID
    expect(db.rowsOf('records')).toHaveLength(2);  // Now 2 records
  });
});
```

**Structure:**
1. **Setup** — `createMockD1Database()` or `createMockD1WithData({})`
2. **Act** — Call service function
3. **Assert** — Verify result, state, or error

### Route Integration Test Pattern

```typescript
import { app } from '../index';

describe('GET /api/records/:id', () => {
  it('returns 404 when record not found', async () => {
    const res = await app.request(new Request('http://localhost/api/records/999'));
    
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 200 with record when found', async () => {
    // Seed DB (via test helper) ...
    const res = await app.request(new Request('http://localhost/api/records/1'));
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(1);
  });
});
```

---

## Validation Strategy

### Rule: Single Layer (Routes Only)

✅ **Routes validate with Zod:**
```typescript
const input = createRecordSchema.parse(body);
await recordsService.createRecord(db, input);  // Service trusts input
```

❌ **Services don't re-validate:**
```typescript
// WRONG: Service shouldn't parse again
const input = createRecordSchema.parse(rawInput);

// RIGHT: Service assumes input is pre-validated by route
async function createRecord(db: D1Database, input: CreateRecordInput) {
  return await dbCreateRecord(db, input);  // Input already validated
}
```

**Rationale:**
- Validation is expensive; don't repeat it
- Routes are the system boundary; validate at boundary
- Services trust route layer

### Exception: Admin Routes

Admin routes have heavier validation (auth + Zod + manual checks):

```typescript
// Auth check (middleware)
if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);

// Zod validation (route layer)
const input = adminIngestSchema.parse(body);

// Manual validation (route layer, before service)
if (!validSymbols.includes(input.symbol)) {
  return c.json({ error: 'Invalid symbol' }, 400);
}

// Service (trusts all above)
const result = await adminService.processIngest(db, input.symbol, input.klines);
```

This is acceptable and documented (LEARNING.md, W7 deviations).

---

## Coverage Gaps & Future Work

### Known Gaps

| File | Coverage | Reason | Workaround |
|------|----------|--------|-----------|
| `public/js/charts.js` | 0% | LightweightCharts (CDN) can't run in jsdom | E2E Playwright test |
| `src/routes/error-middleware.ts` | ~75% | Some error paths hard to trigger in tests | Covered by integration tests |
| `src/lib/backoff.ts` | 81.81% | Edge cases in retry logic | Covered by binance.test.ts |

### Future Extensions

1. **Mock LIMIT/OFFSET** — If Phase 13 adds pagination
2. **COUNT(*) support** — If pagination needs row counts
3. **Multi-table JOIN** — If future phases query across tables
4. **Transaction support** — If atomic multi-table operations needed

Template in test-db.ts marked with `// L4:` comments.

---

## Performance Considerations

### Mock D1 Performance

Mock is **in-memory only** (no persistence). Performance is NOT representative of production D1:

| Operation | Mock | Real D1 |
|-----------|------|---------|
| Scan 1K rows with filter | <1ms | Network latency |
| Parse SQL WHERE | Regex-based | Optimized engine |
| Batch insert 100 rows | <5ms | Network latency + DB I/O |

**Use mock only for testing, not benchmarking.**

### Service Layer Overhead

Adding service layer introduces **negligible overhead** (one function call):

```typescript
// Before: route calls db directly
db.createRecord(db, input)  // ~0.1ms

// After: route calls service which calls db
recordsService.createRecord(db, input)
  → dbCreateRecord(db, input)  // ~0.1ms (same)
  + error translation overhead  // <0.05ms
  // Total: ~0.15ms (negligible)
```

---

## Debugging Tips

### Test Fails on Mock D1

1. **Check failNext() calls:**
   ```typescript
   db.failNext('run');  // Fails next .run() call
   db.failNext('all');  // Fails next .all() call
   db.failNext('batch'); // Fails next .batch() call
   ```

2. **Inspect rows after operation:**
   ```typescript
   const rows = db.rowsOf('tableName');
   console.log('Rows:', rows);
   ```

3. **Enable SQL logging:**
   ```typescript
   // In test-db.ts, add console.log to mutate() function
   // to see which SQL statements are executed
   ```

### Service Test Fails

1. **Check input is validated** (Zod schema must match input)
2. **Check mock data types match** (numbers vs strings)
3. **Check error instanceof** (DatabaseError vs raw Error)

### Route Integration Test Fails

1. **Check error middleware is in place**
2. **Check middleware runs before route handler**
3. **Check DatabaseError is caught by middleware**

---

## Checklist for Extending the Pattern

When adding a new service (Phase 13+):

- [ ] Create `src/services/newdomain.service.ts`
- [ ] Export namespace object: `export const newDomainService = { op1, op2, ... }`
- [ ] Each function catches raw errors and throws `DatabaseError`
- [ ] Create `src/services/newdomain.service.test.ts` with ≥3 happy-path tests
- [ ] Create ≥2 error tests (via `db.failNext()`)
- [ ] Refactor route to delegate: `await newDomainService.op(db, input)`
- [ ] Remove try-catch from route (error middleware handles it)
- [ ] Verify all tests pass: `npm test`
- [ ] Check coverage: `npm run test:coverage` (target ≥80%)

---

## References

- **PLAN.md** — High-level plan (6 tasks, 4.75 days)
- **LEARNING.md** — Execution learnings, refactor opportunities
- **README.md** — Quick start and overview
- **12-SUMMARY.md** — What was built (commits, file list)
- **VERIFICATION.md** — Verification checklist (all SC met)

---

**Last Updated:** 2026-09-01
