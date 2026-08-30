# Architecture Research

**Domain:** Personal crypto trading analysis tool (kline caching + manual divergence logging) on Cloudflare
**Researched:** 2026-08-30
**Confidence:** HIGH (Cloudflare platform mechanics, verified against current docs/changelog) / MEDIUM (feature-specific patterns, single-project scale)

## Standard Architecture

### System Overview

The project's own `PLAN.md` sketches "Pages (static) + Workers (API) + D1", but **current Cloudflare guidance (2024–2026) is to build this as a single Workers project with static assets**, not a split Pages+Workers deployment. Pages is not being killed, but all new capability investment (Cron Triggers, Queues, gradual deployments, better observability, the Vite plugin) lands on Workers first, and static asset serving on Workers is free and CDN-cached exactly like Pages. For a greenfield 2026 project, splitting into two deployables buys nothing and costs you two dashboards, two configs, and CORS/same-origin complexity between them.

Recommended shape:

```
┌───────────────────────────────────────────────────────────────────┐
│                     Cloudflare Access (Zero Trust)                  │
│         One-Time-PIN policy, allow-list = owner's email             │
│              Gates ALL routes on the zone/hostname                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    Single Cloudflare Worker (btcethdivergence)       │
│                                                                       │
│  ┌───────────────────┐   ┌──────────────────────────────────────┐  │
│  │  Static Assets     │   │  fetch() handler (API router)         │  │
│  │  (wrangler assets) │   │                                       │  │
│  │  index.html        │   │  GET  /api/klines                    │  │
│  │  chart.html        │   │  GET  /api/records                    │  │
│  │  calculator.html   │   │  POST /api/records                    │  │
│  │  js/ css/          │   │  PUT  /api/records/:id                │  │
│  │                     │   │  DELETE /api/records/:id              │  │
│  │  served free from   │   │  POST /api/admin/backfill  (guarded)  │  │
│  │  edge, no CPU used  │   └───────────────┬──────────────────────┘  │
│  └────────────────────┘                    │                          │
│                                             │                          │
│  ┌───────────────────────────────────────▼───────────────────────┐  │
│  │  scheduled() handler — Cron Trigger (daily, 01:00 UTC)          │  │
│  │  fetches only the small "since last close" delta per symbol     │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼────────────────────────────────────┘
                                   │
                        ┌──────────▼─────────────┐
                        │      D1 (SQLite)         │
                        │  ├── klines              │
                        │  └── divergence_records  │
                        └──────────────────────────┘

External: Binance REST API (https://api.binance.com/api/v3/klines) — no key required
CDN-only, no backend: Lightweight Charts JS bundle (loaded client-side from unpkg)
```

Everything — HTML/CSS/JS, the JSON API, and the cron sync job — deploys as one `wrangler deploy` from one `wrangler.jsonc`/`wrangler.toml`. Cloudflare Access is configured at the zone/hostname level, in front of the whole Worker, so it does not need to be implemented in application code at all.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|-----------------|-------------------------|
| Static assets (Worker `assets` binding) | Serve the 3 HTML pages, JS, CSS from edge cache | `wrangler.jsonc` `"assets": { "directory": "./public" }`, zero-CPU, free |
| API router (`fetch` handler) | Parse routes, validate input, call DB layer, return JSON envelope | Small hand-rolled router (`itty-router` or manual `switch` on `URL.pathname`) — a full framework is overkill for 5 routes |
| DB access layer (`lib/db.ts`) | All D1 queries live here; nothing else touches `env.DB` directly | Thin repository-style module, one function per query shape |
| Binance client (`lib/binance.ts`) | Fetch klines from Binance, normalize array response into typed rows, handle 429/backoff | Fetch wrapper with retry, chunking into ≤1000-candle pages |
| Cron sync (`scheduled` handler) | Daily incremental top-up per symbol (small: ~24 candles) | `MAX(open_time)` per symbol → fetch delta → `INSERT OR IGNORE` |
| Backfill endpoint (`/api/admin/backfill`) | One-time historical load (2021→now, ~43.8k candles/symbol); must be chunked across multiple invocations, not one giant loop | Cursor-based: each call fetches one page (≤1000 candles), returns `{ done: false, cursor }`, client/you re-POST until `done: true` |
| Frontend: Records page | CRUD UI for `divergence_records`, filters, dropdown time pickers | Static JS, `fetch()` to `/api/records` |
| Frontend: Chart page | Two stacked Lightweight Charts instances, time-synced | Static JS, `fetch()` to `/api/klines`, chart lib subscribes to each other's visible-range events |
| Frontend: Calculator page | Pure client-side leverage math, no network calls | Static JS only |
| Cloudflare Access | Auth gate in front of the whole app | Zero Trust dashboard config, not app code |

