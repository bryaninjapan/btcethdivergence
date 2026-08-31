---
phase: 1
title: "Worker Foundation — Implementation Notes"
date: 2026-08-30
---

# Phase 1 Implementation Notes

Technical deep-dive for Phase 1 setup and future reference.

---

## Deployment Architecture

### Single Workers Project (Not Pages + Workers)

**Choice:** One Cloudflare Workers project (no Pages split).

```jsonc
// wrangler.jsonc
{
  "name": "btcethdivergence",
  "main": "src/index.ts",
  "assets": {
    "directory": "./public"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_id": "..."
    }
  ]
}
```

**Why:**
- Simpler: one `wrangler deploy` pushes both code and assets
- No Pages routing layer to manage
- Static assets delivered via ASSETS binding inline with API routes
- Single DNS entry

**Alternative (Rejected):** Pages project + separate Workers project
- More complex routing (Pages handles `/`, Workers handles `/api`)
- Two independent deployments
- More infrastructure to manage

### ASSETS Binding for Static Content

```typescript
// src/index.ts
const app = new Hono<{ Bindings: Env }>();

// All other routes...
app.all('*', (c) => c.notFound());  // 404 caught by response envelope
// Assets automatically served by ASSETS binding (before routes)
```

**How it works:**
- Cloudflare automatically serves files from `./public` directory
- Requests to `/index.html`, `/css/style.css`, `/js/api.js` return the files directly (200 with correct MIME types)
- No explicit route needed
- More efficient than route-based serving

---

## D1 Schema Design

### Table: klines

```sql
CREATE TABLE klines (
  symbol TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  close_time INTEGER NOT NULL,
  quote_asset_volume REAL NOT NULL,
  number_of_trades INTEGER NOT NULL,
  taker_buy_base_asset_volume REAL NOT NULL,
  taker_buy_quote_asset_volume REAL NOT NULL,
  PRIMARY KEY (symbol, open_time)
);

CREATE INDEX idx_klines_time ON klines(symbol, open_time DESC);
```

**Design Decisions:**

1. **Composite PK `(symbol, open_time)`:**
   - Ensures no duplicate candles per symbol
   - `open_time` is unix timestamp in seconds (Binance standard)
   - Natural for both range queries and deduplication

2. **Index `idx_klines_time`:**
   - Covers most queries: `WHERE symbol = ? ORDER BY open_time DESC LIMIT ?`
   - Improves range fetches: `WHERE symbol = ? AND open_time BETWEEN ? AND ?`
   - DESC for most-recent-first queries (Phase 6 charts, Phase 7 navigation)

3. **REAL for prices:**
   - Sufficient precision for USD prices (6 decimals covers cent-level accuracy)
   - Smaller than TEXT or INTEGER (no scaling needed)

### Table: divergence_records

```sql
CREATE TABLE divergence_records (
  id INTEGER PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  tags TEXT,
  created_at INTEGER DEFAULT (CAST(julianday() * 86400000 AS INTEGER)),
  updated_at INTEGER DEFAULT (CAST(julianday() * 86400000 AS INTEGER))
);

CREATE INDEX idx_records_time ON divergence_records(start_time DESC);
```

**Design Decisions:**

1. **Auto-incrementing `id`:**
   - Simple identifier for individual records
   - Allows PUT/DELETE operations

2. **Separate time columns (`start_time`, `end_time`):**
   - Enables range queries: `WHERE start_time BETWEEN ? AND ?`
   - Not unix seconds (milliseconds preferred for frontend Date objects)
   - Range validation in schema: `end_time > start_time`

3. **`type` as TEXT enum:**
   - Stored as string ("time_lag", "sentiment_divergence", etc.)
   - Validated by Zod on write (not DB-level CHECK constraint)
   - Easier to extend without migrations

4. **`tags` as delimited TEXT:**
   - Phase 5 adds filtering; stored as space-separated or JSON later
   - Phase 1 just stores as-is

5. **Timestamps (`created_at`, `updated_at`):**
   - Milliseconds since epoch (matching Binance kline open_time scale)
   - D1 default: `CAST(julianday() * 86400000 AS INTEGER)` → UTC milliseconds

---

## API Response Envelope

### Design Pattern

```typescript
// src/lib/response.ts
interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function jsonOk<T>(data: T, status: number = 200): Response {
  return c.json({ ok: true, data }, status);
}

export function jsonError(error: string, status: number = 500): Response {
  return c.json({ ok: false, error }, status);
}
```

**Why:**
- **Consistent branching:** Frontend always checks `if (data.ok)`
- **Error locality:** Frontend knows error is in `data.error`, never in HTTP status alone
- **Type-safe:** TypeScript enforces `data` OR `error`, not both
- **Extensible:** Can add `metadata`, `pagination` fields later without breaking envelope

### Implementation in Routes

```typescript
// Before
export default router.get('/api/records', async (c) => {
  try {
    const records = await db.listRecords(c.env.DB);
    return c.json(records);  // Leaky: might not have {ok}
  } catch (error) {
    return c.status(500).json({ error: String(error) });
  }
});

// After
export default router.get('/api/records', async (c) => {
  const records = await db.listRecords(c.env.DB);
  return jsonOk(records);
  // If error: middleware catches and returns jsonError
});
```

---

## Zod Validation Schema

### Design: Front-load Before DB

```typescript
// src/lib/validate.ts
export const createRecordSchema = z.object({
  start_time: z.number().int().min(0),
  end_time: z.number().int().min(0),
  type: z.enum(['time_lag', 'sentiment_divergence', 'structural']),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional()
}).refine(d => d.end_time > d.start_time, {
  message: "end_time must be > start_time",
  path: ["end_time"]
});
```

