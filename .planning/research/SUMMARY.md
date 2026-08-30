# Project Research Summary

**Project:** btcethdivergence — private BTC/ETH divergence tracking tool
**Domain:** Single-user crypto trading analysis tool (candlestick charting + manual event logging + leverage calculator) on Cloudflare
**Researched:** 2026-08-30
**Confidence:** HIGH

## Executive Summary

This is a single-owner, password-gated internal tool for logging observed BTC/ETH price divergence events, viewing them against real historical candlestick data, and running independent leverage/position-size calculations. No existing SaaS product does exactly this combination — the closest analogues (crypto trading journals, TradingView SMT/correlation indicators, leverage calculators) each solve one third of the problem. The right build approach is a small, tightly-scoped Cloudflare-native app: a single Cloudflare Worker serving static assets, a JSON API, and a cron job, backed by D1 for storage and Binance's public REST API for market data. The project's own draft plan sketched a Pages+Workers split; all four research tracks converge on recommending a single consolidated Workers project instead (Workers + Static Assets), since that is Cloudflare's current first-class pattern and it also sidesteps an entire class of "cron doesn't fire" bugs that only exist in the Pages+Functions split.

The main risks are almost entirely infrastructure/platform-limit risks, not product-design risks — the feature set itself is already tightly and correctly scoped (PROJECT.md already excludes automation, multi-user, mobile, and live streaming, all correctly identified as anti-features for this use case). The two risks that could force a mid-project architecture change are: (1) Cloudflare Workers' shared datacenter IPs may be blocked or geo-restricted by Binance (a documented, recurring problem), which should be spike-tested in Phase 1 before any backfill/cron code is written; and (2) naive bulk-insert and full-history-backfill implementations will hit Workers CPU-time, subrequest, and D1 bound-parameter limits if not deliberately chunked/paginated from day one. Both are well-understood, low-cost-to-fix-early problems if addressed in Phase 1, and expensive-to-discover-late problems if not.

Recommended approach: build the D1 schema and a single Worker (assets + API router + cron) first, prove the Binance fetch works from a deployed (not local-dev) Worker and that chunked D1 batch-inserts work at real 1000-row page scale, then layer Records UI → Chart UI → Calculator → Cloudflare Access in that order, matching both the feature dependency graph and the owner's stated priority.

## Key Findings

### Recommended Stack

Cloudflare Workers with the `assets` binding (not a separate Pages project) serving three static HTML pages plus a Hono-routed JSON API and a `scheduled()` cron handler, backed by Cloudflare D1 (SQLite) for the `klines` and `divergence_records` tables. Cloudflare Access (Zero Trust, email OTP) provides the auth gate with zero application code. TradingView Lightweight Charts v5 (UMD/standalone build, loaded via CDN, no build step) renders the candlesticks; Zod validates API request bodies at the boundary.

**Core technologies:**
- Cloudflare Workers + Static Assets: single deployable for frontend, API, and cron — current Cloudflare guidance for new projects, free asset serving
- Cloudflare D1: SQLite storage for ~87.6K kline rows + records — trivially within free-tier limits (5GB, 5M rows read/day)
- Hono 4.13.x: lightweight router for the 5-endpoint API, built for the Workers runtime
- TradingView Lightweight Charts v5.2.x: open-source, no API key, purpose-built OHLC candlestick rendering (~45KB gzipped)
- Zod: schema validation for `POST/PUT /api/records` (type enum, length limits, time ordering) at the Worker boundary
- Cloudflare Access (Zero Trust): password/auth gate configured at the dashboard/zone level, not in app code

### Expected Features

This is not a competitive product; "table stakes" means "the owner stops using it if missing." PROJECT.md's scope is already MVP-correct — the feature research mainly confirms the existing scope decisions and flags a few UX details worth catching early.

**Must have (table stakes):**
- Divergence record CRUD (start/end time, type, notes, tags) with filter/search by type and tag
- Dual synced BTC/ETH candlestick charts (stacked, 1h resolution, log-scale toggle) with 2021→present historical coverage
- Record → chart deep link with time padding
- Dropdown-based (non-typed) time entry, explicitly UTC-labeled
- Leverage/position-size calculator (long/short, margin/entry/SL/TP/leverage → R:R), fully decoupled from records/charts
- Cloudflare Access password gate covering both the UI and the API routes

