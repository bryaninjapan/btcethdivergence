# BTC/ETH Divergence Analysis Tool — Implementation Plan

## Project Overview

A private trading analysis website for recording and analyzing BTC/ETH price divergence events, with a standalone leverage calculator.

**Owner**: Single user, private use only.
**Access**: Password-protected via Cloudflare Access.
**Frontend**: Static HTML/CSS/JS (generated via Google AI Studio, integrated manually).
**Backend**: Cloudflare Workers + D1.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Cloudflare                       │
│                                                   │
│  ┌───────────────┐   ┌──────────────────────┐   │
│  │ Pages (Static) │   │ Workers (API)         │   │
│  │                │   │                        │   │
│  │ index.html     │──▶│ GET  /api/klines      │   │
│  │ records.html   │   │ GET  /api/records      │   │
│  │ calculator.html│   │ POST /api/records      │   │
│  │ js/ css/       │   │ PUT  /api/records/:id  │   │
│  │                │   │ DELETE /api/records/:id │   │
│  └───────────────┘   │                        │   │
│                       │ Cron: fetch new klines  │   │
│                       └──────────┬─────────────┘   │
│                                  │                  │
│                       ┌──────────▼─────────────┐   │
│                       │ D1 Database             │   │
│                       │                        │   │
│                       │ ├── klines             │   │
│                       │ └── divergence_records │   │
│                       └────────────────────────┘   │
│                                                   │
│  ┌───────────────┐                                │
│  │ Cloudflare     │ ← password gate               │
│  │ Access         │                                │
│  └───────────────┘                                │
└─────────────────────────────────────────────────┘

External data source: Binance API (https://api.binance.com)
```

---

## Database Schema (D1 / SQLite)

### Table: `klines`

Stores 1-hour candlestick data for BTCUSDT and ETHUSDT.

```sql
CREATE TABLE klines (
  symbol    TEXT    NOT NULL,  -- 'BTCUSDT' or 'ETHUSDT'
  open_time INTEGER NOT NULL,  -- Unix timestamp in seconds (candle open time)
  open      REAL    NOT NULL,
  high      REAL    NOT NULL,
  low       REAL    NOT NULL,
  close     REAL    NOT NULL,
  volume    REAL    NOT NULL,
  PRIMARY KEY (symbol, open_time)
);

CREATE INDEX idx_klines_time ON klines (open_time);
```

**Data volume**: ~87,600 rows (2 symbols × ~43,800 hourly candles from 2021-01 to 2026-08).

**Data source**: Binance REST API.
```
GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000&startTime=...
```
Response array format: `[openTime, open, high, low, close, volume, closeTime, ...]`

**Note**: Only the `1h` interval is stored. No 4h data. No aggregation.

### Table: `divergence_records`

User-created records marking periods where BTC and ETH prices moved out of sync.

```sql
CREATE TABLE divergence_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time  INTEGER NOT NULL,  -- Unix timestamp in seconds
  end_time    INTEGER NOT NULL,  -- Unix timestamp in seconds
  type        TEXT    NOT NULL,  -- 'time_lag' | 'structural' | 'opposite'
  notes       TEXT    DEFAULT '',
  tags        TEXT    DEFAULT '', -- comma-separated, e.g. 'bearish,btc-lead'
  created_at  INTEGER NOT NULL,  -- Unix timestamp
  updated_at  INTEGER NOT NULL   -- Unix timestamp
);

CREATE INDEX idx_records_time ON divergence_records (start_time, end_time);
```

**Divergence types explained**:
- `time_lag`: BTC moved but ETH hasn't followed yet (or vice versa)
- `structural`: BTC made a higher high but ETH made a lower high (structural divergence)
- `opposite`: BTC and ETH moved in completely opposite directions

---

## API Endpoints (Cloudflare Workers)

### Base URL
```
https://<project-name>.pages.dev/api/
```

All responses use JSON envelope format:
```json
{
  "ok": true,
  "data": { ... }
}
```
Error format:
```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

