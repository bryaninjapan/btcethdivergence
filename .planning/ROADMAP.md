# Roadmap: BTC/ETH Divergence Tracker

## Overview

This project builds a single-owner, password-gated internal tool for logging observed BTC/ETH price divergence events, reviewing them against real historical candlestick data, and running an independent leverage/position-size calculator. The build starts with the highest-risk infrastructure unknowns (Binance reachability from a deployed Cloudflare Worker, D1 bulk-insert limits) so no later phase is built on a wrong assumption, then loads and continuously syncs the historical kline dataset, then layers the three user-facing feature areas (Records, Charts, Calculator) roughly in the owner's stated priority order, and finally wraps the finished app in Cloudflare Access before it goes live behind what may be a public repo.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Worker Foundation & Binance Spike** - Deployed Worker skeleton, D1 schema, and a live Binance-reachability spike test ✅
- [x] **Phase 2: Kline Backfill Engine** - Cursor-paginated, rate-limit-aware Binance ingestion into D1 within Workers Free-plan limits ✅
- [x] **Phase 3: Historical Load & Cron Sync** - Full 2021-present history loaded gap-free, then kept current by a daily cron ✅
- [x] **Phase 4: Records Core CRUD** - Owner can create, edit, delete, and view divergence records ✅
- [x] **Phase 5: Records Filtering & Time-Entry UX** - Owner can filter records and enter times via UTC-labeled dropdowns ✅
- [x] **Phase 6: Dual Chart Rendering & Time Sync** - Stacked BTC/ETH candlestick charts with synced scroll/zoom ✅
- [x] **Phase 7: Chart Navigation & Record Deep Link** - Log-scale toggle, custom date range, and record-to-chart deep link ✅
- [x] **Phase 8: Leverage Calculator** - Independent client-side long/short position-sizing calculator ✅
- [x] **Phase 9: Access & Launch Hardening** - Shared navigation plus Cloudflare Access gating the whole app ✅
- [x] **Phase 10: Timestamp Domain Abstraction** - Eliminate scattered time conversion logic, centralize via strongly-typed Timestamp class ✅
- [x] **Phase 11: Error Handling & Structured Responses** - Replace ad-hoc error handling with structured error types, unified response envelope, centralized middleware ✅
- [x] **Phase 12: Service Layer Pattern** - Extract business logic from route handlers, implement service layer for improved testability and reusability ✅
- [x] **Phase 13: Frontend Data Isolation & UI Enhancement** - Refactor frontend state (charts.js, records.js) from globals to isolated modules; apply TradingView-style K-line colors and MSB indicator ✅
- [x] **Phase 14: Architecture Foundations (Temporal + Divergence)** ✅ - Consolidate time-domain logic into centralized temporal-api module; unify divergence type definitions across backend and frontend
- [x] **Phase 15: Frontend State Refactoring (Chart State Machine)** ✅ - Merge chart-state.js, chart-range.js, chart-sync.js into unified ChartManager state machine; 62 tests (49 unit + 13 integration), 81/81 E2E pass
- [ ] **Phase 16A: Structured Logging System** - Replace console.* with structured logging layer; add ChartManager/charts.js/records.js instrumentation; enable Workers Logs for production observability
- [ ] **Phase 16: Backend Service Deepening (Records Repository)** - Consolidate records SQL into RecordsRepository; migrate integration tests to MockD1; add listWithStats and findByTimeRange query methods
- [ ] **Phase 17: Future-Proofing (Calculator Validation, Optional)** - Extract calculator validation rules into schema-driven module, prepare for future API endpoints

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
  2. An unauthenticated request to the site or to any restricted route is blocked by Cloudflare Access:
     - UI routes (`/`, `/charts.html`, `/calculator.html`) redirect to email OTP login challenge
     - Data API routes (`/api/records`) require owner email (email OTP, Policy 1)
     - Public data API routes (`/api/klines`) are accessible without authentication (Binance public data)
     - Admin API routes (`/api/admin/*`) require Service Token (Policy 2)
  3. Only the owner's allow-listed email can complete the Access login and reach the UI and records APIs.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD

