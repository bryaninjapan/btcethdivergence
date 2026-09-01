# Requirements: BTC/ETH Divergence Tracker

**Defined:** 2026-08-30
**Core Value:** 讓使用者能快速記錄、回顧和分析 BTC 與 ETH 之間的價格背離事件，累積可靠的歷史觀察數據。

## v1 Requirements

### Data Ingestion

- [x] **DATA-01**: System fetches 1h OHLCV kline data from Binance public API for BTCUSDT and ETHUSDT ✅ Phase 2
- [x] **DATA-02**: System caches kline data in D1 with idempotent inserts (no duplicates on re-fetch) ✅ Phase 2
- [x] **DATA-03**: System runs daily cron to incrementally sync latest 1h klines (delta since last stored candle) ✅ Phase 3
- [x] **DATA-04**: System provides cursor-paginated admin backfill endpoint to load historical data (2021-01 → present) without hitting Workers subrequest/CPU limits ✅ Phase 2
- [x] **DATA-05**: System handles Binance rate limits (reads `X-MBX-USED-WEIGHT-1M`, honors `Retry-After` on 429, backs off on 418) ✅ Phase 2
- [x] **DATA-06**: System uses chunked `db.batch()` inserts (≤16 rows per statement) to stay within D1's 100 bound-parameter limit ✅ Phase 2
- [x] **DATA-07**: Binance reachability from deployed Cloudflare Worker is validated via spike test before full backfill implementation ✅ Phase 1

### Records

- [x] **REC-01**: User can create a divergence record with start time, end time, type, notes, and tags ✅ Phase 4
- [x] **REC-02**: User can edit an existing divergence record (partial update supported) ✅ Phase 4
- [x] **REC-03**: User can delete a divergence record (with confirmation dialog) ✅ Phase 4
- [x] **REC-04**: User can view all divergence records in a table, sorted newest first ✅ Phase 4
- [x] **REC-05**: User can filter records by divergence type (4 K-line based types) ✅ Phase 5
- [x] **REC-06**: User can search/filter records by tag (partial match) ✅ Phase 5
- [x] **REC-07**: User can select time via dropdown pickers (year 2021-2026, month, day, hour 00:00-23:00) instead of typing ✅ Phase 5
- [x] **REC-08**: Time inputs are explicitly labeled as UTC to prevent timezone confusion ✅ Phase 5
- [x] **REC-09**: System validates that start_time < end_time before saving ✅ Phase 4

### Charts

- [x] **CHART-01**: User can view BTCUSDT 1h candlestick chart (top pane) ✅ Phase 6
- [x] **CHART-02**: User can view ETHUSDT 1h candlestick chart (bottom pane), stacked below BTC ✅ Phase 6
- [x] **CHART-03**: Scrolling or zooming one chart automatically applies the same range to the other (time-synced) ✅ Phase 6
- [x] **CHART-04**: User can toggle log scale on/off for both charts ✅ Phase 7
- [x] **CHART-05**: User can select a custom time range to view via date pickers ✅ Phase 7
- [x] **CHART-06**: User can click "View Chart" on a record row to auto-load that time range (with 24h padding before/after) ✅ Phase 7
- [x] **CHART-07**: Charts use Lightweight Charts v5 standalone build (no build step, CDN-loaded) ✅ Phase 6
- [x] **CHART-08**: Time-sync implementation uses logical range (not time range) with re-entrancy guard to handle data gaps ✅ Phase 6

### Calculator

- [x] **CALC-01**: User can toggle between Long and Short direction ✅ Phase 8
- [x] **CALC-02**: User can input margin, entry price, stop-loss price, take-profit price, and leverage multiplier ✅ Phase 8
- [x] **CALC-03**: System calculates and displays: position size, stop-loss amount, take-profit amount, profit/loss ratio (R:R), loss rate %, gain rate % ✅ Phase 8
- [x] **CALC-04**: Leverage dropdown offers common values (1x, 2x, 3x, 5x, 10x, 20x, 25x, 50x, 75x, 100x, 125x) ✅ Phase 8
- [x] **CALC-05**: System shows warning when R:R is below 1.0 ✅ Phase 8
- [x] **CALC-06**: System shows liquidation warning when stop-loss amount exceeds margin ✅ Phase 8
- [x] **CALC-07**: Calculator is purely client-side (no API calls) ✅ Phase 8

### Infrastructure