### GET /api/klines

Fetch cached kline data from D1.

**Query params**:
| Param    | Type   | Required | Description                        |
|----------|--------|----------|------------------------------------|
| symbol   | string | yes      | `BTCUSDT` or `ETHUSDT`             |
| start    | number | yes      | Start time (unix seconds)          |
| end      | number | yes      | End time (unix seconds)            |

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "open_time": 1705334400,
      "open": 42000.5,
      "high": 42300.0,
      "low": 41900.0,
      "close": 42100.0,
      "volume": 1234.56
    }
  ]
}
```

**Notes**:
- Returns data sorted by `open_time` ascending.
- If requested range has gaps (not yet fetched), returns what's available. Frontend should show a warning if data seems incomplete.

### GET /api/records

List all divergence records, newest first.

**Query params** (all optional):
| Param  | Type   | Description                            |
|--------|--------|----------------------------------------|
| type   | string | Filter by divergence type              |
| tag    | string | Filter by tag (partial match)          |
| limit  | number | Max results (default 100)              |
| offset | number | Pagination offset (default 0)          |

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "start_time": 1705334400,
      "end_time": 1705420800,
      "type": "structural",
      "notes": "BTC higher high, ETH lower high",
      "tags": "bearish,btc-lead",
      "created_at": 1705507200,
      "updated_at": 1705507200
    }
  ],
  "total": 42
}
```

### POST /api/records

Create a new divergence record.

**Request body**:
```json
{
  "start_time": 1705334400,
  "end_time": 1705420800,
  "type": "structural",
  "notes": "BTC higher high, ETH lower high",
  "tags": "bearish,btc-lead"
}
```

**Validation**:
- `start_time` < `end_time`
- `type` must be one of: `time_lag`, `structural`, `opposite`
- `notes` max 1000 characters
- `tags` max 200 characters

### PUT /api/records/:id

Update an existing record. Request body same as POST (partial update allowed).

### DELETE /api/records/:id

Delete a record. Returns `{ "ok": true }`.

---

## Cron Worker: Daily Kline Sync

**Schedule**: Once per day (e.g., `0 1 * * *` — 01:00 UTC daily).

**Logic**:
```
For each symbol in ['BTCUSDT', 'ETHUSDT']:
  1. Query D1: SELECT MAX(open_time) FROM klines WHERE symbol = ?
  2. If no data exists, start from 2021-01-01 00:00:00 UTC
  3. Fetch from Binance API in batches of 1000 candles:
     GET /api/v3/klines?symbol=...&interval=1h&startTime=...&limit=1000
  4. Insert into D1 (INSERT OR IGNORE to skip duplicates)
  5. Repeat until caught up to current time
```

**Binance API limits**:
- 1200 requests/minute (IP-based, no API key needed for public klines)
- Max 1000 candles per request
- Initial backfill (2021-2026, ~43,800 candles per symbol) = ~44 requests per symbol = ~88 total

**Error handling**:
- If Binance returns 429 (rate limit), wait 60 seconds and retry
- If Binance returns error, log and skip (retry next day)
- Cron should complete within Cloudflare Workers CPU time limits (30s for cron triggers on free plan, 15min on paid)

**Initial backfill**: Run manually once (or via a dedicated endpoint `POST /api/admin/backfill`) to populate 2021-2026 historical data before going live.

---

## Frontend Pages

### Page 1: Divergence Records Table (MVP — build first)

