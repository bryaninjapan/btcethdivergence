# Stack Research

**Domain:** Private crypto trading analysis tool (candlestick charts, cached market data, leverage calculator)
**Researched:** 2026-08-30
**Confidence:** HIGH (Cloudflare platform facts verified via current docs/web search; project-specific fit is opinion built on verified facts)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Cloudflare Workers (with **Static Assets**) | Runtime: `compatibility_date` ≥ 2025-XX (use latest at deploy time), CLI: `wrangler` 4.x | Single deployment that serves the static frontend AND the API/cron logic | Cloudflare's own guidance as of 2026: "For new projects, start with Workers" — static assets are now a first-class Workers feature (`assets` binding in `wrangler.jsonc`), and all further investment goes to Workers, not Pages. One `wrangler deploy` ships HTML/CSS/JS + API + cron in one unit, one config file, one dashboard entry — simpler than managing a separate Pages project wired to a separate Workers project, which is what the original PLAN.md architecture diagram describes. Static asset requests are **not billed**, so cost profile is unchanged from Pages. |
| Cloudflare D1 | Current GA release (SQLite-compatible, accessed via `wrangler d1` / D1 binding) | Persistent storage for `klines` and `divergence_records` | Already the user's chosen DB (per PROJECT.md) and the right call: ~87,600 rows of kline data is trivially small for D1 (free tier: 5 GB storage, 5M rows read/day, 100K rows written/day — this project will use well under 1% of any of those). No separate DB service to provision or pay for. |
| Cloudflare Access | Zero Trust (Access), free for ≤50 users | Password/auth gate in front of the whole site | Matches the user's existing pattern from the `soapwavehealing` project. **Important nuance:** Access's simplest built-in auth is **email one-time PIN (OTP)**, not a literal typed password — you add the app as "Self-hosted," pick a hostname, and set an Allow policy scoped to the owner's email. If a literal static password (not email OTP) is truly required, that needs a custom check in the Worker itself (e.g., a shared-secret cookie) — recommend defaulting to Access + email OTP since it is zero extra code and the user already trusts it. |
| Hono | 4.13.x | Worker-side routing (`GET/POST/PUT/DELETE /api/records`, `GET /api/klines`, cron handler, admin backfill route) | De facto standard router for Cloudflare Workers in 2026 — tiny (~12 KB via `hono/tiny`), built on Web Standard `Request`/`Response`, first-class D1 middleware support, and used directly by `npm create cloudflare -- --template=hono`. A 5-endpoint API does not *need* a framework, but Hono's built-in JSON helpers, route params, and typed bindings remove boilerplate with near-zero cost — recommended over hand-rolled `switch(url.pathname)` routing for maintainability. |
| TradingView Lightweight Charts | **v5.2.x** (`lightweight-charts` on npm) | Candlestick rendering for the dual BTC/ETH chart page | Open source, no API key (matches PROJECT.md constraint), purpose-built for OHLC candlestick data, and small (~45 KB gzipped). v5 is current — v4 is the previous major and still works but is not where new features/fixes land. |
| Zod | 3.x (or 4.x if already adopted elsewhere) | Validate `POST/PUT /api/records` request bodies at the Worker boundary | Matches the user's global coding rule ("ALWAYS validate at system boundaries... use schema-based validation"). Small, works fine in the Workers runtime (pure JS, no Node APIs), and gives one place to enforce `type ∈ {time_lag, structural, opposite}`, `notes` ≤ 1000 chars, `tags` ≤ 200 chars, `start_time < end_time` instead of scattering manual `if` checks across route handlers. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@cloudflare/workers-types` | latest matching `wrangler` major | TypeScript types for `D1Database`, `ScheduledEvent`, `Fetcher`, etc. | Always, if writing the Worker in TypeScript (recommended — this project has a typed schema and typed API contracts already specified in PLAN.md). |
| Native `fetch()` (built into Workers runtime) | n/a | Calling the Binance REST API from the cron/backfill handler | No HTTP client library needed — Workers' native `fetch` is sufficient for simple GET requests to `api.binance.com`. Do not add `axios` — it adds bundle size for zero benefit in this runtime. |
| D1 prepared statements + `db.batch()` | built into the `D1Database` binding | Bulk-inserting up to 1000 klines per Binance page in one round trip | Use `db.batch([...statements])` for backfill inserts instead of one `db.prepare(...).run()` per row — batches are dramatically cheaper in both latency and CPU time, which matters directly against the Workers free-plan CPU budget (see Pitfalls). |
| Vitest + `@cloudflare/vitest-pool-workers` | Vitest 2.x/3.x + latest pool-workers | Unit/integration tests for the Worker routes and Binance-parsing logic against a real Miniflare-simulated D1 | Cloudflare's own recommended test setup for Workers projects; runs your actual Worker code (not a mock) against a local D1 instance — use for the API route logic and the kline-parsing/backfill-pagination code, which is exactly the kind of logic likely to have off-by-one bugs. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Wrangler CLI (4.x) | Local dev server (`wrangler dev`), D1 migrations, deploys, cron testing | Config file should be `wrangler.jsonc` (Cloudflare's current recommended format over `wrangler.toml`, though `.toml` is still fully supported if the user is already familiar with it from `soapwavehealing`). Note: `wrangler d1 execute`/`migrations apply` dropped the `--batch-size` flag in v4 — don't copy old command examples that use it. |
| `wrangler d1 migrations create` / `apply` | Versioned schema changes for `klines` and `divergence_records` | Use from day one instead of hand-run `.sql` files — `wrangler` auto-captures a backup before applying, and it keeps schema history reviewable in git. |
| TypeScript | Type the D1 rows, API request/response shapes, and Binance kline tuples | The Binance kline response is an untyped array-of-arrays (`[openTime, open, high, low, close, volume, closeTime, ...]`) — wrapping it in a typed parser function is the single highest-leverage thing to type, since a misindexed field here silently corrupts the whole chart. |