**Should have (differentiators):**
- Fixed 3-type divergence taxonomy (`time_lag`/`structural`/`opposite`) instead of free-form tags — the single most domain-specific, valuable design decision
- Time-synced scroll/zoom between the two chart panes (the core "compare two assets" mechanic)
- Reframing the deep-link around a divergence window, not a generic trade entry

**Defer (v2+ / explicitly out of scope):**
- Automated divergence detection, multi-pair/correlation matrix, mobile app, live/streaming price updates, alerts/notifications, P&L/portfolio tracking, exchange account integration, chart drawing tools — all correctly excluded per PROJECT.md; adding any would dilute focus or contradict the tool's manual-judgment-building purpose
- CSV export and aggregate stats summary are plausible low-cost v1.x additions if real usage reveals a need, but nothing is currently required

### Architecture Approach

Single Cloudflare Worker project: static assets (`public/`) served free at the edge, a Hono-based `fetch()` router for the 5 API routes plus a cursor-paginated admin backfill endpoint, and a `scheduled()` handler for the daily incremental sync — all sharing one D1 binding and deployed via one `wrangler.jsonc`/`wrangler deploy`. All SQL lives behind a `lib/db.ts` repository layer; the Binance fetch/normalize/backoff logic lives in `lib/binance.ts` and is shared between the backfill and cron paths (cron's "delta since last close" is a strict subset of backfill's "paginate until done" logic).

**Major components:**
1. Static assets (records/chart/calculator HTML+JS) — zero-CPU edge-served UI, no build step, drops in directly from AI-Studio-generated frontend output
2. API router (`fetch` handler + `routes/*.ts`) — parses/validates requests, calls the DB layer, returns a `{ok, data|error}` JSON envelope
3. DB repository (`lib/db.ts`) — sole point of D1 access; chunked `db.batch()` inserts for bulk data, `INSERT OR IGNORE` keyed on `(symbol, open_time)` for idempotent syncs
4. Binance client (`lib/binance.ts`) — fetch, normalize, rate-limit-aware backoff, shared by cron and backfill
5. Cron sync (`scheduled()`) — daily small delta fetch per symbol, deliberately separate in scale/design from the one-time historical backfill
6. Cloudflare Access — auth gate configured at the zone/hostname level, covering both UI and `/api/*`, with no application code

### Critical Pitfalls

