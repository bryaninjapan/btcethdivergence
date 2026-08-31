# Pitfalls Research

**Domain:** Private crypto trading divergence-tracking tool on Cloudflare Workers + D1 + Pages, backed by Binance public REST API
**Researched:** 2026-08-30
**Confidence:** HIGH (Cloudflare/Binance platform limits verified against current official docs and community reports; chart-library specifics MEDIUM — verified against GitHub issues/docs but not hands-on tested in this repo)

## Critical Pitfalls

### Pitfall 1: Binance API rejects requests from Cloudflare's IPs (451 / geo-block)

**What goes wrong:**
The Worker's `fetch()` call to `api.binance.com` returns HTTP 451 ("Service unavailable from a restricted location") or a generic connection failure, even though the same request works fine from a home/laptop IP. The whole backfill and daily cron sync — the core data pipeline this project depends on — silently fails.

**Why it happens:**
Binance geo-blocks a list of "Restricted Locations" (US, Ontario, etc.) and, independently, has a long history of blocking known **datacenter/cloud IP ranges** outright regardless of declared location, because bots and arbitrage scrapers abuse them. Cloudflare Workers share IP pools across thousands of unrelated accounts/colocations, so which colo (and therefore which apparent country/ASN) handles a given `fetch()` is non-deterministic per-request. This is a well-documented, recurring problem reported on both the Cloudflare community forum ("Can't fetch Binance api") and Binance's own developer forum ("Can't fetch API from Cloudflare worker") — it is not a hypothetical edge case, it happens in practice and can be intermittent (works today, breaks tomorrow when traffic routes through a different edge node/IP).