## Installation

```bash
# Core
npm install hono zod

# Dev dependencies
npm install -D wrangler typescript @cloudflare/workers-types vitest @cloudflare/vitest-pool-workers

# Frontend (no install — loaded via CDN <script> tag per project's "no build step" constraint)
# <script src="https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"></script>
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Workers with Static Assets (single project) | Cloudflare Pages + separate Workers project (PLAN.md's original diagram) | If the user's Google-AI-Studio-generated frontend workflow assumes a classic Pages git-push auto-deploy flow and they'd rather not touch `wrangler.jsonc` for the frontend at all. Pages is still fully supported — this is a "simpler forever" choice, not a "must migrate" one. |
| Hono | Plain `switch`/if-else router on raw `fetch(request)` | If the user (self-described as unfamiliar with backend/architecture) wants the absolute minimum number of new concepts — a hand-rolled router for 5 routes is genuinely fine and removes one dependency to learn. |
| Lightweight Charts v5 (standalone/UMD build) | Lightweight Charts v4 | Only if copying example code from older tutorials that use `chart.addCandlestickSeries(...)` — that v4 method does not exist in v5 (replaced by `chart.addSeries(LightweightCharts.CandlestickSeries, {...})`). Don't mix v4 examples with a v5 install. |
| D1 (SQLite) | Cloudflare Durable Objects SQLite, or an external Postgres (Supabase/Neon) | Only if data volume were expected to grow past D1's 10 GB practical ceiling or need multi-region strong consistency — neither applies here (~87K rows, single owner, single region access pattern). |
| Zod for validation | Manual `if` validation in each route | Zod is a very light dependency; manual checks are acceptable only if the user wants literally zero new libraries beyond Hono. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chart.addCandlestickSeries()` (Lightweight Charts v4 API) with a v5 package install | v5 removed all the `add*Series()` convenience methods; mixing v4-style code snippets (common in older blog posts/AI-generated examples) with a v5 install throws a runtime error (`addCandlestickSeries is not a function`) | `chart.addSeries(LightweightCharts.CandlestickSeries, {...})` (v5 API, confirmed via official v4→v5 migration guide) |
| Looping all ~88 Binance backfill requests inside a single Worker invocation (single cron tick or single `POST /api/admin/backfill` call doing the whole 2021→2026 range) | Workers free plan caps CPU time at **10 ms per invocation** (paid plan: default 30s, up to 5 min) and free plan also caps subrequests at 50/invocation — a full backfill loop will hit one or both limits and fail partway, with **no automatic retry** on cron failures | Design the backfill endpoint to fetch **one page (≤1000 candles) per invocation** and paginate by calling it repeatedly (e.g., a small local shell/curl loop the owner runs once), OR temporarily flip to the $5/mo Workers Paid plan for the one-time backfill day and drop back to Free afterward — daily incremental cron syncs (a handful of new candles/day) will comfortably fit in the Free plan's limits going forward. |
| `axios` or other Node-oriented HTTP clients in the Worker | Workers runtime is a Web-standard/V8-isolate environment, not Node — Node-only HTTP libraries add bundle size and can hit compatibility issues; native `fetch` already does everything needed here | Built-in `fetch()` |
| `wrangler.toml` examples that pass `--batch-size` to `d1 execute`/`d1 migrations apply` | Flag was removed in Wrangler v4 — copying older tutorial commands verbatim will error | Omit the flag; batch sizing for `d1 execute --file` is handled automatically in v4 |
| Cloudflare Access configured only with a "password" mental model and no policy review | Access is deny-by-default and policy-driven; if the Allow policy is misconfigured (e.g., accidentally scoped to "everyone" or a wrong IdP), the "private" tool becomes public | Explicitly scope the Access policy's Allow rule to the owner's specific email (or Access's one-time-PIN email-based login), and verify with an incognito-window test after setup, same as the deploy-verification habit already established for `soapwavehealing` |

## Stack Patterns by Variant

**If keeping the original Pages + separate Workers split (per PLAN.md's existing diagram):**
- Use two `wrangler` deploys — one for the Pages static site, one for the Workers API (bound to Pages via `_routes.json` or a custom domain path split)
- Because the user may already have muscle memory from `soapwavehealing` on that exact pattern, and it is still fully supported — just note it is the "legacy-but-fine" path, not the currently-recommended one.

**If consolidating to Workers + Static Assets (recommended):**
- Use a single `wrangler.jsonc` with an `assets` block pointing at `public/` and `main` pointing at `src/worker/index.ts`
- Because it collapses the architecture in PLAN.md's diagram from two Cloudflare products to one, with no functional loss for a single-owner private tool.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `wrangler@4.x` | `wrangler.jsonc` (recommended) or `wrangler.toml` (still supported) | v4 dropped the `--batch-size` flag on `d1 execute` / `d1 migrations apply` — verify any copied CLI commands against current docs before running. |
| `lightweight-charts@5.2.x` | ESM (`import { createChart, CandlestickSeries } from 'lightweight-charts'`) or standalone UMD (`<script>` + `window.LightweightCharts.CandlestickSeries`) | This project's "no build step" constraint means the **standalone UMD build** is the right choice, not the ESM import — confirm any AI-Studio-generated frontend code uses `LightweightCharts.createChart(...)` + `chart.addSeries(LightweightCharts.CandlestickSeries, ...)`, not v4-style `addCandlestickSeries()`. |
| `hono@4.x` | Cloudflare Workers runtime (any recent `compatibility_date`) | No known incompatibilities; officially supported target runtime. |
| D1 | SQLite dialect (not 100% Postgres/MySQL syntax) | Schema in PLAN.md already uses SQLite-appropriate types (`INTEGER`, `REAL`, `TEXT`) and `AUTOINCREMENT` — no changes needed. |

## Sources

- [Static Assets · Cloudflare Workers docs](https://developers.cloudflare.com/workers/static-assets/) — HIGH confidence, official docs
- [Migrate from Pages to Workers · Cloudflare Workers docs](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) — HIGH confidence, official docs
- [Your frontend, backend, and database — now in one Cloudflare Worker | Cloudflare Blog](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/) — HIGH confidence, official vendor blog, confirms "for new projects, start with Workers" guidance
- [Cloudflare D1 docs — Pricing](https://developers.cloudflare.com/d1/platform/pricing/) — HIGH confidence, official docs (free tier: 5GB storage, 5M rows read/day, 100K rows written/day)
- [Use indexes · Cloudflare D1 docs](https://developers.cloudflare.com/d1/best-practices/use-indexes/) — HIGH confidence, official docs
- [Cloudflare Workers Limits · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/limits/) — HIGH confidence, official docs (Free: 10ms CPU/invocation, 50 subrequests; Paid: up to 5min CPU, 10K subrequests)
- [Scheduled Handler · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/) — HIGH confidence, official docs (cron: 1-minute granularity, no automatic retry on failure)
- [Publish a self-hosted application · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) — HIGH confidence, official docs
- [From v4 to v5 | Lightweight Charts migration guide](https://tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5) — HIGH confidence, official library docs
- [lightweight-charts - npm](https://www.npmjs.com/package/lightweight-charts) — HIGH confidence, official package registry, current version 5.2.1
- [wrangler - npm](https://www.npmjs.com/package/wrangler) — HIGH confidence, official package registry, current version 4.127.x
- [Wrangler commands · Cloudflare D1 docs](https://developers.cloudflare.com/d1/wrangler-commands/) — HIGH confidence, official docs
- [Kline/Candlestick Data · Binance Open Platform docs](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints) — HIGH confidence, official API docs (klines endpoint weight 2, no API key required for public market data)
- [hono - npm](https://www.npmjs.com/package/hono) — HIGH confidence, official package registry, current version 4.13.x
- [Hono · Cloudflare Workers framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/) — HIGH confidence, official Cloudflare docs listing Hono as a supported framework

---
*Stack research for: private crypto trading divergence analysis tool*
*Researched: 2026-08-30*