- [x] **INFRA-01**: Project deploys as a single Cloudflare Worker with Static Assets binding (not separate Pages + Workers) ✅ Phase 1
- [x] **INFRA-02**: API routes use Hono router with JSON envelope response format (`{ok, data|error}`) ✅ Phase 1
- [x] **INFRA-03**: POST/PUT request bodies are validated with Zod schemas at the Worker boundary ✅ Phase 1
- [x] **INFRA-04**: Cloudflare Access protects restricted routes with layered authentication: ✅ Phase 9
  - UI and records APIs (`/`, `/charts.html`, `/calculator.html`, `/api/records`) → email OTP (single owner email allow-listed)
  - Public data APIs (`/api/klines`) → no authentication required (Binance public data; caching and serving for chart display)
  - Admin APIs (`/api/admin/*`) → Cloudflare Access Service Token (revocable, time-limited) + application-level INGEST_TOKEN
- [x] **INFRA-05**: `.dev.vars` and `.wrangler/` are in `.gitignore` (no secrets in public repo) ✅ Phase 1
- [x] **INFRA-06**: Navigation bar allows switching between Records, Charts, and Calculator pages ✅ Phase 9

### Code Quality & Maintainability

- [x] **CODE-01**: Divergence type definitions are unified across backend (validate.ts) and frontend (records.js) — single source of truth, no duplication ✅ Phase 13
- [x] **CODE-02**: Error handling is structured with consistent error codes, messages, and context across all endpoints ✅ Phase 11
- [x] **CODE-03**: Validation logic is centralized (DRY principle) — common patterns extracted, reused across endpoints ✅ Phase 11
- [x] **CODE-04**: Route handlers follow service layer pattern — business logic separated from HTTP concerns ✅ Phase 12
- [x] **CODE-05**: Frontend state management is isolated — no implicit global dependencies between modules ✅ Phase 13
- [x] **CODE-06**: SQL generation in admin routes is safe from injection — dynamic queries are parameterized or avoided ✅ 2026-09-02 (QueryBuilder)

## v2 Requirements

### Analytics

- **ANALYTICS-01**: User can see aggregate stats (records per type, average duration, frequency over time)
- **ANALYTICS-02**: User can export records as CSV

### Enhanced Charts

- **ECHART-01**: Chart displays divergence record markers (vertical lines or highlights) at logged time ranges
- **ECHART-02**: User can click a marker on the chart to view the linked record

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated divergence detection | Defeats the stated Core Value of building personal judgment through manual review |
| Overlay/ratio chart | Loses OHLC candlestick detail; owner prefers stacked side-by-side |
| Click-to-populate calculator from chart | High implementation cost for a workflow the owner says is easier with manual entry |
| 4h or other timeframes | Owner decided 1h is sufficient; no aggregation/synthesis needed |
| Additional trading pairs | Tool's value is the specific, deep BTC/ETH relationship |
| Multi-user / shared accounts | Single-owner private tool |
| Mobile app | Responsive web sufficient for desk-based review |
| Real-time / live streaming | Retrospective analysis tool; daily cron sync is sufficient |
| Alerts / notifications | Requires automated detection engine as prerequisite |
| P&L / portfolio tracking | Tool logs divergence observations, not executed trades |
| Exchange API integration | No API keys needed; manual record creation is sufficient |
| Chart drawing tools | Lightweight Charts doesn't support them natively; owner can use TradingView for that |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 to DATA-07 | Phases 1-3 | ✅ Complete |
| REC-01 to REC-09 | Phases 4-5 | ✅ Complete |
| CHART-01 to CHART-08 | Phases 6-7 | ✅ Complete |
| CALC-01 to CALC-07 | Phase 8 | ✅ Complete |
| INFRA-01 to INFRA-06 | Phases 1, 9 | ✅ Complete |
| CODE-01 | Phase 13 | ✅ Complete |
| CODE-02 | Phase 11 | ✅ Complete |
| CODE-03 | Phase 11 | ✅ Complete |
| CODE-04 | Phase 12 | ✅ Complete |
| CODE-05 | Phase 13 | ✅ Complete |
| CODE-06 | 2026-09-02 | ✅ Complete |

**Coverage: 41/41 ✅**
- v1 Feature Requirements: 35/35 ✅
- v1 Code Quality Requirements: 6/6 ✅
- Completion: 100% (2026-09-02)

---
*Requirements defined: 2026-08-30*  
*Last updated: 2026-09-02 — v1.0 COMPLETE — All 41 requirements met (35 feature + 6 code quality)*