### Phase 10: Timestamp Domain Abstraction
**Goal**: Eliminate scattered time conversion logic (`Math.floor(ms / 1000)`) across codebase. Replace with strongly-typed `Timestamp` class for type safety and single source of truth.
**Depends on**: Phase 9
**Requirements**: CODE-01 (type safety), CODE-02 (maintainability)
**Success Criteria** (what must be TRUE):
  1. All backend time operations use `Timestamp` API instead of `Math.floor(ms / 1000)`.
  2. All frontend `Math.floor(ms/1000)` conversion patterns use `Timestamp` API (sec→ms adapters excluded per W1 decision).
  3. Zero `Math.floor(ms / 1000)` remains in production code outside `src/lib/timestamp.ts` (SSoT exception).
  4. `Timestamp` class fully tested with 44/44 unit tests passing.
  5. Code review approval with no HIGH issues.
**Plans**: 10-01 (backend integration), 10-02 (frontend integration)
**Status**: Timestamp class implemented ✅, ready for integration

Plans:
- [ ] 10-01: Backend integration (db.ts, klines.ts, types.ts)
- [ ] 10-02: Frontend integration (charts.js, records.js)

### Phase 11: Error Handling & Structured Responses
**Goal**: Eliminate scattered `try-catch` blocks and string-based errors. Implement structured error types, unified response envelope, and centralized error middleware for all API routes.
**Depends on**: Phase 10
**Requirements**: CODE-02 (Error Handling)
**Success Criteria** (what must be TRUE):
  1. All errors inherit from `AppError` base class with structured types (`ValidationError`, `DatabaseError`, `ExternalServiceError`, `AuthenticationError`).
  2. All API responses follow unified envelope: `{ ok, data?, error? }` with `ErrorDetails = { code, message, details }`.
  3. Centralized error middleware catches all errors, logs full context server-side, returns sanitized response to client.
  4. Zero silent error failures: no more `catch (error) { console.error(...) }` in route handlers.
  5. 40+ unit + integration tests covering all error types and routes.
  6. Frontend can differentiate error types by `error.code` (VALIDATION_ERROR vs. SERVICE_ERROR vs. DATABASE_ERROR).
**Plans**: 11-01 (error types & middleware), 11-02 (route refactoring), 11-03 (testing & verification)
**Status**: Planned, ready to execute

Plans:
- [ ] 11-01: Error type definitions and centralized middleware (1 day)
- [ ] 11-02: Refactor all route handlers to use structured errors (1.5 days)
- [ ] 11-03: Comprehensive error handling tests and UAT (1 day)

### Phase 12: Service Layer Pattern
**Goal**: Extract business logic from route handlers into dedicated service layer. Improve testability, code reuse, and maintainability by separating HTTP concerns from business logic.
**Depends on**: Phase 11, Quick Tasks #2, #3, #5
**Requirements**: CODE-04 (Service Layer Pattern)
**Success Criteria** (what must be TRUE):
  1. All business logic extracted to `src/services/` (records, klines, admin domains including binance-spike + ingest orchestration).
  2. Services accept already-validated input (Zod validation at route layer).
  3. Services have 20+ unit tests (isolated with Mock D1 to verify service logic and call sequences).
  4. All routes refactored to use services (HTTP layer thin, ~10-20 lines per endpoint).
  5. Route integration tests pass (no regressions).
  6. E2E tests pass (critical user flows work).
  7. Code coverage ≥ 80% (aggregate across `src/**` and `public/js/**`).
  8. Code review complete (no HIGH severity issues).
**Plans**: 12-01 (records service), 12-02 (klines service), 12-03 (admin service), 12-04 (test DB & E2E), 12-05 (code review & docs)
**Status**: Planning complete, ready for plan check

Plans:
- [ ] 12-01: Records service extraction & testing (1 day)
- [ ] 12-02: Klines service extraction & testing (1 day)
- [ ] 12-03: Admin service extraction & testing (0.5 day)
- [ ] 12-04: Test database setup & E2E verification (0.5 day)
- [ ] 12-05: Code review & documentation (0.5 day)