1. **Binance may block/geo-restrict Cloudflare Workers' shared datacenter IPs (451/403)** — spike-test with a real deployed `fetch()` call to `api.binance.com` in Phase 1 before writing full backfill/cron logic; fall back to `data-api.binance.vision` or an external fetcher (e.g., GitHub Actions) posting into an admin ingest endpoint if blocked.
2. **Running the full 2021→present backfill (~43.8K candles × 2 symbols) as one loop/invocation will fail** — Workers cap external subrequests (50/invocation on Free) and CPU time (10ms Free); use a cursor-paginated admin endpoint (one ≤1000-candle page per call) instead, and never rely on cron for the historical load.
3. **D1/SQLite caps bound parameters at 100 per statement** — naive giant multi-row inserts of a full 1000-row Binance page will throw "too many SQL variables"; chunk inserts to ~10–16 rows per statement and send them via `db.batch()`.
4. **Binance rate limits are weight-based and IP-shared** — read `X-MBX-USED-WEIGHT-1M`, honor `Retry-After` on 429, back off immediately (don't retry) on 418, and pace backfill requests (200–500ms apart) rather than firing them back-to-back.
5. **Lightweight Charts has no built-in multi-chart time-sync** — implement it manually via `subscribeVisibleLogicalRangeChange`/`setVisibleLogicalRange` (logical range, not time range, for gap-tolerance) with a re-entrancy guard to prevent feedback loops; test explicitly against datasets with missing candles.

Note: PITFALLS.md's Pitfall 2 ("Cron doesn't run in Pages Functions") assumes the original Pages+Workers split from the project's draft PLAN.md. Since STACK.md and ARCHITECTURE.md both independently recommend consolidating to a single Workers+Static-Assets project instead, that specific pitfall is avoided by construction — it's flagged here only so the roadmapper doesn't accidentally reintroduce the Pages split and reopen it.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Backend Foundation (D1 schema, Worker skeleton, Binance ingestion)
**Rationale:** Nothing else can be built or meaningfully tested without `/api/records` and `/api/klines` existing (even against empty tables), and the two highest-risk unknowns in the whole project (Binance reachability from Cloudflare, D1 bulk-insert limits) live entirely here — resolving them first avoids re-architecting later phases.
**Delivers:** Single Worker project (assets binding + Hono API router + `scheduled()` handler), D1 schema + migrations, `lib/db.ts` repository layer, `lib/binance.ts` client with backoff/pagination, cursor-paginated `/api/admin/backfill` endpoint, daily cron delta sync, full 2021→present historical backfill completed and verified gap-free.
**Addresses:** Kline backfill + daily cron sync (table stakes), record CRUD API (table stakes)
**Avoids:** Binance IP-block pitfall (spike test before building), naive backfill-loop pitfall, D1 bound-parameter pitfall, cron CPU/subrequest budget pitfall, rate-limit weight mishandling

### Phase 2: Records UI (CRUD, filters, dropdown time entry)
**Rationale:** Records depend only on the Phase 1 API, not on charts; building this next means the chart deep-link (Phase 3) has real records to link from and test against, rather than hand-typed query params.
**Delivers:** Records table page with create/edit/delete, type/tag filtering, UTC-explicit dropdown time pickers.
**Uses:** Hono API routes from Phase 1, Zod validation
**Implements:** Frontend Records component, JSON envelope pattern end-to-end
**Avoids:** D1 read-after-write staleness (use `INSERT ... RETURNING` instead of write-then-refetch), timezone-mismatch UX pitfall (explicit UTC labeling)

### Phase 3: Dual Kline Chart (candlesticks, time-sync, deep link)
**Rationale:** Requires both the kline API (Phase 1) and real records to deep-link from (Phase 2); this is also the most implementation-risky UI piece (manual chart-to-chart sync), so it benefits from being tackled once the simpler CRUD UI patterns are already proven.
**Delivers:** Two stacked Lightweight Charts instances (BTC/ETH) with time-synced scroll/zoom, log-scale toggle, record → chart deep link with time padding, visible "incomplete data" indicator for gaps.
**Uses:** Lightweight Charts v5 (standalone build), `/api/klines`
**Addresses:** Dual candlestick chart, time-sync, deep link, log-scale toggle (all table-stakes/differentiators)
**Avoids:** Chart time-sync feedback-loop pitfall (logical-range sync + re-entrancy guard, tested against gapped data)

### Phase 4: Leverage Calculator
**Rationale:** Fully decoupled from records/charts/backend — zero technical dependency on any other phase, sequenced last only because it matches the owner's stated priority order, not because of any blocking constraint. Could be built in parallel with Phase 2/3 if desired.
**Delivers:** Pure client-side long/short leverage calculator (margin/entry/SL/TP/leverage → R:R), with a liquidation-risk warning when stop-loss exceeds available margin.
**Addresses:** Position size / P&L / risk-reward calculator (table stakes)

### Phase 5: Access & Launch Hardening
**Rationale:** Auth is an infrastructure concern with no feature dependencies and doesn't interfere with local development (`wrangler dev` bypasses production Access policies), so it's cheapest to add last, right before going live with what may be a public repo.
**Delivers:** Cloudflare Access application configured at the zone/hostname level (One-Time-PIN, single-email allow policy) covering both the static UI and all `/api/*` routes; verified via unauthenticated curl test.
**Avoids:** "Access covers the site but not the API" security pitfall; secrets-in-public-repo pitfall (verify `.gitignore` covers `.dev.vars`/`.wrangler/`)

### Phase Ordering Rationale

- Backend-first ordering matches the feature dependency graph exactly: records UI needs the records API, chart UI needs both the klines API and real records to link from, calculator needs nothing, and Access wraps everything at the end.
- The two highest-risk platform unknowns (Binance reachability, D1 bulk-insert limits) are front-loaded into Phase 1 specifically so a required architecture change (e.g., moving Binance fetching to an external scheduler) doesn't ripple through UI phases already built on a wrong assumption.
- Grouping the cron/backfill logic together in Phase 1 (rather than splitting backfill into its own phase) reflects that they share the same underlying Binance client code — building one proves the other.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Needs a research-phase — the Binance-from-Cloudflare reachability question is unresolved without a live spike, and the correct fallback path (external fetcher vs. `data-api.binance.vision` vs. proxy) depends on that spike's outcome.
- **Phase 3:** Needs a research-phase — Lightweight Charts v5's exact API surface for logical-range sync (`subscribeVisibleLogicalRangeChange`/`setVisibleLogicalRange`) and gap-handling behavior should be verified against the installed v5.2.x version before implementation, since most public examples/tutorials are still v4-era.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Standard CRUD + JSON envelope + Zod validation pattern, already fully specified in existing PLAN.md API contracts.
- **Phase 4:** Pure client-side math with well-established leverage/R:R formulas already specified; no external integration risk.
- **Phase 5:** Cloudflare Access is dashboard configuration following a pattern the owner has already used successfully on a prior project (soapwavehealing).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Cloudflare platform facts (Workers/Assets/D1/Access) verified against current official docs; library choices (Hono, Lightweight Charts, Zod) verified via npm/official framework guides |
| Features | MEDIUM | Project-specific requirements are HIGH (sourced directly from owner-authored PROJECT.md/PLAN.md); general market landscape (trading journals, correlation tools, calculators) is LOW-tier web search used only for context/anti-feature validation |
| Architecture | HIGH (platform mechanics) / MEDIUM (feature-specific patterns) | Cloudflare Workers/D1/Cron mechanics verified against current docs and changelog; chart-sync and repository-layer patterns are sound but project-scale, not battle-tested at this exact scale in this exact repo |
| Pitfalls | HIGH | Cloudflare/Binance platform limits verified against current official docs; chart-library and community-reported issues (Binance IP-blocking, Pages/cron incompatibility) are MEDIUM but corroborated by multiple independent sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Binance reachability from Cloudflare Workers is unverified for this specific account/deployment** — must be resolved with a real deployed spike test in Phase 1 before backfill/cron logic is finalized; this is the single largest architectural unknown in the project.
- **Pages vs. single-Worker architecture decision needs to be locked in explicitly during roadmap/planning** — STACK.md/ARCHITECTURE.md recommend consolidating to one Workers+Assets project (which also sidesteps PITFALLS.md's Pages-cron incompatibility finding), but the project's own draft PLAN.md still describes the older split; the roadmapper/planner should treat the consolidated-Worker approach as the default unless the owner has a specific reason to prefer the split.
- **Lightweight Charts v5 API specifics for logical-range sync** should be confirmed against the actual installed version's docs during Phase 3 planning, since much of the public example code online still targets v4.

## Sources

### Primary (HIGH confidence)
- Cloudflare Workers/Static Assets docs — https://developers.cloudflare.com/workers/static-assets/
- Cloudflare D1 docs (pricing, limits, best practices, indexes) — https://developers.cloudflare.com/d1/
- Cloudflare Workers platform limits — https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Scheduled Handler docs — https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- Cloudflare One / Access self-hosted application docs — https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/
- Binance Open Platform REST API docs (klines, limits) — https://developers.binance.com/docs/binance-spot-api-docs/
- Lightweight Charts v4→v5 migration guide and npm package — https://tradingview.github.io/lightweight-charts/, https://www.npmjs.com/package/lightweight-charts
- Hono npm package + Cloudflare Workers framework guide
- SQLite floating point docs — https://sqlite.org/floatingpoint.html
- Project PROJECT.md and PLAN.md (owner-authored scope and API contracts)

### Secondary (MEDIUM confidence)
- Cloudflare Pages vs Workers 2026 comparison (morphllm.com) — architecture framing, consistent with official docs
- Cloudflare/Binance community forum reports of 451/403 blocking from Workers IPs (Cloudflare Community, Binance Developer Community) — corroborated across two independent forums
- Cloudflare Community threads on Cron Triggers not firing under Pages Functions
- Lightweight Charts GitHub issues #402 (no built-in multi-chart sync) and #1608 (crosshair sync scrolling glitch) — maintainer-tracked on official repo

### Tertiary (LOW confidence)
- Trading-journal product pages (TradesViz, Altrady, UltraTrader) — general feature-landscape context only, not project-specific
- SMT/correlation indicator pages (TrendSpider, Bitsgap blog, TradingView community script) — informs anti-feature rationale only
- Leverage calculator sites (positionsizecalculator.xyz, cryptoriskcalc.com) — confirms standard calculator output set, low novelty risk

---
*Research completed: 2026-08-30*
*Ready for roadmap: yes*