**URL**: `/` or `/records`

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│  BTC/ETH Divergence Tracker                      [+新增] │
├────────────────────────────────────────────────────────┤
│ 篩選: [全部▼ type] [標籤搜尋...]                       │
├──────┬───────────┬───────────┬──────────┬──────┬──────┤
│  #   │ 開始時間   │ 結束時間   │ 類型     │ 備註  │ 操作 │
├──────┼───────────┼───────────┼──────────┼──────┼──────┤
│  42  │ 2024-01-15│ 2024-01-16│ structural│ BTC..│ 📈🗑 │
│      │ 18:00     │ 04:00     │          │      │      │
├──────┼───────────┼───────────┼──────────┼──────┼──────┤
│  41  │ 2024-01-10│ 2024-01-11│ time_lag │ ETH..│ 📈🗑 │
│      │ 12:00     │ 20:00     │          │      │      │
└──────┴───────────┴───────────┴──────────┴──────┴──────┘
```

**[+新增] modal / form**:
```
開始時間: [2024▼] [01▼] [15▼] [18:00▼]
結束時間: [2024▼] [01▼] [16▼] [04:00▼]
類型:     ◉ time_lag  ○ structural  ○ opposite
備註:     [_________________________________]
標籤:     [_________________________________]
                              [取消] [儲存]
