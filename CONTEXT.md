# Domain Model: BTC/ETH Divergence Tracker

## Core Concepts

### Kline (K-line / Candlestick)
OHLCV (Open, High, Low, Close, Volume) data for a single 1-hour period.
- **Source**: Binance public API (BTCUSDT, ETHUSDT)
- **Stored in**: D1 database (`klines` table)
- **Properties**: symbol, open_time, open, high, low, close, volume
- **Usage**: Historical price data for chart rendering

### Divergence Record
User's observation of a price divergence event between BTC and ETH.
- **Created by**: User via Records page
- **Properties**: start_time, end_time, type, notes, tags
- **Types**: bullish_dom, bearish_dom, btc_lead, eth_lead
- **Stored in**: D1 database (`divergence_records` table)
- **Linked to**: Klines (via time range for chart display)

### Chart
Visual representation of BTC and ETH price action over time.
- **Data source**: `/api/klines` endpoint (read-only)
- **Display**: Two stacked Lightweight Charts v5 instances (BTC top, ETH bottom)
- **Interaction**: Time-synced scroll/zoom (logical-range based)

### Position (in Calculator)
Hypothetical leveraged trading position for risk/reward analysis.
- **Created by**: User via Calculator page
- **Input**: margin, entry_price, stop_loss, take_profit, leverage
- **Output**: position_size, SL_amount, TP_amount, R:R, loss%, gain%
- **Validation**: SL < entry (long), SL > entry (short), SL_amount ≤ margin
- **Stored**: Client-side only (no persistence)

## API Boundaries

### Public APIs (No Authentication)
- `GET /api/klines` — Fetch Binance klines from D1 cache

### Data APIs (Email OTP Authentication)
- `GET /api/records` — Fetch user's divergence records
- `POST /api/records` — Create new record
- `PUT /api/records/:id` — Update existing record
- `DELETE /api/records/:id` — Delete record

### Admin APIs (Service Token + INGEST_TOKEN)
- `GET /api/admin/backfill-cursor` — Get current backfill progress
- `POST /api/admin/ingest` — Backfill Binance data (cron endpoint)

## Data Flow

### Backfill (Initialization + Daily Cron)
```
Binance API
    ↓ (cursor-paginated fetch)
backfill-fetcher.mts
    ↓ (chunked INSERT)
D1 klines table
    ↓ (SELECT * from D1)
/api/klines endpoint
    ↓ (fetch in browser)
Lightweight Charts (render)
```

### Records CRUD
```
User (Records page)
    ↓ (POST/PUT/DELETE)
/api/records endpoint
    ↓ (Zod validation)
D1 divergence_records table
    ↓ (SELECT from D1)
/api/records endpoint
    ↓ (JSON response)
Records table (frontend)
```

### Calculator
```
User (Calculator page)
    ↓ (number inputs)
JavaScript calculations (client-side)
    ↓ (no network requests)
Position summary display
```

## Authentication & Authorization

### Cloudflare Access (Perimeter)
- Email OTP required for: UI routes (`/`, `/charts.html`, `/calculator.html`), Records APIs
- Service Token required for: Admin APIs
- Public (no auth): Klines API (Binance public data)

### Application Layer (Worker)
- `INGEST_TOKEN` required for: Admin backfill endpoints
- No per-record authorization (single-owner assumption)

## Storage

### D1 Schema
- **klines**: symbol, open_time, open, high, low, close, volume
  - PK: (symbol, open_time)
  - Used for: Chart data, time-range queries
  
- **divergence_records**: id, user_id, start_time, end_time, type, notes, tags, created_at, updated_at
  - PK: id
  - Used for: CRUD operations, filtering by type/tags

## External Dependencies

- **Binance API**: Fetch klines (1200 req/min rate limit)
- **Cloudflare Workers**: Serverless compute
- **Cloudflare D1**: SQLite database
- **Lightweight Charts v5**: Frontend charting library (CDN)
- **Hono**: Router framework
- **Zod**: Input validation

---

**Last updated**: 2026-09-01 (v1.0 complete)
