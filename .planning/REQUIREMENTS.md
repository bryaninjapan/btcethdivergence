# Requirements: BTC/ETH Divergence Tracker

**Defined:** 2026-08-30
**Core Value:** 讓使用者能快速記錄、回顧和分析 BTC 與 ETH 之間的價格背離事件，累積可靠的歷史觀察數據。

## v1 Requirements

### Data Ingestion

- [ ] **DATA-01**: System fetches 1h OHLCV kline data from Binance public API for BTCUSDT and ETHUSDT
- [ ] **DATA-02**: System caches kline data in D1 with idempotent inserts (no duplicates on re-fetch)
- [ ] **DATA-03**: System runs daily cron to incrementally sync latest 1h klines (delta since last stored candle)
- [ ] **DATA-04**: System provides cursor-paginated admin backfill endpoint to load historical data (2021-01 → present) without hitting Workers subrequest/CPU limits
- [ ] **DATA-05**: System handles Binance rate limits (reads `X-MBX-USED-WEIGHT-1M`, honors `Retry-After` on 429, backs off on 418)
- [ ] **DATA-06**: System uses chunked `db.batch()` inserts (≤16 rows per statement) to stay within D1's 100 bound-parameter limit
- [ ] **DATA-07**: Binance reachability from deployed Cloudflare Worker is validated via spike test before full backfill implementation

### Records

- [ ] **REC-01**: User can create a divergence record with start time, end time, type, notes, and tags
- [ ] **REC-02**: User can edit an existing divergence record (partial update supported)
- [ ] **REC-03**: User can delete a divergence record (with confirmation dialog)
- [ ] **REC-04**: User can view all divergence records in a table, sorted newest first
- [ ] **REC-05**: User can filter records by divergence type (`time_lag`, `structural`, `opposite`)
- [ ] **REC-06**: User can search/filter records by tag (partial match)
- [ ] **REC-07**: User can select time via dropdown pickers (year 2021-2026, month, day, hour 00:00-23:00) instead of typing
- [ ] **REC-08**: Time inputs are explicitly labeled as UTC to prevent timezone confusion
- [ ] **REC-09**: System validates that start_time < end_time before saving

### Charts

- [ ] **CHART-01**: User can view BTCUSDT 1h candlestick chart (top pane)
- [ ] **CHART-02**: User can view ETHUSDT 1h candlestick chart (bottom pane), stacked below BTC
- [ ] **CHART-03**: Scrolling or zooming one chart automatically applies the same range to the other (time-synced)
- [ ] **CHART-04**: User can toggle log scale on/off for both charts
- [ ] **CHART-05**: User can select a custom time range to view via date pickers
- [ ] **CHART-06**: User can click "View Chart" on a record row to auto-load that time range (with 24h padding before/after)
- [ ] **CHART-07**: Charts use Lightweight Charts v5 standalone build (no build step, CDN-loaded)
- [ ] **CHART-08**: Time-sync implementation uses logical range (not time range) with re-entrancy guard to handle data gaps

### Calculator

- [ ] **CALC-01**: User can toggle between Long and Short direction
- [ ] **CALC-02**: User can input margin, entry price, stop-loss price, take-profit price, and leverage multiplier
- [ ] **CALC-03**: System calculates and displays: position size, stop-loss amount, take-profit amount, profit/loss ratio (R:R), loss rate %, gain rate %
- [ ] **CALC-04**: Leverage dropdown offers common values (1x, 2x, 3x, 5x, 10x, 20x, 25x, 50x, 75x, 100x, 125x)
- [ ] **CALC-05**: System shows warning when R:R is below 1.0
- [ ] **CALC-06**: System shows liquidation warning when stop-loss amount exceeds margin
- [ ] **CALC-07**: Calculator is purely client-side (no API calls)

### Infrastructure

- [ ] **INFRA-01**: Project deploys as a single Cloudflare Worker with Static Assets binding (not separate Pages + Workers)
- [ ] **INFRA-02**: API routes use Hono router with JSON envelope response format (`{ok, data|error}`)
- [ ] **INFRA-03**: POST/PUT request bodies are validated with Zod schemas at the Worker boundary
- [ ] **INFRA-04**: Cloudflare Access protects both the static UI and all `/api/*` routes (email OTP, single-email allow policy)
- [ ] **INFRA-05**: `.dev.vars` and `.wrangler/` are in `.gitignore` (no secrets in public repo)
- [ ] **INFRA-06**: Navigation bar allows switching between Records, Charts, and Calculator pages

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
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| DATA-07 | Phase 1 | Pending |
| REC-01 | Phase 2 | Pending |
| REC-02 | Phase 2 | Pending |
| REC-03 | Phase 2 | Pending |
| REC-04 | Phase 2 | Pending |
| REC-05 | Phase 2 | Pending |
| REC-06 | Phase 2 | Pending |
| REC-07 | Phase 2 | Pending |
| REC-08 | Phase 2 | Pending |
| REC-09 | Phase 2 | Pending |
| CHART-01 | Phase 3 | Pending |
| CHART-02 | Phase 3 | Pending |
| CHART-03 | Phase 3 | Pending |
| CHART-04 | Phase 3 | Pending |
| CHART-05 | Phase 3 | Pending |
| CHART-06 | Phase 3 | Pending |
| CHART-07 | Phase 3 | Pending |
| CHART-08 | Phase 3 | Pending |
| CALC-01 | Phase 4 | Pending |
| CALC-02 | Phase 4 | Pending |
| CALC-03 | Phase 4 | Pending |
| CALC-04 | Phase 4 | Pending |
| CALC-05 | Phase 4 | Pending |
| CALC-06 | Phase 4 | Pending |
| CALC-07 | Phase 4 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 5 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 after initial definition*