```

**Time input**: Dropdown selectors for year (2021-2026), month (01-12), day (01-31, adjusted per month), hour (00:00-23:00, hourly steps).

**Actions per row**:
- 📈 View Chart: navigates to chart page with `?start=...&end=...` pre-filled
- 🗑 Delete: confirm dialog, then `DELETE /api/records/:id`
- Click row to edit (opens same form as "新增", pre-filled)

### Page 2: Dual Kline Chart

**URL**: `/chart` or `/chart?start=...&end=...`

**Layout**:
```
┌────────────────────────────────────────────────┐
│  時間範圍: [start picker] — [end picker] [載入]  │
│  ☑ Log 縮放                                     │
├────────────────────────────────────────────────┤
│                                                │
│  BTCUSDT 1H                                    │
│  ┌──────────────────────────────────────────┐  │
│  │         candlestick chart                │  │
│  │         (scrollable, zoomable)           │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ETHUSDT 1H                                    │
│  ┌──────────────────────────────────────────┐  │
│  │         candlestick chart                │  │
│  │         (scrollable, zoomable)           │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ⚡ Charts are time-synced:                    │
│    scrolling/zooming one moves both            │
└────────────────────────────────────────────────┘
```

**Chart library**: Lightweight Charts (https://github.com/nicklvsa/lightweight-charts or TradingView's lightweight-charts).

**Key behaviors**:
- Two charts stacked vertically (BTC on top, ETH below)
- Time axes are synced: scrolling or zooming one chart applies to both
- Log scale toggle (checkbox)
- When navigated from a record (via query params), auto-loads that time range with some padding (e.g., 24h before start, 24h after end)
- Candlestick colors: green (close > open), red (close < open)

### Page 3: Leverage Calculator

**URL**: `/calculator`

**Layout**:
```
┌──────────────────────────────────────────┐
│  100x Leverage Calculator (Full Margin)   │
├──────────────────────────────────────────┤
│                                          │
│  方向:  ◉ 做多 (Long)  ○ 做空 (Short)    │
│                                          │
│  保證金 (Margin):   [$1000        ]      │
│  開倉價 (Entry):    [$             ]      │
│  止損價 (Stop Loss): [$             ]      │
│  止盈價 (Take Profit):[$            ]      │
│  杠桿倍數 (Leverage): [100x  ▼]           │
│                                          │
│  [計算]                                  │
│                                          │
│  ════════════════════════════════════    │
│  名義價值:      $100,000                  │
│  ────────────────────────────────────    │
│  止損金額:      -$1,028.28               │
│  止盈金額:      +$899.74                  │
│  ────────────────────────────────────    │
│  盈虧比 (R:R):  1 : 0.875  ⚠️ 不理想     │
│  ────────────────────────────────────    │
│  止損收益率:    -102.8%                   │
│  止盈收益率:    +89.97%                   │
│  ════════════════════════════════════    │
│                                          │
└──────────────────────────────────────────┘
```

**Calculation logic**:
```javascript
function calculate({ direction, margin, entry, stopLoss, takeProfit, leverage }) {
  const positionSize = margin * leverage;

  let lossPoints, gainPoints;
  if (direction === 'long') {
    lossPoints = entry - stopLoss;   // positive = loss for long
    gainPoints = takeProfit - entry;  // positive = gain for long
  } else {
    lossPoints = stopLoss - entry;   // positive = loss for short
    gainPoints = entry - takeProfit;  // positive = gain for short
  }

  const stopLossAmount = (lossPoints / entry) * positionSize;
  const takeProfitAmount = (gainPoints / entry) * positionSize;
  const profitLossRatio = takeProfitAmount / stopLossAmount;
  const lossRate = (stopLossAmount / margin) * 100;
  const gainRate = (takeProfitAmount / margin) * 100;

  return {
    positionSize,
    stopLossAmount,
    takeProfitAmount,
    profitLossRatio,
    lossRate,
    gainRate
  };
}
```

**Notes**:
- Leverage dropdown: common values (1x, 2x, 3x, 5x, 10x, 20x, 25x, 50x, 75x, 100x, 125x)
- Calculator is purely client-side, no API calls needed
- R:R below 1.0 shows warning indicator

---

## File Structure

```
btcethdivergence/
├── .github/
│   └── (no CI needed — Cloudflare Pages auto-deploys from repo)
│
├── src/
│   └── worker/
│       ├── index.ts          # Workers entry point, router
│       ├── routes/
│       │   ├── klines.ts     # GET /api/klines
│       │   └── records.ts    # CRUD /api/records
│       ├── cron/
│       │   └── sync-klines.ts # Daily kline fetch logic
│       ├── lib/
│       │   ├── binance.ts    # Binance API client
│       │   └── db.ts         # D1 query helpers
│       └── schema.sql        # D1 table definitions
│
├── public/                   # Static frontend (served by Pages)
│   ├── index.html            # Records table page
│   ├── chart.html            # Dual kline chart page
│   ├── calculator.html       # Leverage calculator page
│   ├── js/
│   │   ├── records.js        # Records table logic
│   │   ├── chart.js          # Chart rendering logic
│   │   ├── calculator.js     # Calculator logic
│   │   └── api.js            # API client helper
│   └── css/
│       └── style.css         # All styles
│
├── wrangler.toml             # Cloudflare config (Pages, D1 binding, cron)
├── package.json
└── PLAN.md                   # This file
```

---

## Implementation Phases

### Phase 1: Backend Foundation
**Goal**: D1 database + Workers API + Cron, fully functional.

Tasks:
1. Initialize project: `npm create cloudflare`, configure `wrangler.toml`
2. Create D1 database, run `schema.sql`
3. Implement Workers API routes:
   - `GET /api/klines` (query D1 by symbol + time range)
   - `CRUD /api/records` (all 4 endpoints)
4. Implement Binance API client (`lib/binance.ts`)
5. Implement cron sync logic (`cron/sync-klines.ts`)
6. Run initial backfill: fetch all 1h klines from 2021-01-01 to today
7. Test all endpoints via curl / Postman
8. Deploy to Cloudflare

**Deliverable**: Working API at `https://<project>.pages.dev/api/`

### Phase 2: Records Table (Frontend MVP)
**Goal**: Usable records page — view, create, edit, delete divergence records.

Tasks:
1. Build `index.html` with records table
2. Implement dropdown time picker component (year/month/day/hour)
3. Create/edit form with type radio buttons, notes, tags fields
4. Wire up to `GET/POST/PUT/DELETE /api/records`
5. Add filter by type and tag search
6. Add "View Chart" link per row (navigates to `/chart?start=...&end=...`)

**Deliverable**: Fully functional records management page.

### Phase 3: Dual Kline Chart
**Goal**: Side-by-side (stacked) BTC + ETH 1h candlestick charts.

