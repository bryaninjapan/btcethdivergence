# Phase 1 Verification Report

**Date:** 2026-08-31
**Verifier:** gsd-verifier (goal-backward, read-only pass)

## Summary

5 of 5 criteria PASS; phase goal achieved. All criteria were verified against the **current, live** state: deployed Worker (`https://btcethdivergence.swadmin31.workers.dev`), live git tracking, and current source. SC5 passes via the documented-fallback branch: the live spike endpoint returns the deterministic Binance 403 block, and the fallback path (external-fetcher, option c) is documented in SPIKE-REPORT.md and owner-confirmed.

## Criterion-by-Criterion Verification

### 1. "Visiting the deployed Worker URL returns the static asset bundle via the Static Assets binding, with no separate Pages project involved."

- Evidence:
  - `curl -sS https://btcethdivergence.swadmin31.workers.dev/` → HTTP 200, body is the placeholder HTML bundle containing `<title>BTC/ETH Divergence Tracker</title>` and `<h1 id="app-root">BTC/ETH Divergence Tracker</h1>` (matches `public/index.html`).
  - `curl -sS -L .../index.html` → HTTP 307 → 200, same bundle served.
  - `npx wrangler pages project list` → projects `etf-flow-database`, `equityinsight`, `en-translator`, `englisheditor` — **no `btcethdivergence` Pages project exists**.
  - `wrangler.jsonc` declares a single Worker: `main: src/index.ts` + `assets: { directory: "./public", binding: "ASSETS" }`. No Pages deployable exists.
- Verdict: PASS

### 2. "Calling any API route returns the `{ok, data|error}` JSON envelope."

- Evidence:
  - `/api/health` → `{"ok":true,"data":{"status":"ok"}}` HTTP 200
  - `/api/records` → `{"ok":true,"data":[]}` HTTP 200
  - `/api/nonexistent` → `{"ok":false,"error":"Not found"}` HTTP 404
  - Source: all routes return through `jsonOk`/`jsonError` (`src/lib/response.ts`); `app.notFound` → envelope 404 (`src/index.ts:16`).
- Verdict: PASS

### 3. "Submitting an invalid POST/PUT request body (e.g. missing required field) is rejected with a Zod validation error before touching the database."

- Evidence:
  - `POST /api/records` with `type:"nonsense"` → HTTP 400 `{"ok":false,"error":"Validation failed: type: Invalid option: expected one of \"time_lag\"|\"structural\"|\"opposite\""}`
  - `POST /api/records` with `start_time` > `end_time` → HTTP 400 `{"ok":false,"error":"Validation failed: : start_time must be before end_time"}`
  - `GET /api/records` immediately after the two failed POSTs → still `{"ok":true,"data":[]}` (no DB write occurred)
  - `PUT /api/records/1` with `type:"nonsense"` → HTTP 400 Zod validation error
  - Source: `records.ts` runs `createRecordSchema.safeParse(...)` / `updateRecordSchema.safeParse(...)` and returns 400 **before** any `createRecord`/`updateRecord` DB call.
- Verdict: PASS

### 4. "`.dev.vars` and `.wrangler/` are absent from git tracking."

- Evidence:
  - `git check-ignore .dev.vars .wrangler/ node_modules/` echoes all three paths and exits 0.
  - `git ls-files | grep -E "dev\.vars|\.wrangler"` → no matches (not tracked).
  - `git status --porcelain` → neither `.dev.vars` nor `.wrangler/` appears (present on disk but ignored).
  - `.gitignore` contains `.dev.vars` and `.wrangler/`.
- Verdict: PASS

### 5. "A fetch to Binance's public kline endpoint from the deployed (not local) Worker succeeds, or a documented fallback path is selected if blocked."

- Evidence (live, run today):
  - `curl -sS https://btcethdivergence.swadmin31.workers.dev/api/admin/binance-spike` → HTTP 502 `{"ok":false,"error":"Binance blocked: api.binance.com 403, data-api.binance.vision 403"}` — the deployed Worker's fetch to both Binance kline hosts is blocked (deterministic 403 at the Cloudflare edge in front of Binance), confirming the spike's blocked outcome is still true **right now**.
  - `SPIKE-REPORT.md` contains `## Verdict` ("Both Binance public kline hosts are BLOCKED from this deployed Cloudflare Worker (403)…SC5 is satisfied via the documented-fallback branch"), `## Phase 2 Path` ("**Selected option: (c) — both blocked → external fetcher ingest.**"), and owner confirmation line "**Owner confirmation: ✅ 2026-08-31 — Proceed with option (c) external-fetcher path.**"
  - The fallback path is documented, owner-signed, and consistent with the observed live block.
- Verdict: PASS

## Regression Check

No prior phase exists (Phase 1 is the first), so there is no earlier VERIFICATION.md to regress against. The phase's own code review (01-REVIEW.md) flagged one CRITICAL (CR-01: klines ms/seconds timestamp mismatch) — confirmed **fixed in the current file** (`src/routes/klines.ts:20-22` converts ms → seconds before querying). Warnings WR-01/02/03 (missing try-catch), WR-04 (symbol validation in spike), WR-05 (unsafe URL construction) are also fixed in the current source (`admin.ts:39-41`, `admin.ts:44-59` try/catch, `binance.ts:37-41` URL API). `npm run typecheck` exits 0; `npx vitest run` → 6 files, 38 tests passed.

## Deviations Honesty Check

All deviations logged in 1-SUMMARY.md (reused D1 id, `export default app`, pre-existing `validate.ts`, temp probe endpoints removed, test record purged) are documented and none silently violates a criterion. Confirmed in current source: no stray probe routes remain in `src/index.ts`; records table is empty as claimed.

Note (non-blocking): the live spike endpoint responded without requiring the `INGEST_TOKEN` added by Phase 2, indicating the deployed Worker is a Phase 1-era build (known "stale worker" issue already recorded in git history). This does not affect any Phase 1 criterion.

## Conclusion

All 5 criteria PASS.

Recommendation: READY FOR PRODUCTION for Phase 1's scope. No blocking items. Carry-over notes for later phases: remove or Access-gate `/api/admin/binance-spike` (INFO-04) and redeploy the latest worker (stale-worker observation) before Phase 9.