### Phase 13: Frontend Data Isolation & UI Enhancement
**Goal**: Refactor frontend state management from global variables to isolated, testable module instances. Apply TradingView-style visual improvements (K-line colors, indicator marks).
**Depends on**: Phase 12
**Requirements**: CODE-05 (Frontend Testability), UI-01 (Chart Styling)
**Success Criteria** (what must be TRUE):
  1. Zero global variables in `charts.js`, `records.js` modules.
  2. State encapsulated in factory functions: `createChartState()`, `createRecordsManager()`.
  3. 350+ unit tests passing with ≥85% code coverage (frontend + backend).
  4. E2E verification: all user journeys (charts, records, calculator) work correctly.
  5. K-line colors render in TradingView style (green bullish, red bearish).
  6. Indicator marks display divergence events on charts with correct colors/positions.
  7. Code review complete: zero HIGH/CRITICAL issues.
  8. Documentation updated: README, LEARNING.md, VERIFICATION.md.
**Plans**: 13-01 (charts state), 13-02 (records state), 13-03 (form abstraction), 13-04 (review + verification), 13b (UI improvements)
**Status**: Plan check ready

Plans:
- [ ] 13-01: Charts state refactoring (createChartState) (2 days)
- [ ] 13-02: Records state refactoring (createRecordsManager) (1.5 days)
- [ ] 13-03: Form binding abstraction (FormBinder) (1 day)
- [ ] 13-04: Code review & integration verification (0.5 days)
- [ ] 13b-01: K-line color styling (0.5 days)
- [ ] 13b-02: Indicator mark visualization (1 day)

## Quick Tasks & Architecture Improvements

These are lightweight refactoring and code quality improvements executed between phases, tracked in `.planning/quick/`.

### Architecture Review Candidates

**Goal**: Systematically improve code quality, reduce duplication, and establish reusable patterns post-v1.0.

**Execution Order** (user-prioritized):

1. [x] **#2 Time Domain Abstraction** — Completed in Phase 10 ✅
   - Timestamp class consolidates scattered `Math.floor(ms/1000)` patterns
   - Type-safe conversion at API boundaries

2. [x] **#5 Shared Enum Definition** — COMPLETED ✅ (2026-09-01)
   - **Problem**: `divergenceType` enum defined in 2 places (validate.ts lines 3 & 33); TYPE_LABELS hardcoded in records.js
   - **Solution**: 
     - Created `src/domains/divergence.ts` — single source of truth for DIVERGENCE_TYPES + TYPE_LABELS
     - Created `public/js/divergence.js` — frontend mirror constants
     - Refactored `validate.ts` to import + use DIVERGENCE_TYPES (eliminated duplicate)
     - Refactored `records.js` to import TYPE_LABELS
   - **Benefit**: Type updates now affect 2 files instead of 3; no more duplication
   - **Commit**: `0d7aa23`

3. [ ] **#7 Improved Error Handling & Structured Responses** → **Phase 11** ✅ Promoted to full phase
   - Structured error types (ValidationError, DatabaseError, ExternalServiceError)
   - Unified `{ ok, data?, error? }` response envelope
   - Centralized error middleware + 40+ tests
   - Phase 11 plan: 11-01, 11-02, 11-03

4. [ ] **#3 Centralized Validation Framework**
   - Extract common validation patterns from multiple endpoints
   - Reduce DRY violations in validation logic