Tasks:
1. Integrate Lightweight Charts library
2. Build `chart.html` with two chart containers (BTC top, ETH bottom)
3. Implement time-sync between charts (scroll/zoom one moves both)
4. Add log scale toggle
5. Add time range picker, wire to `GET /api/klines`
6. Handle deep links from records table (`?start=...&end=...`)

**Deliverable**: Interactive synced dual charts.

### Phase 4: Leverage Calculator
**Goal**: Standalone calculator page.

Tasks:
1. Build `calculator.html` with form inputs
2. Implement calculation logic (pure client-side JS)
3. Add leverage dropdown with common values
4. Display results with R:R ratio and warning indicators
5. Long/short direction toggle

**Deliverable**: Working calculator, no backend needed.

### Phase 5: Polish & Deploy
**Goal**: Password protection, final touches.

Tasks:
1. Set up Cloudflare Access (password or email OTP)
2. Navigation between pages (simple nav bar)
3. Mobile responsiveness (basic)
4. Dark theme (trading tools should be dark)
5. Final deploy and verify

---

## Key Technical Decisions (Locked)

| Decision               | Choice                          | Rationale                                |
|------------------------|---------------------------------|------------------------------------------|
| Data interval          | 1h only                        | User decided 4h not needed               |
| Data source            | Binance public API              | No API key needed for klines             |
| Database               | Cloudflare D1                   | User has CF experience, data volume small|
| Backend                | Cloudflare Workers              | Pairs with D1 + Pages naturally          |
| Frontend               | Static HTML/CSS/JS              | Generated by Google AI Studio            |
| Chart library          | Lightweight Charts              | Open source, no API key, candlestick-ready|
| Chart layout           | Stacked (BTC top, ETH bottom)  | User preference, no overlay              |
| Password protection    | Cloudflare Access               | Already used in other project            |
| Kline update frequency | Daily cron                      | Sufficient for analysis use case         |
| Leverage calc          | Client-side only                | No backend needed                        |
| Build order            | Records → Charts → Calculator  | User-defined priority                    |
| Symbols                | BTCUSDT + ETHUSDT only          | Fixed, no expansion planned              |

---

## External Dependencies

| Dependency         | URL                                              | Purpose           |
|--------------------|--------------------------------------------------|--------------------|
| Binance REST API   | `https://api.binance.com/api/v3/klines`          | Kline data source  |
| Lightweight Charts | `https://unpkg.com/lightweight-charts@4/dist/...`| Candlestick charts |
| Cloudflare D1      | (managed)                                        | Database           |
| Cloudflare Workers | (managed)                                        | Backend API        |
| Cloudflare Pages   | (managed)                                        | Static hosting     |
| Cloudflare Access  | (managed)                                        | Auth gate          |

---

## For Frontend Agent (Google AI Studio)

When generating frontend HTML/JS, use these API contracts:

**Base URL**: Will be provided after backend deploy (same origin, `/api/...`).

**Fetch klines**:
```javascript
const res = await fetch(`/api/klines?symbol=BTCUSDT&start=${unixStart}&end=${unixEnd}`);
const { ok, data } = await res.json();
// data = [{ open_time, open, high, low, close, volume }, ...]
```

**Fetch records**:
```javascript
const res = await fetch('/api/records');
const { ok, data, total } = await res.json();
// data = [{ id, start_time, end_time, type, notes, tags, created_at, updated_at }, ...]
```

**Create record**:
```javascript
const res = await fetch('/api/records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ start_time, end_time, type, notes, tags })
});
```

**Update record**:
```javascript
const res = await fetch(`/api/records/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notes: 'updated notes' })  // partial update OK
});
```

**Delete record**:
```javascript
await fetch(`/api/records/${id}`, { method: 'DELETE' });
```

**Chart library setup** (Lightweight Charts v4):
```html
<script src="https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js"></script>
```

**Time values**: All timestamps are Unix seconds (not milliseconds). Convert for display:
```javascript
new Date(unix_seconds * 1000).toLocaleString()
```
