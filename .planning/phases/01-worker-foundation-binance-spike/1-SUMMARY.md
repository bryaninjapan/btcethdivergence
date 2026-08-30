# Phase 1 Summary — Worker Foundation & Binance Spike

**Date:** 2026-08-30
**Phase:** 1 of 9
**Plans:** 01-01 (foundation, wave 1), 01-02 (feature, wave 2), 01-03 (spike, wave 3) — 9 tasks total

## Result Overview

8 of 9 tasks **completed** and committed. 1 task (01-03 T3) is a **human checkpoint** (checkpoint:decision) — the SPIKE-REPORT.md and its Phase 2 path recommendation are written and verified, but require owner sign-off before Phase 2 planning.

## What Was Built

### Deployed Worker (single project, no Pages)
| File | Purpose |
|------|---------|
| `package.json` / `package-lock.json` | Node manifest; hono + zod runtime deps, wrangler/typescript/vitest dev deps; scripts `dev`/`deploy`/`typecheck`/`test` |
| `tsconfig.json` | TS strict, ES2022, Bundler resolution, `@cloudflare/workers-types`, `noEmit` |
| `wrangler.jsonc` | Single deployable: `main` + `assets` binding over `./public` + `DB` D1 binding |
| `public/index.html` | Static asset bundle entry served by ASSETS binding (placeholder) |
| `src/index.ts` | Hono app: `/api/health`, mounts admin/klines/records routes, `notFound` → 404 envelope |
| `src/types.ts` | `Env`, `Kline`, `DivergenceRecord`, `BinanceKlineTuple` types |
| `.gitignore` | `node_modules/`, `dist/`, `*.local`, `.env*`, `.dev.vars`, `.wrangler/` |
| `.dev.vars` | Comment-only placeholder; git-ignored |

### D1 Schema (live local + remote)
| File | Purpose |
|------|---------|
| `migrations/0001_create_klines.sql` | `klines` table PK `(symbol, open_time)` + `idx_klines_time` |
| `migrations/0002_create_divergence_records.sql` | `divergence_records` + `idx_records_time` index |

### API Skeleton & Validation
| File | Purpose |
|------|---------|
| `src/lib/response.ts` | `jsonOk` / `jsonError` `{ok, data\|error}` envelope helpers |
| `src/lib/db.ts` | Sole D1 access layer: `listRecords`, `queryKlines`, `createRecord`, `updateRecord` |
| `src/lib/validate.ts` | Zod `createRecordSchema` / `updateRecordSchema` (enum, length caps, `start_time < end_time` refine) |
| `src/routes/records.ts` | `GET/POST /api/records`, `PUT /api/records/:id` — safeParse before any DB write |
| `src/routes/klines.ts` | `GET /api/klines?symbol=&start=&end=` (empty until Phase 2 loads data) |

### Binance Spike
| File | Purpose |
|------|---------|
| `src/lib/binance.ts` | `parseKline` (ms→s, `Number()` coercion of string fields), `fetchKlines` (either host, weight capture, 429/418 `BinanceError`) |
| `src/lib/binance.test.ts` | 4 vitest tests: parse mapping, numeric coercion, 429 classification, success path |
| `src/routes/admin.ts` | `GET /api/admin/binance-spike` — api.binance.com then data-api.binance.vision fallback |
| `SPIKE-REPORT.md` | Spike verdict (both hosts 403 from Worker, 200 local) + selected Phase 2 path |

## Success Criteria Status

| SC | Status | Evidence |
|----|--------|----------|
| SC1 — deployed URL serves assets via binding, no Pages | ✅ | `curl /` and `/index.html` return placeholder; `wrangler pages project list` shows no `btcethdivergence` project |
| SC2 — every API route returns `{ok, data|error}` | ✅ | `/api/health`, `/api/records`, `/api/nonexistent` (404 envelope) verified live |
| SC3 — invalid POST/PUT rejected by Zod before DB | ✅ | Bad enum + ordering → 400 `ok:false`; DB stayed empty; PUT invalid did not mutate (W-03 fix) |
| SC4 — `.dev.vars` / `.wrangler/` untracked | ✅ | `git check-ignore` echoes both; absent from porcelain |
| SC5 — Binance fetch from deployed Worker, or documented fallback | ⚠️ **blocked outcome** | Both hosts 403 (deterministic, 5/5). Fallback path **documented** in SPIKE-REPORT.md → awaiting owner decision |