**How to avoid:**
- Before committing to the architecture, do a throwaway `wrangler dev --remote` test that calls `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=5` from an actual deployed Worker (not `wrangler dev` local mode, which uses your machine's IP) and confirm you get 200, not 451/403.
- If blocked, mitigations in order of preference:
  1. Try alternate Binance hosts sometimes less aggressively blocked (`data-api.binance.vision` — Binance's read-only market-data mirror intended for this exact use case, no auth/IP-key needed).
  2. Run the fetch step outside Cloudflare (e.g., a scheduled GitHub Actions job, or a small VM/cron on a non-datacenter-flagged IP) that POSTs parsed candles to a `/api/admin/ingest` Worker endpoint backed by D1, decoupling "who calls Binance" from "who owns the database."
  3. As a last resort, route through a residential-IP proxy — adds cost/complexity, avoid unless 1–2 fail.
- Do this validation spike in Phase 1 (Backend Foundation), before writing the full cron/backfill logic — it determines the entire data-ingestion architecture.

**Warning signs:**
- `fetch()` to Binance succeeds locally via `wrangler dev` but fails after `wrangler deploy`.
- Intermittent 451/403 errors that weren't there yesterday (edge routing changed).
- Empty or partial kline backfill with no visible error in logs (silently caught exception).

**Phase to address:** Phase 1 (Backend Foundation) — must be resolved before backfill/cron logic is built, since it may change where the Binance-fetching code lives.

---

### Pitfall 2: Cron Triggers don't run in Cloudflare Pages Functions

**What goes wrong:**
The plan's architecture diagram shows a single "Workers (API)" box handling both HTTP routes and the cron sync. If the project is deployed as a Cloudflare **Pages** project (as implied by `pages.dev` URLs and static `public/` hosting) with `functions/` for the API, the cron sync will never run — Pages Functions cannot register Cron Triggers. This is confirmed directly by Cloudflare community threads and is a common "worked in Workers, broken in Pages" trap.

**Why it happens:**
Pages and Workers are still distinct deployment targets under the hood (despite UI convergence); Cron Triggers are a Workers-only primitive configured via `wrangler.toml [triggers]`, which has no Pages equivalent.

**How to avoid:**
Split the deployment explicitly and decide this in Phase 1, not later:
- **Static frontend + read API**: Cloudflare Pages with `functions/api/*` (or a Pages-attached Worker) for `GET/POST/PUT/DELETE /api/records` and `GET /api/klines` — same origin as the frontend, avoiding CORS.
- **Cron sync**: a separate, standalone Cloudflare Worker (own `wrangler.toml` with `[triggers] crons = [...]`) that shares the **same D1 database binding**. D1 bindings can be attached to multiple Workers/Pages projects simultaneously, so this is not a data-duplication problem — just two deployables instead of one.
- Document this as two deploy targets in the repo (`wrangler.toml` for the cron worker, Pages project config for the site+API) so it isn't "discovered" mid-Phase-1 after the single-worker plan is half-built.

**Warning signs:**
- `wrangler pages deploy` succeeds but scheduled events never fire (no cron logs in dashboard).
- Cron trigger configured in `wrangler.toml` but project was deployed via `wrangler pages deploy` instead of `wrangler deploy`.

**Phase to address:** Phase 1 (Backend Foundation) — architecture must split cron-worker vs. Pages+API before implementation starts.

---

### Pitfall 3: D1 bound-parameter limit breaks naive batch inserts during backfill

**What goes wrong:**
The backfill needs to insert ~87,600 rows (2 symbols × ~43,800 hourly candles). A naive implementation either (a) does one `INSERT` per row in a loop with `await` each time — extremely slow, burns CPU time/subrequest budget, and risks hitting the cron CPU-time cap — or (b) tries one giant multi-row `INSERT ... VALUES (...),(...),(...)` for all 1000 candles from a single Binance page, which fails because D1/SQLite caps **bound parameters at 100 per statement** (with 6 columns per row, that's ~16 rows per statement) and caps **SQL statement length at 100KB**.

**Why it happens:**
D1 inherits SQLite's `SQLITE_LIMIT_VARIABLE_NUMBER` (100), which is easy to miss until a bulk insert throws `too many SQL variables` in production against real data volume — it won't surface in small manual tests with a handful of rows.

**How to avoid:**
- Chunk inserts to stay under 100 bound params (e.g., 10–16 rows per multi-row `INSERT`), and use `db.batch([stmt1, stmt2, ...])` to send the chunked statements in a single round trip rather than awaiting each one sequentially — this is the D1-idiomatic way to bulk-load and is dramatically faster than per-row `.run()`.
- Use `INSERT OR IGNORE` (already planned) keyed on `(symbol, open_time)` so re-running backfill/cron is idempotent.
- For the very first historical backfill (2021→now), run it as an explicit one-off admin endpoint or local script rather than cramming it into a daily cron invocation — cron's CPU-time budget (see Pitfall 4) is not designed for a 43,800-row historical load.

**Warning signs:**
- `D1_ERROR: too many SQL variables` or `LibsqlError` during backfill testing with real (not toy) data volumes.
- Backfill "works" in dev with 50 test rows but never gets load-tested at full 1000-row Binance page size before deploy.

**Phase to address:** Phase 1 (Backend Foundation) — write the batch-insert helper with chunking + `db.batch()` from the start; don't retrofit after backfill fails at scale.

---

### Pitfall 4: Cron CPU-time and subrequest limits silently truncate the sync job

**What goes wrong:**
The plan assumes "30s CPU time limit on free plan, 15min on paid" for cron. The actual current limits are stricter and different: **Workers Free plan cron invocations get only 10ms of CPU time** (same tiny budget as any free-plan request) and are capped at **50 external subrequests per invocation**. Paid plan gives up to 30s CPU for schedules more frequent than hourly, or up to 15 minutes wall-clock (with up to 5 min CPU) for hourly-or-longer schedules — but only on Paid. A once-daily sync fetching ~2 symbols × up to a few dozen pages (in the worst case where the site is offline for days) can exceed either the CPU budget (parsing/inserting) or the 50-external-subrequest cap if not chunked carefully, especially on the free tier.

**Why it happens:**
The 30s/15min numbers commonly quoted around the web (and evidently baked into this project's plan) apply to the Paid plan and to wall-clock duration, not CPU time, and not the Free plan default. It's an easy, very common mix-up.

**How to avoid:**
- Confirm which Workers plan (Free vs Paid) this project runs on and design the cron job's per-invocation batch size accordingly. Given free-tier's 10ms CPU / 50-subrequest ceiling, plan for the daily cron to fetch **at most a handful of Binance pages per symbol per run** (normal daily catch-up is only ~24 candles = 1 request per symbol, well within budget) and to be resilient to "there's a multi-day gap to fill," in which case it should catch up incrementally over several days or via a manual admin endpoint rather than trying to do it all in one cron tick.
- Keep the historical 2021+ backfill entirely out of the cron path (see Pitfall 3) — run it via a one-off manual endpoint or local script, not as "cron will just do the first run."
- Log `X-MBX-USED-WEIGHT-1M` from Binance responses and D1 write counts so you can see if a cron run is getting close to the ceiling before it starts silently failing.

**Warning signs:**
- Cron job logs show incomplete backfill runs (fewer rows than expected) with no explicit error — CPU-time exhaustion can terminate execution abruptly.
- Works fine day-to-day (small catch-up) but fails specifically after downtime (large gap to fill).

**Phase to address:** Phase 1 (Backend Foundation) — size the cron job's per-run work against the actual Workers plan limits, and build a separate backfill path.

---

### Pitfall 5: Binance rate-limit weight is per-request-size, not per-request-count

**What goes wrong:**
The plan's estimate ("~44 requests per symbol" for full 2021–2026 backfill, staying well under 1200/min) is directionally fine for backfill, but a naive implementation that fires all ~88 requests back-to-back without any pacing can still trip Binance's rate limiter, because kline requests are weighted (pulling 1000 candles costs weight 5, not 1) and the limit is enforced **per IP**, not per API key — and Cloudflare Workers egress IPs are shared across many tenants' traffic, so the "budget" may already be partially consumed by unrelated traffic before your Worker's first request.

**Why it happens:**
Developers reason in "number of my own requests" rather than "shared IP weight budget," and don't implement backoff until they've already been burned by a 429 (or worse, an escalating 418 ban of 2 minutes to 3 days).

**How to avoid:**
- Read the `X-MBX-USED-WEIGHT-1M` response header on every Binance call and back off proactively (not just reactively) when it climbs, rather than waiting for a 429.
- On 429, honor the `Retry-After` header exactly rather than a hardcoded 60s guess (the plan currently hardcodes 60s — fine as a floor, but should read the header if present).
- On 418 (IP auto-ban), stop immediately and back off for the duration in `Retry-After` — retrying during a 418 ban extends it.
- Add small delays between consecutive backfill page requests (e.g., 200–500ms) rather than firing all ~44 requests per symbol as fast as possible — this alone avoids the vast majority of real-world 429s at this project's scale.

**Warning signs:**
- Backfill works reliably on a "clean" Cloudflare account/day but intermittently 429s in the evening or under other load — a sign the shared-IP weight budget is being consumed by unrelated tenants.

**Phase to address:** Phase 1 (Backend Foundation), inside the Binance API client (`lib/binance.ts`).

---

### Pitfall 6: Lightweight Charts time-sync between two independent chart instances isn't built-in

**What goes wrong:**
The plan requires two separate `createChart()` instances (BTC, ETH) whose pan/zoom stay in lock-step. Developers often assume `timeScale()` sync is a first-class library feature; it is not — TradingView's own GitHub issues confirm there's no built-in multi-chart time-scale sync API, and naive attempts (mirroring `visibleTimeRange` via events) can create feedback loops where Chart A's change fires Chart B's change which fires back on Chart A, causing jitter or infinite update loops.

**Why it happens:**
The library is intentionally single-chart-scoped; cross-chart sync is a documented "roll your own" pattern (subscribe to `timeScale().subscribeVisibleLogicalRangeChange()` on one chart and apply `setVisibleLogicalRange()` on the other), and needs a re-entrancy guard.

**How to avoid:**
- Use `subscribeVisibleLogicalRangeChange` (logical range, not time range, to keep candle alignment correct even with slightly different data availability between BTC/ETH) on both charts, and add a simple "is currently syncing" boolean flag to prevent the mutual-update feedback loop.
- Test the sync specifically with datasets that have gaps (e.g., one symbol missing a candle the other has) — logical-range sync degrades gracefully here; naive time-range sync can misalign the two charts.
- If crosshair sync (matching the vertical line position across charts) is also wanted later, that's a separate mechanism (`setCrosshairPosition`) with its own known scrolling glitches (GitHub issue #1608) — treat it as optional polish, not required for MVP, since it's out of scope per PROJECT.md's "no chart interaction to feed the calculator."

**Warning signs:**
- Charts jitter or drift out of sync during fast scroll/zoom.
- Sync works when both charts have identical time ranges of data but breaks near the edges of available history (2021 boundary) or around gaps.

**Phase to address:** Phase 3 (Dual Kline Chart).

---

### Pitfall 7: D1 read-after-write staleness if using read replication

**What goes wrong:**
D1 supports read replication for scaling reads; if enabled, a read immediately following a write (e.g., the frontend re-fetching `/api/records` right after a `POST`, or the daily cron writing then the chart page reading new candles) can hit a stale replica and appear as though the write didn't happen.

**Why it happens:**
Read replicas propagate asynchronously; without pinning a session to the primary (D1 Sessions API with a "first unconstrained" or bookmark-based session), a client can bounce between replicas.

**How to avoid:**
- At this project's scale (single user, low write volume, D1 default is a single primary unless you explicitly opt into Sessions API), this is unlikely to bite — but if any endpoint chains a write immediately followed by a read of the same data (e.g., "create record then immediately return it"), just return the written row directly from the `INSERT ... RETURNING` result instead of re-querying, sidestepping the issue entirely regardless of replication config.

**Warning signs:**
- Newly created/edited records occasionally "don't show up" until a page refresh a few seconds later.

**Phase to address:** Phase 2 (Records Table) — use `RETURNING` on writes rather than write-then-refetch patterns.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| One `INSERT` per row in a loop instead of `db.batch()` chunking | Simpler code to write first | Backfill of 87K rows becomes painfully slow and risks CPU-time cutoff mid-run, leaving partial data | Never for backfill; borderline OK only for the tiny daily catch-up (≤24 rows/symbol) |
| Hardcoding Binance backoff to a flat 60s on 429 | Fast to implement | Ignores `Retry-After`, either waits too long (wastes cron budget) or not long enough (risks 418 ban escalation) | Acceptable as a fallback default when header is missing, never as the only strategy |
| Storing OHLC prices as SQLite `REAL` without normalizing | Matches Binance's response format directly | IEEE-754 float rounding can produce tiny display discrepancies (e.g., trailing `.0000000001`) on chart tooltips | Acceptable here — this is a display/analysis tool, not a settlement system; just round for display, don't chase exact precision |
| Single combined Worker doing both API routes and cron | Fewer moving parts to reason about initially | Breaks entirely once deployed via Pages (Pitfall 2) or once cron work grows past CPU budget shared with API traffic | Never — split from Phase 1 |
| Skipping the "does Binance even answer from Cloudflare" spike | Feels like progress (writing real feature code sooner) | Entire data pipeline may need re-architecture (external fetcher) after Phase 1 is "done" | Never — do the spike first |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Binance public REST API | Assuming Cloudflare Workers can always reach `api.binance.com` | Validate with a real deployed `fetch()` test in Phase 1; have `data-api.binance.vision` or an external-fetcher fallback ready |
| Cloudflare D1 | Looping individual `.run()` calls for bulk insert | Use `db.batch([...])` with chunks under the 100-bound-parameter limit |
| Cloudflare Cron Triggers | Assuming cron works the same in a Pages project as in a Workers project | Deploy cron as a standalone Worker sharing the D1 binding; Pages Functions cannot register Cron Triggers |
| Cloudflare Access | Protecting only the Pages hostname and forgetting a separately-hosted API Worker's hostname | Put both frontend and API behind the same Access application/hostname (prefer same-origin API via Pages Functions or a Worker route on the same zone) so one login covers both |
| Lightweight Charts | Assuming multi-chart time sync is built into the library | Implement `subscribeVisibleLogicalRangeChange` + `setVisibleLogicalRange` manually with a re-entrancy guard |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Per-row D1 inserts during backfill | Backfill takes minutes-to-hours, may not finish inside a single invocation | Batch inserts (10–16 rows/statement) via `db.batch()` | Immediately at full 87K-row backfill scale, not visible with small test data |
| Fetching full unbounded kline ranges for `/api/klines` | Slow API responses, large JSON payloads to the browser as history grows | The API already takes `start`/`end` — enforce a sane max range server-side (e.g., cap to a few thousand candles per request) so a mistaken huge range from the frontend doesn't return tens of thousands of rows | Becomes noticeable once several years of 1h data (43K+ candles/symbol) are queried in one go |
| Loading Lightweight Charts data by re-fetching entire dataset on every pan/zoom | Chart feels laggy, redundant API calls, hits D1 read volume unnecessarily | Fetch a padded window once per navigation (as planned: 24h before/after) rather than on every scroll tick | Noticeable once scrolling through years of history interactively |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deploying the API worker/route without Cloudflare Access covering it (only protecting the static Pages site) | Klines/records API is publicly readable/writable even though the "site" looks password-gated | Verify the Access policy's hostname/path match covers `/api/*` too — test by curling the API route unauthenticated after setup |
| No server-side input validation on `/api/records` (relying on frontend dropdowns to always send valid data) | A stray manual `curl POST` (or a future frontend bug) could insert bad `type` values, huge `notes`/`tags`, or `start_time > end_time` rows into D1 | Enforce the validation rules already specified in PLAN.md (`type` enum, length limits, time ordering) in the Worker itself, not just the UI |
| Treating "public GitHub repo" as fine because "Access protects it" | Repo being public means the D1 schema, API contracts, and Binance-fetch logic are visible; if `wrangler.toml` or `.dev.vars` accidentally includes an account ID, zone ID, or (if ever added later) an API key, it leaks | Keep secrets out of the repo entirely (use `wrangler secret put` / Cloudflare dashboard env vars), double-check `.gitignore` covers `.dev.vars` and `.wrangler/` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Dropdown time pickers using the browser's local timezone while Binance candles are UTC-aligned | User picks "2024-01-15 18:00" expecting it to match a specific UTC candle, but it's off by their local UTC offset, causing the "View Chart" deep link to load the wrong window | Make all dropdown time inputs explicitly UTC (label them as such) and convert only for the final display timestamp, never for the stored/queried value |
| `/api/klines` "returns what's available" silently on gaps (as planned) with no visible frontend indicator | User can't tell if a flat/missing chart segment means "no divergence happened" or "data hasn't been fetched yet" | Surface the "incomplete data" warning the plan already anticipates — show a visible banner/marker on the chart for any requested range not fully covered by cached klines, not just log it |
| Leverage calculator allowing stop-loss beyond position size (e.g., >100% loss with high leverage) without clear liquidation-style warning | User could read "-150%" as just a big number rather than realizing the position would be liquidated before reaching that stop | Since 100x is a stated default, add an explicit "this stop-loss exceeds available margin — position would be liquidated first" warning when `lossRate > 100%` |

## "Looks Done But Isn't" Checklist

- [ ] **Backfill:** "It backfilled some data" is not the same as "it backfilled all ~43,800 candles per symbol with no gaps" — verify by counting rows and checking for consecutive `open_time` gaps (`open_time` deltas should all equal 3600s), not just eyeballing the chart.
- [ ] **Cron sync:** Confirm the cron actually fires on schedule in the deployed (not local dev) environment, and specifically confirm it's registered on a Worker, not a Pages project (Pitfall 2) — check the Cloudflare dashboard's Cron Triggers panel, don't just trust `wrangler.toml`.
- [ ] **Cloudflare Access:** "Site asks for a password" is not the same as "every API route also requires auth" — test `/api/records` requires auth (curl returns 302), but `/api/klines` should be public (curl returns 200 with data) after setup.
- [ ] **Chart sync:** "Charts scroll together on the happy path" is not the same as "charts stay in sync when one symbol has a data gap the other doesn't" — test with a deliberately incomplete range.
- [ ] **Time zone consistency:** "Records save and display correctly" is not the same as "the time saved matches the actual UTC candle you were looking at" — cross-check a manually created record's timestamp against the exact Binance candle boundary.
- [ ] **Duplicate-safe cron re-runs:** "Cron ran and inserted data" is not the same as "cron can be safely re-run/retried without creating duplicate or corrupted rows" — verify `INSERT OR IGNORE` behavior by manually re-triggering the sync twice in a row.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Binance blocks Cloudflare IPs (Pitfall 1) discovered mid-project | MEDIUM | Move only the fetch step to an external scheduler (GitHub Actions free tier is sufficient at this volume) posting to a `/api/admin/ingest` endpoint; D1/Workers API layer is unaffected |
| Cron never fires because deployed via Pages (Pitfall 2) | LOW | Extract cron logic into a standalone Worker with its own `wrangler.toml`, reuse the same D1 binding — no schema or API changes needed |
| Backfill partially completed then failed on bound-parameter error (Pitfall 3) | LOW | `INSERT OR IGNORE` + `(symbol, open_time)` primary key makes re-running the (now-fixed, chunked) backfill idempotent — just re-run it |
| Two charts drift out of sync in production (Pitfall 6) | LOW | Swap time-range-based sync for logical-range-based sync with a re-entrancy guard; isolated to `chart.js`, no backend changes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Binance blocks Cloudflare IPs | Phase 1 | Deployed (not local) `fetch()` spike to `api.binance.com` returns 200 before writing full backfill logic |
| Cron doesn't run under Pages | Phase 1 | Cron Worker deployed separately; Cloudflare dashboard shows scheduled invocations firing |
| D1 bound-parameter limit breaks bulk insert | Phase 1 | Full 1000-row Binance page insert tested via `db.batch()` with chunking, not just small manual test data |
| Cron CPU-time/subrequest budget exceeded | Phase 1 | Backfill run as separate one-off path; daily cron sized to normal ≤24-candle catch-up |
| Binance rate-limit weight mishandled | Phase 1 | Backfill client reads `X-MBX-USED-WEIGHT-1M` and honors `Retry-After`; paced requests, not a tight loop |
| D1 read-after-write staleness | Phase 2 | POST/PUT endpoints use `RETURNING` instead of write-then-refetch |
| Chart time-sync feedback loops / gap handling | Phase 3 | Sync tested against a deliberately gapped dataset, not just a clean continuous range |
| Access not covering API routes | Phase 5 | Unauthenticated curl against `/api/records` is rejected (302 redirect); `/api/klines` is public (200 with data) |

## Sources

- [LIMITS | Binance Open Platform](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits) — HIGH confidence (official docs)
- [binance-spot-api-docs/rest-api.md (GitHub)](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md) — HIGH confidence (official docs)
- [How to Avoid Getting Banned by Rate Limits — Binance Academy](https://academy.binance.com/en/articles/how-to-avoid-getting-banned-by-rate-limits) — HIGH confidence (official)
- [Cloudflare D1 limits — developers.cloudflare.com/d1/platform/limits](https://developers.cloudflare.com/d1/platform/limits) — HIGH confidence (official docs)
- [Cloudflare D1 FAQ — developers.cloudflare.com/d1/reference/faq](https://developers.cloudflare.com/d1/reference/faq) — HIGH confidence (official docs)
- [Cloudflare Workers limits — developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits) — HIGH confidence (official docs)
- [Cloudflare Workers Cron Triggers: limits, minimum interval, and the external fix](https://crontap.com/blog/cloudflare-workers-cron-minute-limit) — MEDIUM confidence (third-party, cross-checked against official limits page)
- [Can't fetch Binance api — Cloudflare Community](https://community.cloudflare.com/t/cant-fetch-binance-api/268988) — MEDIUM confidence (community-reported, but corroborated by a second independent source below)
- [Can't fetch API from Cloudflare worker — Binance Developer Community](https://dev.binance.vision/t/cant-fetch-api-from-cloudflare-worker/3638) — MEDIUM confidence (community-reported on Binance's own developer forum, corroborates the Cloudflare-side report)
- [HTTP 451 error and VPS location — Binance Developer Community](https://dev.binance.vision/t/http-451-error-and-vps-location/14685) — MEDIUM confidence (community-reported, official forum)
- [Periodic database update in Cloudflare Pages project — Cloudflare Community](https://community.cloudflare.com/t/periodic-database-update-in-cloudflare-pages-project/738460) — MEDIUM confidence (community, consistent with official docs' lack of Pages+cron support)
- [Cron Triggers in pages — Cloudflare Community](https://community.cloudflare.com/t/cron-triggers-in-pages/430734) — MEDIUM confidence (community)
- [Can multiple charts be synchronized by time-axis? · Issue #402 — tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts/issues/402) — HIGH confidence (maintainer-tracked issue on official repo)
- [Issue when scrolling charts with synced crosshair · Issue #1608 — tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts/issues/1608) — HIGH confidence (maintainer-tracked issue on official repo)
- [Set crosshair position — Lightweight Charts official tutorial](https://tradingview.github.io/lightweight-charts/tutorials/how_to/set-crosshair-position) — HIGH confidence (official docs)
- [SQLite Floating Point Numbers — sqlite.org](https://sqlite.org/floatingpoint.html) — HIGH confidence (official SQLite docs, applies directly to D1's SQLite engine)

---
*Pitfalls research for: Private crypto divergence-tracking tool (Cloudflare Workers/D1/Pages + Binance API)*
*Researched: 2026-08-30*