## Recommended Project Structure

```
btcethdivergence/
├── src/
│   ├── index.ts               # Worker entry: fetch() + scheduled() exports, route dispatch
│   ├── routes/
│   │   ├── klines.ts           # GET /api/klines handler
│   │   ├── records.ts          # CRUD /api/records handlers
│   │   └── admin.ts            # POST /api/admin/backfill (cursor-paginated)
│   ├── lib/
│   │   ├── binance.ts          # Binance fetch + normalize + retry/backoff
│   │   ├── db.ts                # D1 query functions (repository layer)
│   │   ├── response.ts          # JSON envelope helpers (ok/error)
│   │   └── validate.ts          # Input validation (types, ranges, enum checks)
│   └── types.ts                 # Shared TS types: Kline, DivergenceRecord, etc.
│
├── public/                     # Static assets binding target
│   ├── index.html               # Records table (build first)
│   ├── chart.html                # Dual kline chart
│   ├── calculator.html           # Leverage calculator
│   ├── js/
│   │   ├── api.js                # fetch() wrapper, shared by all pages
│   │   ├── records.js
│   │   ├── chart.js
│   │   └── calculator.js
│   └── css/style.css
│
├── schema.sql                    # D1 table + index definitions
├── wrangler.jsonc                # assets binding, D1 binding, cron trigger
└── package.json
```

### Structure Rationale

- **`src/` vs `public/`:** Hard separation between server code (TypeScript, bundled by Workers) and static assets (served verbatim, no build step) — matches how Google AI Studio output (plain HTML/JS) drops straight into `public/` without touching the Worker build.
- **`lib/db.ts` as sole D1 access point:** Keeps SQL in one place so schema changes (e.g., adding a column) touch one file, and makes it easy to unit-test route handlers by mocking the DB layer instead of a real D1 binding.
- **`routes/admin.ts` isolated:** The backfill endpoint is operationally different (run once, dangerous if re-triggered against live data) — keeping it in its own file makes it easy to gate behind an extra check (e.g., a shared-secret header) or delete after initial launch.
- **One `wrangler.jsonc`:** Single source of deployment truth — D1 binding, assets directory, and cron schedule all declared together, one `wrangler deploy`.

## Architectural Patterns

### Pattern 1: Cursor-paginated backfill instead of one big loop

**What:** The historical backfill (2021→now, ~43,800 candles × 2 symbols) must not be implemented as a single Worker invocation looping over ~88 Binance requests.
**When to use:** Any one-time bulk-load job on Workers.
**Trade-offs:** Slightly more code (state passed back and forth) vs. a naive loop, but the naive loop **will fail** — see Pitfall below.

**Example:**
```typescript
// POST /api/admin/backfill  { symbol, cursor? }
// Each call does ONE page (<=1000 candles) and returns whether more remain.
export async function handleBackfill(req: Request, env: Env) {
  const { symbol, cursor } = await req.json();
  const startTime = cursor ?? (await getLastOpenTime(env.DB, symbol)) ?? EPOCH_2021;
  const candles = await fetchBinanceKlines(symbol, startTime, 1000);
  await insertKlines(env.DB, symbol, candles);
  const done = candles.length < 1000;
  const nextCursor = done ? null : candles.at(-1).closeTime + 1;
  return json({ ok: true, inserted: candles.length, done, cursor: nextCursor });
}
// Caller (a small script, or the browser) loops: POST until done === true.
```