**Validation Points:**

1. **At route entry:** `safeParse(c.req.json())`
   - Catches: wrong types, missing required fields, invalid enum values
   - Returns: `{ ok: false, error: "..." }` before any DB call

2. **In schema refinements:**
   - Custom logic: `end_time > start_time`
   - Must-be-true invariants that can't express as simple constraints

3. **Never in DB layer:**
   - DB receives already-validated data
   - DB can assume invariants hold

**Result:**
```typescript
// Route
const input = createRecordSchema.parse(body);  // Throws on invalid
const record = await db.createRecord(db, input);  // Safe to call
```

---

## Binance API Spike

### Spike Objective
Determine if Binance klines are reachable from a deployed Cloudflare Worker.

### Implementation

```typescript
// src/lib/binance.ts
export async function fetchKlines(
  symbol: string,
  options: { startTime?: number; endTime?: number }
): Promise<BinanceKlineTuple[]> {
  const urls = [
    `https://api.binance.com/api/v3/klines?symbol=${symbol}...`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}...`
  ];

  for (const url of urls) {
    const res = await fetch(url);
    if (res.ok) return parseKlines(await res.json());
    if (res.status === 429 || res.status === 418) {
      throw new BinanceError(res.status, 'Rate limited or banned');
    }
  }
  throw new BinanceError(403, 'Both hosts blocked from Worker');
}

export function parseKline(kline: BinanceKlineTuple): Kline {
  const [openTime, open, high, low, close, volume, ...rest] = kline;
  return {
    open_time: Math.floor(openTime / 1000),  // ms → seconds
    open: Number(open),  // String → number
    high: Number(high),
    // ... etc
  };
}
```

### Findings

**Result:** Both `api.binance.com` and `data-api.binance.vision` return **403** from the deployed Worker.

```
Local machine:  curl → 200 OK
Worker:         curl → 403 Forbidden (Cloudflare IP block)
```

**Root Cause:** Cloudflare's IP range is geo-blocked or rate-limited by Binance.

### Decision: External-Fetcher Ingest Path

Since Binance is unreachable from the Worker, Phase 2 adopts:

```
GitHub Actions (or local machine) → fetch Binance → POST /api/admin/ingest → D1
```

**Benefits:**
- GitHub Actions runs on non-blocked IPs (usually)
- Scheduled job handles backfill independently
- Worker only stores and serves data

**Drawback:**
- Extra component to manage
- Fetcher must run outside the Worker

---

## Testing Strategy

### Unit Tests: binance.ts

```typescript
// src/lib/binance.test.ts
describe('parseKline', () => {
  it('converts tuple to Kline with seconds timestamp', () => {
    const raw = [1627473600000, '42000', '43000', '41000', '42500', '100', ...];
    const kline = parseKline(raw);
    expect(kline.open_time).toBe(1627473600);  // ms → s
    expect(kline.open).toBe(42000);  // String → number
  });

  it('handles numeric string coercion', () => {
    const raw = [1627473600000, '0.00001', ...];
    const kline = parseKline(raw);
    expect(kline.open).toBe(0.00001);  // Correct
  });
});
```

**Key Points:**
- Test data conversions (ms → s, string → number)
- Verify numeric precision is preserved
- Test error classification (429, 418, etc.)

### Integration: Routes

```typescript
// src/routes/admin.test.ts
describe('GET /api/admin/binance-spike', () => {
  it('returns 200 with kline count on success', async () => {
    // Mocked or real fetch
    const res = await app.request(new Request('http://localhost/api/admin/binance-spike'));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.data.count).toBeGreaterThanOrEqual(0);
  });

  it('returns 502 when both hosts block', async () => {
    // Mock fetch to always 403
    const res = await app.request(...);
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.ok).toBe(false);
  });
});
```

---

## Troubleshooting Guide

### D1 Migration Failures

**Symptom:** `wrangler d1 execute --remote` says "table klines already exists"

**Cause:** A prior partial deployment already applied migrations.

**Fix:**
```bash
# Check what's applied
wrangler d1 migrations list --remote

# If 0001/0002 already exist, manually mark them:
wrangler d1 execute --remote --command "INSERT INTO _cf_d1_migrations (name, status) VALUES ('0001_create_klines', 'applied')"

# Then continue with 0003+
```

### .dev.vars Not Loading

**Symptom:** `undefined` error when accessing `c.env.INGEST_TOKEN` locally

**Cause:** `.dev.vars` not in the same directory as `wrangler.toml` or `wrangler dev` wasn't restarted.

**Fix:**
```bash
# Create .dev.vars in project root
echo "INGEST_TOKEN=test_token" > .dev.vars
wrangler dev  # Restart
```

### ASSETS Binding 404

**Symptom:** `curl /css/style.css` returns 404

**Cause:** File not in `./public/` or path wrong.

**Fix:**
```bash
# Check what's in public/
ls -la public/

# Ensure wrangler.jsonc has correct directory
cat wrangler.jsonc | grep -A2 '"assets"'
# Should show: "directory": "./public"

# Redeploy
wrangler deploy
```

---

## Future Extensions

1. **Phase 2:** Add `/api/admin/ingest` endpoint (Bearer token auth)
2. **Phase 3:** Set up GitHub Actions workflow for scheduled fetches
3. **Phase 4+:** Frontend routes using klines data

---

**Last Updated:** 2026-08-30