## Checkpoint — Requires Owner Decision (01-03 T3)

The spike is **blocked**: `api.binance.com` and `data-api.binance.vision` both return **403** from the deployed Worker (Cloudflare-edge block of Worker IPs; the same requests succeed from the local machine). Per the plan's decision rule this selects **option (c)**:

> **Phase 2 uses an EXTERNAL-FETCHER INGEST PATH** — a GitHub Actions free-tier scheduled job fetches Binance klines from GitHub's IPs and POSTs them into a future Worker endpoint `/api/admin/ingest` that persists to D1. Phase 2 planning must account for this extra component.

**Needed to unblock:** owner confirms option (c) in `SPIKE-REPORT.md` `## Phase 2 Path`, or states an override (a/b/c). Then Phase 2 can be planned against that path.

## Deviations from Plan

1. **D1 `database_id` reused instead of `d1 create`** (01-02 T1): a prior partial attempt had already created `btcethdivergence` D1 (id `c5e8aaf3-966b-42c6-8975-1bdf234a07d8`) and applied the identical migrations; re-ran verification instead of recreating. No functional difference.
2. **`export default app` instead of `export { fetch: app.fetch }`** (01-02 T2): Hono v4 module format; typecheck + deploy verified.
3. **`src/lib/validate.ts` pre-existed** from the prior partial attempt and already matched the plan's schema exactly (with a `validationMessage` helper) — retained rather than rewritten.
4. **Temporary probe endpoints** (`/api/admin/spike-probe`, `/api/admin/spike-probe2`) were deployed mid-spike to capture the 403 block-page bodies and test the User-Agent hypothesis. They were removed and the real `index.ts` redeployed; no trace remains.
5. **INFO-03**: the valid POST test record was purged from remote D1 after verification so Phase 4 starts clean.

## Plan-Check Warnings Applied

- **W-01**: created `public/` in 01-01 T1 so the dry-run passed. ✅
- **W-02**: spike verify uses `curl -s` and accepts both `ok:true + count:1` and the 502 blocked outcome. ✅
- **W-03**: added PUT-invalid verify (400 + no mutation) — exercised. ✅

## Carried-Over INFO Items

- **INFO-04**: `/api/admin/binance-spike` is temporary; must be removed or Access-gated before launch (noted in SPIKE-REPORT.md).
- **INFO-05**: `@cloudflare/vitest-pool-workers` installed per plan but tests run in the node env (`npx vitest run`); left as-is per plan, no vitest config added.
- **INFO-01**: ROADMAP.md progress table / plan list still shows "TBD" — recommend updating at phase transition.

## Verification Commands (end-to-end phase goal)

```bash
# SC1 — assets via binding
curl -sf https://btcethdivergence.swadmin31.workers.dev/ | grep "BTC/ETH Divergence Tracker"
npx wrangler pages project list   # expect NO btcethdivergence project

# SC2 — envelope on every route
curl -s https://btcethdivergence.swadmin31.workers.dev/api/health     # {"ok":true,...}
curl -s https://btcethdivergence.swadmin31.workers.dev/api/records    # {"ok":true,"data":[]}
curl -s https://btcethdivergence.swadmin31.workers.dev/api/nonexistent  # 404 {"ok":false,...}

# SC3 — Zod rejection before DB
curl -s -X POST https://btcethdivergence.swadmin31.workers.dev/api/records \
  -H 'Content-Type: application/json' -d '{"start_time":1705334400,"end_time":1705420800,"type":"nonsense"}'
  # → 400 {"ok":false,"error":"Validation failed: type: ..."}
curl -s https://btcethdivergence.swadmin31.workers.dev/api/records   # still data:[]

# SC4 — secret hygiene
git check-ignore .dev.vars .wrangler/ node_modules/

# SC5 — spike + documented fallback
curl -s https://btcethdivergence.swadmin31.workers.dev/api/admin/binance-spike
  # → either {"ok":true,...,"count":1} or 502 {"ok":false,"error":"Binance blocked: ..."}
grep -E "## Verdict|## Phase 2 Path" .planning/phases/01-worker-foundation-binance-spike/SPIKE-REPORT.md

# Unit tests
npm run typecheck && npx vitest run src/lib/binance.test.ts
```

## Commit Range

`git log --oneline 0458c41..HEAD` — see below.