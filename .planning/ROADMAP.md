# Roadmap: BTC/ETH Divergence Tracker

## Overview

This project builds a single-owner, password-gated internal tool for logging observed BTC/ETH price divergence events, reviewing them against real historical candlestick data, and running an independent leverage/position-size calculator. The build starts with the highest-risk infrastructure unknowns (Binance reachability from a deployed Cloudflare Worker, D1 bulk-insert limits) so no later phase is built on a wrong assumption, then loads and continuously syncs the historical kline dataset, then layers the three user-facing feature areas (Records, Charts, Calculator) roughly in the owner's stated priority order, and finally wraps the finished app in Cloudflare Access before it goes live behind what may be a public repo.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Worker Foundation & Binance Spike** - Deployed Worker skeleton, D1 schema, and a live Binance-reachability spike test
- [ ] **Phase 2: Kline Backfill Engine** - Cursor-paginated, rate-limit-aware Binance ingestion into D1 within Workers Free-plan limits
- [ ] **Phase 3: Historical Load & Cron Sync** - Full 2021-present history loaded gap-free, then kept current by a daily cron
- [ ] **Phase 4: Records Core CRUD** - Owner can create, edit, delete, and view divergence records
- [ ] **Phase 5: Records Filtering & Time-Entry UX** - Owner can filter records and enter times via UTC-labeled dropdowns
- [ ] **Phase 6: Dual Chart Rendering & Time Sync** - Stacked BTC/ETH candlestick charts with synced scroll/zoom
- [ ] **Phase 7: Chart Navigation & Record Deep Link** - Log-scale toggle, custom date range, and record-to-chart deep link
- [ ] **Phase 8: Leverage Calculator** - Independent client-side long/short position-sizing calculator
- [ ] **Phase 9: Access & Launch Hardening** - Shared navigation plus Cloudflare Access gating the whole app

## Phase Details

### Phase 1: Worker Foundation & Binance Spike
**Goal**: A single deployed Cloudflare Worker serves the app's static assets and API skeleton, D1 schema is live, and Binance reachability from that Worker is proven safe to build on.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-05, DATA-07
**Success Criteria** (what must be TRUE):
  1. Visiting the deployed Worker URL returns the static asset bundle via the Static Assets binding, with no separate Pages project involved.
  2. Calling any API route returns the `{ok, data|error}` JSON envelope.
  3. Submitting an invalid POST/PUT request body (e.g. missing required field) is rejected with a Zod validation error before touching the database.
  4. `.dev.vars` and `.wrangler/` are absent from git tracking.
  5. A fetch to Binance's public kline endpoint from the deployed (not local) Worker succeeds, or a documented fallback path is selected if blocked.
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Kline Backfill Engine
**Goal**: Historical BTC/ETH 1h kline data can be pulled from Binance and safely persisted into D1 without breaching Workers Free-plan limits.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Calling the admin backfill endpoint fetches one bounded batch (up to 1000 candles) of BTCUSDT or ETHUSDT klines from Binance and stores them in D1.
  2. Repeated calls to the backfill endpoint advance a stored cursor forward in time until reaching "now," each call completing within the Workers Free-plan CPU (10ms) and subrequest (50) limits.
  3. When Binance returns a 429 or 418, the backfill endpoint backs off or honors `Retry-After` instead of erroring out or hammering the API.
  4. Each backfill batch insert is split into chunks of at most 16 rows via `db.batch()`, never exceeding D1's 100 bound-parameter ceiling.
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Historical Load & Cron Sync
**Goal**: The full 2021-present kline history is loaded once and then kept current automatically every day without manual action.
**Depends on**: Phase 2
**Requirements**: DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Running the backfill to completion for both BTCUSDT and ETHUSDT results in a D1 dataset spanning 2021-01 to present with no unexplained gaps.
  2. Re-running the backfill or cron sync over an already-loaded range does not create duplicate rows.
  3. Every day, a scheduled cron run fetches only the klines newer than the last stored candle for both symbols, with no manual trigger required.
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Records Core CRUD
**Goal**: The owner can capture and manage the basic lifecycle of a divergence record.
**Depends on**: Phase 1
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-09
**Success Criteria** (what must be TRUE):
  1. User can create a new divergence record with start time, end time, type, notes, and tags, and it appears in the records list.
  2. User can edit an existing record's fields and see the update reflected immediately.
  3. User can delete a record after confirming a delete dialog, and it disappears from the list.
  4. User can view all divergence records in a table sorted newest-first.
  5. Attempting to save a record where start time is not before end time is rejected with a clear message.