### Pattern 2: Repository layer for D1

**What:** All SQL lives in `lib/db.ts`; route handlers never see raw SQL strings.
**When to use:** Always, even for a 2-table schema — keeps validation, SQL, and HTTP concerns separated so each is independently testable.
**Trade-offs:** One extra indirection layer for a small project, but pays off the moment you add a filter/sort option to `/api/records`.

**Example:**
```typescript
// lib/db.ts
export async function listRecords(db: D1Database, { type, tag, limit, offset }: Filters) {
  let query = `SELECT * FROM divergence_records WHERE 1=1`;
  const binds: unknown[] = [];
  if (type) { query += ` AND type = ?`; binds.push(type); }
  if (tag)  { query += ` AND tags LIKE ?`; binds.push(`%${tag}%`); }
  query += ` ORDER BY start_time DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  return db.prepare(query).bind(...binds).all();
}
```

### Pattern 3: Time-synced dual charts via shared visible-range subscription

**What:** Two independent Lightweight Charts instances (BTC, ETH) whose time scales are kept in lockstep.
**When to use:** Any "compare two series side by side" chart UI.
**Trade-offs:** Requires guarding against infinite update loops (chart A's move triggers chart B, which must not re-trigger chart A).

**Example:**
```javascript
function syncCharts(chartA, chartB) {
  let syncing = false;
  function link(from, to) {
    from.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (syncing || !range) return;
      syncing = true;
      to.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    });
  }
  link(chartA, chartB);
  link(chartB, chartA);
}
```

### Pattern 4: JSON envelope + typed validation at the edge

**What:** Every API response uses `{ ok, data|error }`; every write endpoint validates before touching D1.
**When to use:** Any Workers API, this project included (already specified in `PLAN.md`).
**Trade-offs:** None meaningful at this scale — this is the correct default.

## Data Flow

### Kline ingestion flow (write path, cron)

```
Cron Trigger (daily 01:00 UTC)
    ↓
scheduled() handler
    ↓
For each symbol: SELECT MAX(open_time) FROM klines WHERE symbol=?
    ↓
Binance GET /api/v3/klines?symbol&interval=1h&startTime=lastClose
    ↓
Normalize response rows → typed Kline[]
    ↓
D1 batch INSERT OR IGNORE (dedupe on PRIMARY KEY (symbol, open_time))
```

### Kline read flow (chart page)

```
User opens /chart?start=...&end=...
    ↓
chart.js: fetch(`/api/klines?symbol=BTCUSDT&start=&end=`)  (×2, BTC + ETH)
    ↓
Worker: lib/db.ts → SELECT ... WHERE symbol=? AND open_time BETWEEN ? AND ? ORDER BY open_time
    ↓
JSON response → Lightweight Charts `setData()`
    ↓
Two chart instances render, time-scale sync wired (Pattern 3)
```

### Divergence record CRUD flow

```
records.html form submit
    ↓
POST/PUT /api/records(/:id)  (dropdown-selected Y/M/D/H composed into unix seconds client-side)
    ↓
Worker: validate.ts (start<end, type enum, length limits)
    ↓
lib/db.ts INSERT/UPDATE divergence_records
    ↓
records.js re-fetches GET /api/records, re-renders table
```

### Deep-link flow (records → chart)

```
User clicks "📈 View Chart" on a record row
    ↓
Navigate to /chart?start=(record.start_time - 24h)&end=(record.end_time + 24h)
    ↓
