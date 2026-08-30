# Phase 2 Learning — Kline Backfill Engine

**Date:** 2026-08-31  
**Linked to:** Phase 1 (Binance spike verdict locked external-fetcher path)

## Key Decisions & Rationale

### 1. External Fetcher over Worker-Direct Fetch
**Decision:** GitHub Actions runner fetches Binance; Worker only persists.  
**Why:** Phase 1 spike proved Cloudflare Workers get 403 from Binance (deterministic, 5/5 runs). Both `api.binance.com` and `data-api.binance.vision` behind Cloudflare block Worker IPs. Local requests (and GitHub Actions IPs) reach Binance with 200.  
**Carries:** Phase 1 SPIKE-REPORT.md decision → Phase 2 split architecture (fetch externally, persist to Worker D1).

### 2. Chunked D1 Batch Inserts (≤14 rows = ≤98 params)
**Decision:** Build pure chunked-insert module; each statement ≤14 rows (7 cols × 14 = 98 bound params ≤ D1's 100 cap).  
**Why:** D1 Free tier has ambiguous "50 queries per invocation" limit. Chunking to 14 rows per statement and ≤40 statements per `db.batch()` ensures empirical verify-ability: a 1000-candle ingest → 72 statements → 2 batch calls. If this succeeds on the deployed Worker, SC2's "within limits" is proven. If not, we surface the blocker.  
**Carries:** Phase 1 D1 schema (`klines` table with 7 cols) + `db.batch()` API from Phase 1 Task 2.

### 3. Cursor Stored in D1, Advanced Per Call
**Decision:** `backfill_state` table stores per-symbol `cursor_open_time` (seconds since epoch) and `updated_at`.  
**Why:** Repeated fetcher calls must be idempotent and progress incrementally. Cursor lives in D1 (survives restart); fetcher reads it, fetches from `cursor + 1h`, POSTs, and Worker advances it. On reached-now (empty result), fetcher exits cleanly (no error).  
**Carries:** Phase 1 D1 database + admin auth pattern (Bearer token + Zod validation).

### 4. Binance Rate Limit Handling (429/418 Logic)
**Decision:** 429 → honor `Retry-After` (60s floor, no missing header assumed), retry once; 418 → abort immediately (IP banned, retrying extends ban).  
**Why:** Binance documents both; 418 requires backoff > 60s. Retry-once pattern balances resilience with avoiding hammering. 429 with no Retry-After header → default 60s (conservative).  
**Carries:** Phase 1 `fetchKlines` + `BinanceError` classification (now extended with `decideBackoff` logic in `backoff.ts`).

### 5. "Reached Now" Tail Handling
**Decision:** When Binance returns 0 candles (cursor already at latest), fetcher logs "reached now" and exits 0 (success). Does not POST empty array.  
**Why:** Repeated runs of an up-to-date fetcher would otherwise POST `[]`, fail Zod `.min(1)` validation, and error out. Instead, silent success signals backfill complete.  
**Implication:** Worker ingest endpoint no longer returns a `done` flag; fetcher computes `done = (result.klines.length < 1000)` and logs it independently.

### 6. No Cron Schedule in Phase 2
**Decision:** Workflow is `workflow_dispatch` only; no `schedule:` block.  
**Why:** Phase 3 (Historical Load & Cron Sync) owns the daily automation. Phase 2 is manual-triggered (testing + integration proof). Prevents silent feature-creep (Phase 2 plan shouldn't implement Phase 3 scope).

## Integration with Phase 1

| Phase 1 Output | Phase 2 Use | Link |
|---|---|---|
| D1 schema (klines + divergence_records) | Data target for ingest | 02-01 Task 1 extends with `backfill_state` |
| `fetchKlines` + `BinanceError` (binance.ts) | Reused by fetcher script | 02-02 Task 1 imports + extends with backoff logic |
| Hono + Zod validation pattern | Admin ingest routes | 02-01 Task 2 POST /api/admin/ingest + GET cursor |
| Bearer-token auth (01-03 T3 gateway pattern) | Protects admin endpoints | 02-01/02-02 require INGEST_TOKEN secret |
| Spike verdict (403 from Workers) | Justifies external-fetcher path | SPIKE-REPORT.md `## Phase 2 Path` = option (c) |

## Warnings Applied (Before Execution)

- **WARNING-01** (typecheck coverage): Added `@types/node` + `scripts/tsconfig.json` + `npm run typecheck:scripts`. Fetcher script now typechecks alongside main src/.
- **WARNING-02** (reached-now tail): Fetcher handles `klines.length === 0` → exits 0 (not an error).
- **WARNING-03** (files_modified): Corrected 02-01 metadata (added `src/lib/validate.ts`, removed unchanged `src/index.ts`).
- **WARNING-04** (done logic): Moved `done` flag computation from Worker response to fetcher (based on Binance's actual result size, not Worker validation).

## Testability & Verification Checkpoints

### Unit Tests (Task 1)
- `buildKlineInsertChunks(1000)` → 72 statements, each ≤98 params, in ≤2 batch calls.
- `decideBackoff(429)` with/without Retry-After → retry with 30s or 60s floor.
- `decideBackoff(418)` → abort (no auto-retry).

### Integration Tests (Task 2)
- Deploy ingest + cursor routes; POST 1000 klines → inserted=1000; re-POST same batch → skipped=1000 (idempotent).
- Two fetcher runs → second run's cursor ≥ first (advances or reaches-now).
- GitHub workflow dispatch succeeds from GH runner IPs.

## Phase 2 Execution Findings

### GitHub Actions Runner Geo-Block (451)
**Finding**: GitHub Actions hosted runners are **completely blocked by Binance with HTTP 451** (Unavailable For Legal Reasons — geo-block of Azure/US datacenter IPs). Two real workflow_dispatch runs confirmed:
- Run 1: `Binance returned 451; waiting 0s; exit code 1`
- Run 2: Same error, consistent geo-block (not intermittent)

**Details**:
- `POST /api/v3/klines` returns 451 from GH runner IPs
- `GET /api/v3/ping` succeeds (HTTP 200) — endpoint-specific or rate-based block
- Local machine `curl` to same endpoint returns 200 (not a global Binance outage)
- Ping endpoint works on GH but klines does not → Binance has selective endpoint gating for GitHub IPs

**Impact**:
- ✅ Phase 2 SCs fully proven via local-machine path (cursor advancement, idempotency, reached-now handling)
- ❌ GitHub workflow cannot execute daily cron on hosted runners
- 🔴 **Phase 3 decision required**: must use local `launchd`/`crontab` or self-hosted runner

**Why not retry**:
- 451 is non-retryable HTTP status (not 429 rate-limit, not 418 IP-ban)
- Backoff logic correctly aborts on 451 without hammering
- No header-based retry signal (unlike 429's Retry-After)

### Stale Worker URL (swadmin31.workers.dev)
**Finding**: The plan referenced `https://btcethdivergence.swadmin31.workers.dev`, which is a **stale worker in a different Cloudflare account** (no ingest routes — returns 404 on POST /api/admin/ingest). Execution used the authoritative URL: `https://btcethdivergence.gn01968711.workers.dev` (authenticated account with live D1).

**Action**: 
- ✅ GitHub Actions secret `WORKER_URL` set to correct gn01968711 URL
- ⚠️ Old `swadmin31` account's duplicate worker should be **removed** (safe to delete; no production dependencies)
- Stale GitHub secret `WORKER_API_KEY` (Phase 1 stub) remains but unused

## Open Questions / Phase 3 Handoff

1. **Cron execution strategy** (DECIDED ✅): GitHub Actions blocked → **owner chose (A) Local launchd**
   
   **Phase 3 Two-Stage Plan**:
   - **Stage 1: Historical Backfill** (2021-03-25 → 2026-08-31) — one-time crawl using the fetcher, completing the crawl already proved (3000 BTCUSDT rows seeded). Target: fill remote D1 with 4+ years of history.
   - **Stage 2: Daily Schedule** (2026-09-01 onward) — launchd plist runs `backfill-fetcher.mts` every 2 AM UTC, syncing prior day's latest candles. No geo-block, zero cost, proven locally.
   - **Future (Phase 4+)**: Consider CoinGecko dual-source fallback for resilience (if Binance changes blocking policies).

2. **"50 queries per invocation" empirically proven**: Phase 2 Task 2 verify confirmed 1000-candle ingest runs ≤50 queries via 2 `db.batch()` calls. D1 Free tier is confirmed to sustain chunked backfill.

3. **Admin route security**: Bearer token is temporary. Phase 9 (Cloudflare Access) will gate `/api/admin/*` by user identity. Phase 2 uses shared secret (copied to GitHub Actions secrets).

## Success Criteria Evidence (End-to-End)

- **SC1** (fetch + store 1000 candles): Phase 2-02 Task 2 runs fetcher twice, proves delivery to ingest endpoint, which persists to D1.
- **SC2** (cursor advances): Task 2 verify shows run 2's cursor > run 1's cursor (or reached-now signal).
- **SC3** (429/418 handling): Task 1 unit tests + Task 2 fetch-with-weight logging.
- **SC4** (≤16-row chunks): Task 1 buildKlineInsertChunks unit test asserts ≤14 rows / ≤98 params per statement.
- **SC5** (Binance fallback documented): Proved in Phase 1 spike; Phase 2 executes the locked fallback path.