**Plans**: 04-01 (backend DELETE + contract tests), 04-02 (records UI: table, create/edit form, delete dialog)
**UI hint**: yes

Plans:
- [ ] 04-01: Records CRUD backend completion (DELETE route + contract tests)
- [ ] 04-02: Records UI — table, create/edit form, delete confirmation

### Phase 5: Records Filtering & Time-Entry UX
**Goal**: The owner can quickly find relevant records and enter times without typos or timezone confusion.
**Depends on**: Phase 4
**Requirements**: REC-05, REC-06, REC-07, REC-08
**Success Criteria** (what must be TRUE):
  1. User can filter the records table to show only one divergence type at a time.
  2. User can search/filter records by a partial tag match.
  3. User selects start/end times via year/month/day/hour dropdowns instead of typing free text.
  4. Every time input on the page is explicitly labeled as UTC.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD

### Phase 6: Dual Chart Rendering & Time Sync
**Goal**: The owner can visually compare BTC and ETH price action side by side, panned in lockstep.
**Depends on**: Phase 3
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-07, CHART-08
**Success Criteria** (what must be TRUE):
  1. User sees a BTCUSDT 1h candlestick chart in the top pane and an ETHUSDT 1h candlestick chart in the bottom pane, stacked in a single-page layout.
  2. Scrolling or zooming either chart applies the same visible range to the other chart automatically.
  3. Panning/zooming rapidly on either chart does not desync, double-fire, or crash (the re-entrancy guard holds), including across ranges with data gaps.
  4. Charts render using the Lightweight Charts v5 standalone build loaded from a CDN, with no build step required.
**Plans**: 06-01 (charts page + dual candlestick rendering), 06-02 (logical-range time sync with re-entrancy guard)
**UI hint**: yes

Plans:
- [ ] 06-01: Charts page — stacked BTC/ETH Lightweight Charts v5 candlestick panes
- [ ] 06-02: Logical-range time sync with re-entrancy guard

### Phase 7: Chart Navigation & Record Deep Link
**Goal**: The owner can freely navigate chart history and jump straight from a logged record to its exact time window.
**Depends on**: Phase 6, Phase 5
**Requirements**: CHART-04, CHART-05, CHART-06
**Success Criteria** (what must be TRUE):
  1. User can toggle log scale on/off for both charts at once.
  2. User can pick a custom start/end date range and have both charts load that range.
  3. Clicking "View Chart" on a record row loads both charts centered on that record's time range with roughly 24h padding before and after.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 07-01: TBD

### Phase 8: Leverage Calculator
**Goal**: The owner can independently size a leveraged position and see its risk/reward without touching the backend.
**Depends on**: Phase 1
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, CALC-06, CALC-07
**Success Criteria** (what must be TRUE):
  1. User can toggle between Long and Short and fill in a form with margin, entry price, stop-loss, take-profit, and a leverage multiplier chosen from a dropdown of standard values (1x-125x).
  2. Calculator displays position size, stop-loss amount, take-profit amount, R:R ratio, loss rate %, and gain rate % as inputs change.
  3. A warning appears when the calculated R:R is below 1.0.
  4. A liquidation warning appears when the stop-loss amount would exceed the entered margin.
  5. The calculator produces results with no network requests fired (fully client-side).
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 08-01: TBD

### Phase 9: Access & Launch Hardening
**Goal**: The finished app is navigable as one cohesive site and fully gated behind the owner's own login before anyone else can reach it.
**Depends on**: Phase 5, Phase 7, Phase 8
**Requirements**: INFRA-04, INFRA-06
**Success Criteria** (what must be TRUE):
  1. User can switch between Records, Charts, and Calculator pages via a shared navigation bar.
  2. An unauthenticated request to the site or to any `/api/*` route is blocked and redirected to a Cloudflare Access login (email OTP) challenge.
  3. Only the owner's allow-listed email can complete the Access login and reach the app.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Worker Foundation & Binance Spike | 0/TBD | Not started | - |
| 2. Kline Backfill Engine | 0/TBD | Not started | - |
| 3. Historical Load & Cron Sync | 0/TBD | Not started | - |
| 4. Records Core CRUD | 0/2 | Not started | - |
| 5. Records Filtering & Time-Entry UX | 0/TBD | Not started | - |
| 6. Dual Chart Rendering & Time Sync | 0/TBD | Not started | - |
| 7. Chart Navigation & Record Deep Link | 0/TBD | Not started | - |
| 8. Leverage Calculator | 0/TBD | Not started | - |
| 9. Access & Launch Hardening | 0/TBD | Not started | - |
