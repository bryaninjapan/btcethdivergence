---
phase: 2
title: "Kline Backfill Engine — Implementation Notes"
date: 2026-08-31
---

# Phase 2 Implementation Notes

Technical reference for the external-fetcher ingest pattern and chunking strategy.

---

## Chunked Insert Builder

### The Problem: Parameter Limits

D1/SQLite prepared statements have a limit of **32,767 bind parameters** in theory, but Wrangler (the D1 SDK) enforces practical limits:

- **100 bound parameters** per statement (hard)
- **40 statements** per `db.batch()` call (soft, avoids overwhelming Wrangler's queue)

A naive bulk insert fails:

```sql
-- WRONG: 1000 rows × 7 columns = 7000 params
INSERT INTO klines (...) VALUES (?, ?,...), (?, ?,...), ...[1000 times]...
-- Error: too many parameters
```

### The Solution: Chunk Into Batches

```typescript
// src/lib/kline-insert.ts
const ROWS_PER_STMT = 14;        // 14 × 7 = 98 params per stmt
const STMTS_PER_BATCH = 40;      // 40 × 14 = 560 rows per batch()

function* buildKlineInsertChunks(
  symbol: string,
  klines: BinanceKlineTuple[]
) {
  for (const chunk of chunkKlines(klines, ROWS_PER_STMT)) {
    const placeholders = chunk
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    
    const sql = `
      INSERT OR IGNORE INTO klines
      (symbol, open_time, open, high, low, close, volume, close_time)
      VALUES ${placeholders}
    `;
    
    const params = chunk.flatMap(row => [
      symbol,
      Math.floor(row[0] / 1000),  // open_time ms → s
      Number(row[1]),             // open
      Number(row[2]),             // high
      Number(row[3]),             // low
      Number(row[4]),             // close
      Number(row[5]),             // volume
      Math.floor(row[6] / 1000)   // close_time ms → s
    ]);
    
    yield { sql, params };
  }
}

// Usage: 1000 rows
// → 72 statements (chunk 1: 40 stmts, chunk 2: 32 stmts)
// → 2 db.batch() calls
```

### Proof of Chunking

```typescript
// src/lib/kline-insert.test.ts
it('chunks 1000 rows correctly', () => {
  const klines = generateTestKlines(1000);
  const stmts = Array.from(buildKlineInsertChunks('BTCUSDT', klines));
  
  expect(stmts.length).toBe(72);  // 1000 ÷ 14 ≈ 72
  expect(stmts[0].params.length).toBe(98);  // 14 rows × 7 cols
  expect(stmts[stmts.length - 1].params.length).toBe(42);  // tail: 6 rows × 7 cols
});

it('respects 100-parameter limit per statement', () => {
  const stmts = Array.from(buildKlineInsertChunks('BTCUSDT', generateTestKlines(1000)));
  for (const stmt of stmts) {
    expect(stmt.params.length).toBeLessThanOrEqual(100);
  }
});
```

---

## Cursor-Based Resumption

### Backfill State Table

```sql
CREATE TABLE backfill_state (
  symbol TEXT PRIMARY KEY,
  cursor_open_time INTEGER NOT NULL,
  updated_at INTEGER DEFAULT (CAST(julianday() * 86400000 AS INTEGER))
);
```

**How it works:**

1. **First run:**
   ```typescript
   const cursor = null;  // Undefined → Binance default (1-month ago)
   const klines = await fetchKlines(symbol, { startTime: cursor ? cursor + 3600 : undefined });
   ```

2. **Subsequent runs:**
   ```typescript
   const cursor = await db.getBackfillCursor('BTCUSDT');  // e.g., 1627473600
   const klines = await fetchKlines('BTCUSDT', { startTime: cursor + 3600 });
   // Fetches next hour onward
   ```

3. **After ingest:**
   ```typescript
   const lastCandle = klines[klines.length - 1];
   await db.setBackfillCursor('BTCUSDT', lastCandle.open_time);
   // Next run starts from here
   ```

### Upsert Pattern (Phase 2 & 3)

```typescript
// src/lib/db.ts
async function setBackfillCursor(
  db: D1Database,
  symbol: string,
  cursor_open_time: number
) {
  return await db.prepare(`
    INSERT INTO backfill_state (symbol, cursor_open_time, updated_at)
    VALUES (?, ?, CAST(julianday() * 86400000 AS INTEGER))
    ON CONFLICT(symbol) DO UPDATE SET
      cursor_open_time = excluded.cursor_open_time,
      updated_at = CAST(julianday() * 86400000 AS INTEGER)
  `).bind(symbol, cursor_open_time).run();
}
```

**Why ON CONFLICT:**
- Handles both insert (first run) and update (subsequent runs)
- No need to pre-check if the row exists
- Atomic: one round-trip

---

## Backoff & Retry Logic

### Decision Tree

```typescript
// src/lib/backoff.ts
export function decideBackoff(
  status: number,
  headers?: Record<string, string>
): { action: 'retry' | 'abort'; delayMs?: number } {
  // 429 = Too Many Requests → Honor Retry-After
  if (status === 429) {
    const retryAfter = headers?.['retry-after'];
    const delayMs = retryAfter 
      ? parseInt(retryAfter) * 1000  // API says wait X seconds
      : 60_000;                       // Default 60s floor
    return { action: 'retry', delayMs };
  }
  
  // 418 = I'm a teapot (Binance anti-bot detection)
  if (status === 418) {
    return { action: 'abort' };  // Don't retry; block is intentional
  }
  
  // 403/451 = Forbidden / Geo-blocked
  if (status === 403 || status === 451) {
    return { action: 'abort' };  // No retry possible
  }
  
  // Other errors: abort for safety
  return { action: 'abort' };
}
```

### Retry Loop

```typescript
// scripts/backfill-fetcher.mts
async function fetchWithBackoff(url: string, options: RequestInit) {
  let retries = 0;
  const MAX_RETRIES = 3;
  
  while (retries < MAX_RETRIES) {
    const res = await fetch(url, options);
    
    if (res.ok) return res;
    
    const decision = decideBackoff(res.status, Object.fromEntries(res.headers));
    if (decision.action === 'abort') {
      throw new Error(`Request failed with status ${res.status}`);
    }
    
    // Retry: wait before trying again
    const delay = decision.delayMs || 60_000;
    console.log(`[backoff] Waiting ${delay}ms before retry ${retries + 1}`);
    await sleep(delay);
    retries++;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## External Fetcher Script

### Architecture

```typescript
// scripts/backfill-fetcher.mts
import { parseRetryAfter, decideBackoff, sleep } from '../src/lib/backoff';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8788';
const INGEST_TOKEN = process.env.INGEST_TOKEN;
const SYMBOL = process.env.SYMBOL || 'BTCUSDT';

async function main() {
  // Step 1: Read current cursor from Worker
  const cursorRes = await fetch(
    `${WORKER_URL}/api/admin/backfill-cursor?symbol=${SYMBOL}`,
    { headers: { Authorization: `Bearer ${INGEST_TOKEN}` } }
  );
  const { cursor_open_time } = await cursorRes.json();
  
  // Step 2: Fetch from Binance
  const startTime = cursor_open_time ? cursor_open_time + 3600 : undefined;
  const klines = await fetchBinanceKlines(SYMBOL, { startTime });
  
  if (klines.length === 0) {
    console.log('reached now — backfill complete');
    process.exit(0);
  }
  
  // Step 3: POST to Worker
  const res = await fetch(`${WORKER_URL}/api/admin/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INGEST_TOKEN}`
    },
    body: JSON.stringify({ symbol: SYMBOL, klines })
  });
  
  const result = await res.json();
  console.log(`Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
}

main().catch(err => {
  console.error('Fetcher failed:', err.message);
  process.exit(1);
});
```

### GitHub Actions Dispatch Workflow

```yaml
# .github/workflows/fetch-binance.yml
name: 'Manual Binance Backfill'

on:
  workflow_dispatch:
    inputs:
      symbol:
        description: 'Symbol (BTCUSDT/ETHUSDT)'
        required: false
        default: 'BTCUSDT'
      start_time_override:
        description: 'Unix seconds to start from (optional)'
        required: false

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: |
          export WORKER_URL=${{ secrets.WORKER_URL }}
          export INGEST_TOKEN=${{ secrets.INGEST_TOKEN }}
          export SYMBOL=${{ inputs.symbol }}
          if [ ! -z "${{ inputs.start_time_override }}" ]; then
            export START_TIME_OVERRIDE=${{ inputs.start_time_override }}
          fi
          npx tsx scripts/backfill-fetcher.mts
```

---

## Testing the Chunking & Ingest

### Unit Test: Chunk Generation

```typescript
// src/lib/kline-insert.test.ts
it('generates correct chunk boundaries', () => {
  const klines = generateTestKlines(1000);
  const stmts = Array.from(buildKlineInsertChunks('BTCUSDT', klines));
  
  // Verify distribution
  const firstBatch = stmts.slice(0, 40);  // 40 stmts
  const secondBatch = stmts.slice(40);    // 32 stmts
  
  expect(firstBatch.every(s => s.params.length === 98)).toBe(true);
  expect(secondBatch[0].params.length).toBe(98);
  expect(secondBatch[secondBatch.length - 1].params.length).toBe(42);
});
```

### Integration Test: End-to-End Ingest

```typescript
// src/routes/admin.test.ts
it('ingests 1000 klines via POST /api/admin/ingest', async () => {
  const klines = generateTestKlines(1000);
  const res = await app.request(new Request(
    'http://localhost/api/admin/ingest',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INGEST_TOKEN}`
      },
      body: JSON.stringify({ symbol: 'BTCUSDT', klines })
    }
  ));
  
  const data = await res.json();
  expect(res.status).toBe(200);
  expect(data.inserted).toBe(1000);
  expect(data.skipped).toBe(0);
  
  // Verify DB state
  const count = await db.prepare('SELECT COUNT(*) as c FROM klines').first();
  expect(count.c).toBe(1000);
});
```

---

## Troubleshooting

### GitHub Runners Blocked (451)

**Root Cause:** Binance blocks Azure datacenter IPs (GitHub's infrastructure).

**Solution:** Run fetcher locally or use a self-hosted runner.

```bash
# Local machine fallback (Phase 3 uses launchd)
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts
```

### Cursor Reset for Clean Crawl

```bash
# Delete the cursor to start from Binance's default (1 month ago)
wrangler d1 execute --remote --command \
  "DELETE FROM backfill_state WHERE symbol='BTCUSDT'"

# Or set to a specific timestamp
wrangler d1 execute --remote --command \
  "UPDATE backfill_state SET cursor_open_time=1609459200 WHERE symbol='BTCUSDT'"
```

---

## Performance Notes

### Chunking Overhead
- Negligible: chunking happens in-memory
- No extra DB calls (one `db.batch()` for all stmts)
- Chunking is **faster** than naive approach (no parameter bloat)

### Deduplication via OR IGNORE
- **Efficient:** DB checks PK at insert time
- **Idempotent:** safe to re-run fetcher over same window
- **Trade-off:** Silent skips (logged, not returned as count)

---

**Last Updated:** 2026-08-31