5. [ ] **#1 Parameter Objects & Service Layer**
   - Large refactoring (depends on #2–#4 completion)
   - Abstract route handlers into service layer
   - Group related parameters into objects

6. [ ] **#4 Frontend Data Isolation** (later, non-critical)
   - Isolate global state in frontend
   - Reduce implicit dependencies between modules

7. [ ] **#6 SQL Generation Safety** (v2, backfill-only)
   - Sanitize dynamic SQL generation in backfill operations
   - Relevant only for admin/internal routes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Architecture Foundations (Temporal + Divergence) | 2/2 | ✅ COMPLETE | 2026-09-02 |
| 15. Frontend State Refactoring (Chart State Machine) | 3/3 | ✅ COMPLETE | 2026-09-02 |
| 16A. Structured Logging System | 0/3 | Plan-checked (Needs Clarification) | - |
| 16. Backend Service Deepening (Records Repository) | 0/5 | Plan-checked (Ready to Execute) | - |
| 17. Future-Proofing (Calculator Validation, Optional) | 0/1 | Ready to plan | - |

---

### Phase 14: Architecture Foundations (Temporal + Divergence)
**Goal**: Consolidate scattered time-domain logic into a reusable temporal-api module; unify divergence type definitions across backend and frontend.
**Depends on**: Phase 13
**Requirements**: CODE-01 (Unified Types), CODE-03 (DRY Validation)
**Success Criteria** (what must be TRUE):
  1. New `src/domains/temporal-api.ts` exports `TemporalConverter` class with methods: `msToSec(ms)`, `secToMs(sec)`, `dateToSec(date)`, `secToDate(sec)`, batch conversion utilities.
  2. All time conversions in 8+ backend modules (db.ts, klines.ts, validate.ts, records.ts, admin.ts, etc.) use `TemporalConverter` instead of scattered `Math.floor(ms/1000)`.
  3. Divergence type definitions unified: `src/domains/divergence.ts` single source of truth for DIVERGENCE_TYPES + TYPE_LABELS.
  4. Frontend imports divergence types from new `public/js/api/divergence-types.json` (or .js mirror).
  5. Zero time conversion logic duplication across backend modules.
  6. 30+ unit tests verifying temporal boundaries and batch operations.
  7. Code review complete: zero HIGH issues.
**Plans**: 14-01 (temporal-api module + backend integration), 14-02 (divergence unification + frontend integration)

Plans:
- [ ] 14-01: Temporal-api module and backend time conversion consolidation
- [ ] 14-02: Divergence type unification and frontend integration

### Phase 15: Frontend State Refactoring (Chart State Machine)
**Goal**: Merge four scattered chart modules (chart-state.js, chart-range.js, chart-sync.js, charts.js) into a single unified ChartManager state machine for better testability, maintainability, and clarity.
**Depends on**: Phase 14
**Requirements**: CODE-05 (Frontend Testability), CODE-04 (Service Layer Pattern)
**Success Criteria** (what must be TRUE):
  1. New `public/js/managers/ChartManager.ts` (or .js) encapsulates all chart state: visible range, log/linear mode, sync lock state, data cache.
  2. ChartManager exports: `initCharts()`, `setVisibleRange()`, `toggleLogScale()`, `syncRanges()`, with strict re-entrancy guards.
  3. chart-state.js, chart-range.js, chart-sync.js files removed; their logic consolidated into ChartManager.
  4. charts.js refactored to use ChartManager exclusively (≤5 direct Lightweight Charts API calls).
  5. State transitions machine-testable: all chart interactions produce predictable state changes (no race conditions, no missed events).
  6. 40+ unit tests verifying state transitions, range sync, and re-entrancy guards.
  7. E2E tests pass: zoom/pan/sync workflow works correctly.
  8. Code review complete: zero HIGH issues.
**Plans**: 15-01 (ChartManager core + state machine), 15-02 (charts.js refactoring), 15-03 (tests + E2E verification)

Plans:
- [x] 15-01: ChartManager state machine implementation ✅
- [x] 15-02: Refactor charts.js to use ChartManager ✅
- [x] 15-03: Unit tests + E2E verification ✅

### Phase 16A: Structured Logging System
**Goal**: Add production-grade observability and error tracking by replacing console.error() with a structured logging layer. Enable ChartManager/charts.js/records.js instrumentation with context correlation and Workers Logs backend observability.
**Depends on**: Phase 15
**Requirements**: CODE-06 (Observability), CODE-07 (Production Monitoring)
**Success Criteria** (what must be TRUE):
  1. Logging approach decided: Option C (custom lightweight logger, no external dependencies, preserves no-build-step architecture)
  2. Structured logging integrated in ChartManager, charts.js, records.js with context fields (component, action, timestamp, severity)
  3. Error classification: abort-timeout / abort-superseded / validation / service / database / auth / unknown
  4. redaction rule: user-supplied notes/tags logged as length only, not content
  5. 443 existing unit tests + ~40 new logging tests pass
  6. 81/81 E2E pass (no behavioral regression)
  7. Coverage ≥85% (baseline 87.91%)
  8. Workers Logs enabled in wrangler.jsonc, verified on deployed Worker with RUNBOOK.md
  9. Code review: zero HIGH/CRITICAL
  10. Zero raw console.* in production code outside logger sinks
**Plans**: 16A-01 (logger core + ChartManager integration), 16A-02 (page instrumentation + monitoring), 16A-03 (verification + review)
**Status**: Plan-checked (Needs Clarification on 3 blockers — see PLAN.md)
**Duration**: 1-1.5 days

Plans:
- [ ] 16A-01: Logger core + ChartManager integration (0.5 days)
- [ ] 16A-02: Page instrumentation + Workers Logs setup (0.5 days)
- [ ] 16A-03: Verification + review (0.25 days)

### Phase 16: Backend Service Deepening (Records Repository)
**Goal**: Consolidate all records SQL into a rich RecordsRepository class; migrate route integration tests to MockD1; add advanced query methods (listWithStats, findByTimeRange) with proper statistics and overlap semantics.
**Depends on**: Phase 14
**Requirements**: CODE-04 (Service Layer Pattern), CODE-03 (DRY Validation)
**Success Criteria** (what must be TRUE):
  1. New `src/services/RecordsRepository.ts` exports: `findAll()`, `findById(id)`, `listWithStats()`, `findByTimeRange(start, end)`, `findByType(type)`, `create()`, `update()`, `delete()`.
  2. All record query logic moved from route handlers + lib/db.ts into RecordsRepository (parameterized SQL, no injection).
  3. RecordsRepository accepts D1 database instance + optional temporal-api clock: `constructor(db: D1Database, now?: () => number)`
  4. Route handlers simplified: ≤10 lines per endpoint, pure HTTP concerns (validation, response formatting).
  5. 25+ unit tests using MockD1 (target 41); migration of unique error cases from records.service.test.ts.
  6. Integration tests pass including new GET /api/records/stats endpoint (6 tests).
  7. Coverage ≥85% globally; repository layer ≥95% (manual verification).
  8. Code review complete: zero HIGH/CRITICAL issues.
**Plans**: 16-01 (MockD1 migration + extend), 16-02 (RecordsRepository + service-test migration), 16-03 (unit tests), 16-04 (route refactor + stats), 16-05 (review + docs)
**Status**: ✅ COMPLETE (2026-09-02)
**Duration**: 1.5 days (11 hours)

**Design Decisions (approved 2026-09-02)**:
  - **listWithStats()**: Simple JS-computed statistics (totalRecords, byType, byMsb, dateRange); no SQL COUNT/GROUP BY
  - **findByTimeRange(start, end)**: Overlap semantics — `WHERE start_time < ? AND end_time > ?` — includes records spanning the query window
  - **Pagination**: Not added in Phase 16 (single-owner scale); optional for Phase 17+
  - **One Mock, One Layer**: Consolidate records.test.ts→MockD1 (B3:A), delete records.service.ts + migrate error cases (B4)

**Blockers Resolved**:
  - **B1**: STATE.md aligned with ROADMAP.md (Phase 16 = Records Repository)
  - **B2**: Task ID unified (16-01..05 match PLAN.md → ROADMAP.md sync)
  - **B3**: MockD1 migration (Option A) — records.test.ts consolidated, time +1h
  - **B4**: records.service.test.ts migration — error cases moved to repository tests, time +0.5h

Plans:
- [x] 16-01: Extend MockD1 + migrate records.test.ts (2 hours)
- [x] 16-02: RecordsRepository implementation + service-test migration (3.5 hours)
- [x] 16-03: Unit tests (2.5 hours)
- [x] 16-04: Route refactor + stats endpoint (2 hours)
- [x] 16-05: Code review + docs (1 hour)

### Phase 17: Future-Proofing (Calculator Validation, Optional)
**Goal**: Extract calculator validation rules into a schema-driven, reusable module. Prepares for future calculator API endpoints while keeping client-side calculator unchanged.
**Depends on**: Phase 16
**Requirements**: CODE-03 (DRY Validation), CODE-04 (Service Layer Pattern)
**Success Criteria** (what must be TRUE):
  1. New `src/domains/calculator-rules.ts` exports Zod schemas: `CalculatorInputs`, `CalculatorOutputs` for validation and type safety.
  2. Client-side calculator logic unchanged (still runs in browser).
  3. Server-side calculator API ready for Phase 17+: `/api/calculator/validate` and `/api/calculator/compute` endpoints (stubs created, tests written, ready for implementation).
  4. Schemas shared: frontend and backend import from same `calculator-rules.ts`.
  5. 15+ unit tests verifying validation rules, edge cases (margin vs. SL, liquidation thresholds).
  6. Code review complete: zero HIGH issues.
**Plans**: 17-01 (Calculator validation schemas + API stubs)

Plans:
- [ ] 17-01: Calculator validation schemas and future API preparation