chart.js reads query params on load → triggers Kline read flow above
```

## Scaling Considerations

This is a single-owner private tool — there is no multi-user scaling curve. The only "scale" axis is **data volume growth** (klines accumulate forever) and **occasional bulk operations** (backfill, re-backfill after an outage).

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Current (~88k kline rows, single user) | Exactly the architecture above. D1 free tier (5GB, 25M row reads/day) is wildly sufficient. |
| 5+ years of data (~250k+ rows) | No change needed — still well within D1 free tier; add `LIMIT`/pagination to `/api/klines` range queries if a query ever spans years at 1h resolution (8,760 rows/year/symbol is still small). |
| If ever multi-user | Would require an `owner_id` column on `divergence_records`, auth beyond Cloudflare Access (real per-user identity), and rate limiting on write endpoints — out of scope for this project by explicit decision. |

### Scaling Priorities

1. **First (and only) real constraint:** Workers **subrequest limits**, not data volume — see Pitfall below. This bites once, during initial backfill, not during normal operation.
2. **Second:** D1 batch insert size — D1 has a practical limit on statements per `batch()` call and payload size; chunk inserts (e.g., 100–500 rows per `db.batch()`) rather than one call for 1000 rows.

## Anti-Patterns

### Anti-Pattern 1: Splitting into separate Pages + Workers projects

**What people do:** Follow the older tutorial pattern (and this project's own `PLAN.md` draft) of "Pages project for the frontend, Workers project for `/api/*`," wired together with `_routes.json` or a Pages Function proxy.
**Why it's wrong:** Two deployables, two dashboards, two sets of environment variables/bindings to keep in sync, and you get none of it back — static asset hosting on Workers is free and CDN-cached exactly like Pages, and only Workers gets new platform features going forward (Cron Triggers already only exist on Workers, which this project needs anyway for the daily sync).
**Do this instead:** One Worker project with a static `assets` binding (`public/`) plus the `fetch`/`scheduled` handlers, one `wrangler.jsonc`, one `wrangler deploy`.

### Anti-Pattern 2: Running the full historical backfill in a single request/loop

**What people do:** Write a `scheduled()` or `fetch()` handler that loops `for (let i = 0; i < 44; i++) { await fetchBinance(...) }` to pull all ~43,800 candles per symbol in one invocation.
**Why it's wrong:** Workers on the Free plan cap external subrequests at **50 per invocation** (confirmed current, Feb 2026 changelog); 44 requests × 2 symbols = 88 easily blows past that in one invocation even on a single-symbol loop close to the ceiling. On top of that, Cron Trigger CPU-time budgets are tiny (10ms free / 30s paid for sub-hour schedules) and a failed scheduled run is **not retried** — it silently waits for the next scheduled tick.
**Do this instead:** Use the cursor-paginated backfill endpoint (Pattern 1), invoked repeatedly (one page per call) until done. Never rely on the cron trigger itself for backfill — cron is only for the small daily delta.

### Anti-Pattern 3: Ad-hoc SQL scattered across route handlers

**What people do:** Inline `db.prepare(...)` calls directly inside each route handler.
**Why it's wrong:** Makes it hard to add filters/validation consistently, and hard to test routes without a live D1 binding.
**Do this instead:** Route handlers call named functions in `lib/db.ts` (Pattern 2); handlers only deal with HTTP concerns (parsing, status codes, JSON envelope).

### Anti-Pattern 4: Implementing auth/password logic in application code

**What people do:** Build a login page, session cookies, or a hardcoded password check inside the Worker for "private tool" protection.
**Why it's wrong:** Reinvents session management, cookie security, and credential storage for a problem Cloudflare already solves at the edge, and every future page/route has to remember to check auth.
**Do this instead:** Cloudflare Access (Zero Trust) in front of the whole hostname, with a One-Time-PIN policy restricted to the owner's email — zero application code, verified pattern from the owner's existing `soapwavehealing` project experience.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Binance REST API (`/api/v3/klines`) | Server-side `fetch()` from the Worker only (never from the browser — avoids CORS and keeps IP-based rate limiting on Cloudflare's edge IPs, not the user's) | Public endpoint, no key. 1200 req/min IP-based limit; backfill needs chunking (Pitfall above), not rate-limit avoidance, since normal usage is far under the limit. Handle HTTP 429 with backoff + retry. |
| Lightweight Charts (unpkg CDN) | `<script src="https://unpkg.com/lightweight-charts@4/...">` loaded directly in `chart.html` | Client-side only, no backend involvement; pin the version (`@4`) rather than `@latest` to avoid silent breaking changes. |
| Cloudflare Access (Zero Trust) | Configured at the zone/hostname level in the Cloudflare dashboard, in front of the Worker's custom domain | Not app code — see Anti-Pattern 4. One-Time-PIN login method, single-email allow policy. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|-----------------|-------|
| Frontend (public/*.js) ↔ API (src/routes/*) | `fetch()` over same-origin JSON, envelope `{ ok, data }` / `{ ok:false, error }` | Same-origin because both are served by the same Worker — no CORS configuration needed at all. |
| Route handlers ↔ `lib/db.ts` | Direct function calls (in-process, same Worker isolate) | Not a network boundary — D1 binding (`env.DB`) is injected once at the Worker entry point and threaded through. |
| `scheduled()` handler ↔ `lib/binance.ts` | Direct function calls | Cron handler is the only caller of the "delta sync" path; the admin backfill route is the only caller of the "bulk page" path — keep these two call sites distinct (different pagination needs). |

## Build Order Implications

The dependency graph is nearly linear, which matches the owner's stated preference (records → charts → calculator) and the phases already sketched in `PLAN.md`:

1. **D1 schema + Worker skeleton (assets binding + API router) first.** Nothing else can be built or tested without `/api/records` and `/api/klines` existing, even with empty tables.
2. **Backfill endpoint before the daily cron.** The cron's "get MAX(open_time), fetch delta" logic is a strict subset of the backfill logic (`lib/binance.ts` fetch/normalize is shared) — build and prove the paginated fetch once via the manual backfill endpoint, then reuse it for the trivial daily-delta case in `scheduled()`.
3. **Records page before Chart page.** Chart page's deep-link behavior (`?start=&end=`) depends on records existing to link *from*; building charts first would mean testing them with hand-typed query params only.
4. **Calculator is fully independent** — zero backend dependency, can be built in parallel with anything, or last, purely based on priority rather than technical sequencing.
5. **Cloudflare Access last, but cheap.** It's dashboard configuration, not code — sequencing it after the app works avoids fighting the auth gate during local development (`wrangler dev` is unaffected by production Access policies anyway, so this is more about not forgetting it before going "live" with a public repo).

## Sources

- [Migrate from Pages to Workers · Cloudflare Workers docs](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) — HIGH confidence, official docs
- [Cloudflare Pages vs Workers 2026: Architecture, Pricing, Use Cases](https://www.morphllm.com/comparisons/cloudflare-pages-vs-workers) — MEDIUM confidence, third-party analysis, consistent with official docs
- [Best practices · Cloudflare D1 docs](https://developers.cloudflare.com/d1/best-practices/) — HIGH confidence, official docs
- [Use indexes · Cloudflare D1 docs](https://developers.cloudflare.com/d1/best-practices/use-indexes/) — HIGH confidence, official docs
- [Workers are no longer limited to 1000 subrequests · Changelog](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/) — HIGH confidence, official changelog (Feb 2026), confirms Free plan still capped at 50 external subrequests/invocation
- [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/index.md) — HIGH confidence, official docs
- [Scheduling Cloudflare Workers Beyond Cron Triggers](https://dev.to/ronency/scheduling-cloudflare-workers-beyond-cron-triggers-1gd7) — MEDIUM confidence, community writeup, consistent with official CPU-time limits
- [Publish a self-hosted application to the Internet · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) — HIGH confidence, official docs
- [Add web applications · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/) — HIGH confidence, official docs

---
*Architecture research for: crypto trading divergence analysis tool (Cloudflare Workers + D1)*
*Researched: 2026-08-30*
