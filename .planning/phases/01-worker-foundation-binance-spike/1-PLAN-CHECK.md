# Phase 1 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial)
**Date**: 2026-08-30
**Phase**: 1 — Worker Foundation & Binance Spike
**Plan(s) verified**: 01-01-PLAN.md (wave 1), 01-02-PLAN.md (wave 2), 01-03-PLAN.md (wave 3) — 9 tasks total
**Status**: ISSUES FOUND — **0 blocker(s)**, 3 warning(s), 7 info

> Note: this is a fresh verification of the current plan revisions. Three warnings in the prior check (workers.dev subdomain in user_setup, `parseKline` string→number coercion, stale PROJECT.md tech-stack constraint) were already fixed in the current files and are recorded as verified, not re-opened.

## 1. Coverage Summary

| Plan | Wave | Depends on | Tasks | Requirements covered | SC covered |
|------|------|-----------|-------|----------------------|------------|
| 01-01 (foundation) | 1 | — | 3 | INFRA-01, INFRA-05 | SC1, SC4 |
| 01-02 (feature) | 2 | 01-01 | 3 | INFRA-02, INFRA-03 (+ phase goal "D1 schema live") | SC2, SC3 |
| 01-03 (spike) | 3 | 01-02 | 3 | DATA-07 | SC5 |

All 5 phase requirements (INFRA-01, INFRA-02, INFRA-03, INFRA-05, DATA-07) have ≥1 concrete covering task. Zero-coverage: none.

## 2. Success Criteria Traceability

| SC | Success criterion (ground truth, ROADMAP) | Delivered by | Notes |
|----|------------------------------------------|--------------|-------|
| SC1 | Deployed Worker URL returns static asset bundle via the Static Assets binding, no separate Pages project | 01-01 T1 (assets binding in wrangler.jsonc, `main` entry), T2 (`public/index.html`, `wrangler deploy`, `curl /` + `/index.html` grep) | The grep genuinely proves the binding: if assets were broken, `/` would fall through to the Worker stub and return `"ok"`, not the marker. "No Pages project" clause is asserted, not command-verified → INFO-02 |
| SC2 | Any API route returns `{ok, data|error}` envelope | 01-02 T2 (jsonOk/jsonError, Hono router, `app.notFound()` → 404 envelope; curl on /api/health, /api/records, /api/nonexistent) | 01-03 spike endpoint also uses the envelope, so the /api/admin/* route stays consistent |
| SC3 | Invalid POST/PUT rejected with Zod error before touching DB | 01-02 T3 (createRecordSchema/updateRecordSchema, `safeParse` before any db call, no-DB-write proof via `data:[]` re-check) | Verify only curl-tests the **POST** path; PUT 400/no-write is specified but never exercised → WARNING-03 |
| SC4 | `.dev.vars` and `.wrangler/` absent from git tracking | 01-01 T3 (.gitignore hardening + `git check-ignore` + `git status --porcelain`) | — |
| SC5 | Deployed-Worker fetch to Binance succeeds, OR documented fallback selected | 01-03 T2 (spike endpoint hitting api.binance.com then data-api.binance.vision, 2 runs 30s apart), T3 (SPIKE-REPORT.md verdict + owner decision checkpoint) | Fallback ladder matches research (PITFALLS.md:20-21, SUMMARY.md:65). Verify for the blocked case is inconsistent with its own action → WARNING-02 |

No success criterion lacks a covering task. No BLOCKER on traceability.

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|-----------|--------|-------|
| 1 | Requirement coverage | PASS | All 5 mapped; each requirement has a task + verify. Phase goal "D1 schema is live" covered by 01-02 T1 (migrations, local + remote) |
| 2 | Task completeness | PASS | 9/9 tasks: concrete files, specific action, automated verify, done criteria |
| 3 | Dependency correctness | WARN | Cross-plan chain 01-01→01-02→01-03 is acyclic with correct preconditions. Within-plan flaw: 01-01 T1's dry-run verifies an assets directory that only 01-01 T2 creates → WARNING-01 |
| 4 | Key links / wiring | PASS | must_haves key_links are grep-able (`assets`, `main`, `safeParse`, `createRecord|updateRecord`, `jsonError`, `fetchKlines`); every artifact is wired to an SC, not created in isolation |
| 5 | Scope sanity | PASS | 3 tasks per plan (≤ target); 3 plans for the phase is justified (scaffold/deploy/hygiene; schema/API/validation; spike/decision) |
| 6 | SC traceability | PASS | See §2 — all 5 covered by named tasks |
| 7 | Locked-decision compliance | PASS | Implements the single-Worker + Static Assets lock (INFRA-01, PROJECT.md:54 now matches). D1 binding intentionally deferred from 01-01 to 01-02. No CONTEXT.md D-XX decisions exist for this phase. No task implements Phase 2+ features |
| 8 | Scope-reduction detection | PASS | Grep for hedging language found only legitimate cases: `public/index.html` placeholder (real pages are Phases 4-8), "empty array initially — Phase 2 loads data" (defined phase boundary), "future /api/admin/ingest" (the documented SC5 fallback path). Nothing in-scope is stubbed |
| 9 | Verification-plan quality | PASS | Automated commands throughout (curl+grep, `tsc --noEmit`, `npx vitest run`, `d1 execute --local/--remote`, `git check-ignore`). Typecheck present in all 3 plans touching typed code. Exceptions: PUT path and blocked-spike path are mis-verified → WARNING-02/03 |
| 10 | Fact-check load-bearing claims | PASS | Verified against real source/research: klines + divergence_records schemas match PLAN.md:57-98 exactly; REC-02 partial-update contract matches PLAN.md:216, :577; `--batch-size` removal matches STACK.md:33/:67/:84; Binance .vision fallback + GitHub Actions external fetcher match PITFALLS.md:20-21; string-number coercion = PITFALLS.md Lesson 5 (now implemented in 01-03 T1 with `Number()`/`parseFloat()` + `typeof === 'number'` vitest assert); intermittency claim matches PITFALLS.md Pitfall 1. `wrangler` errors on a missing `assets.directory` per workers-sdk#8100 (basis of WARNING-01) |

## 4. Issues

### Blockers
None.

### Warnings

- **WARNING-01 — 01-01 Task 1's dry-run runs before the assets directory exists**
  01-01 T1 writes `wrangler.jsonc` with `"assets": { "directory": "./public", ... }` and then verifies with `npx wrangler deploy --dry-run --outdir dist` — but `public/index.html` is only created in 01-01 T2. Wrangler rejects a configured assets directory that does not exist ("The directory specified by the `assets.directory` field ... does not exist", workers-sdk#8100), and dry-run validates `assets.directory` (documented as catching "assets.directory points at the wrong path"). The first verify gate of the entire phase can fail before T2 ever creates `public/`.
  `fix_hint`: In T1, also create the `public/` directory (even empty, or move the `public/index.html` creation into T1), so the dry-run sees a valid assets directory; or move the dry-run into T2 after index.html exists.

- **WARNING-02 — 01-03 Task 2's verify contradicts its own action for the blocked case**
  The action returns `jsonError('Binance blocked: ' + error, 502)` (body `"ok":false`, HTTP 502) when both hosts fail, but the verify expects `curl -sf <url>/api/admin/binance-spike` to return `"ok":true` "with ... a structured blocked result". Two failures: (a) `-f` makes curl exit non-zero on the 502, so the command red-flags the legitimate blocked outcome; (b) the body is `ok:false`, not `ok:true`. The blocked case is exactly the scenario SC5 contemplates, so the acceptance gate would report failure for a correct, expected result.
  `fix_hint`: Use `curl -s` (no `-f`) and accept either `"ok":true` + `"count":1`, or HTTP 502 + `"ok":false` + `Binance blocked` naming both hosts; alternatively have the endpoint return `jsonOk({ endpoint, status, count, blocked: true })` for all outcomes so the verify can be a single `"ok":true` check.

- **WARNING-03 — 01-02 Task 3's verify never exercises the PUT rejection path**
  SC3 names invalid **POST/PUT** bodies. The task specifies `PUT /api/records/:id` with `updateRecordSchema.safeParse` and the same 400 path, but every curl in the verify block (invalid, ordering, no-DB-write proof, valid) hits only `POST /api/records`. A regression or omission in the PUT guard would pass the phase gate.
  `fix_hint`: Add to the verify block: `curl -s -o /dev/null -w '%{http_code}' -X PUT <url>/api/records/1 -H 'Content-Type: application/json' -d '{"type":"nonsense"}'` → 400 with `"ok":false`, followed by `GET /api/records` proving no row changed.

### Info

- **INFO-01**: ROADMAP phase section is stale — it still shows "Plans: TBD" and "- [ ] 01-01: TBD" and progress "0/TBD" while three plans (01-01, 01-02, 01-03) exist. `fix_hint`: update the ROADMAP plan list and progress table to reflect the actual plans before execution bookkeeping.
- **INFO-02**: SC1's "no separate Pages project involved" clause is asserted in 01-01 T2 but has no command. `fix_hint`: add `npx wrangler pages project list` (asserting this project is absent) to the verify block.
- **INFO-03**: The valid-POST curl in 01-02 T3 persists a real test record into remote D1 that Phase 4 will read. `fix_hint`: add a cleanup DELETE after verifying, or record it as seed data to purge at Phase 4 planning.
- **INFO-04**: The `/api/admin/binance-spike` endpoint remains deployed and unauthenticated after the phase (it exposes only a 1-candle fetch, so low risk). `fix_hint`: note in SPIKE-REPORT.md that the endpoint is temporary and must be removed or Access-gated before launch (Phase 9).
- **INFO-05**: `@cloudflare/vitest-pool-workers` is installed (01-01) but 01-03 runs plain `npx vitest run` in the node environment. `fix_hint`: drop it from devDependencies or add a vitest config using the pool.
- **INFO-06**: Several write-method curl examples omit `-H 'Content-Type: application/json'`; curl's `-d` then sends `application/x-www-form-urlencoded`. Hono's `c.req.json()` parses regardless, so it works today, but the convention is fragile. `fix_hint`: add the header consistently.
- **INFO-07**: `/api/klines` passes `start`/`end` URL params straight into the SQL `BETWEEN ? AND ?` without `Number()` coercion. SQLite affinity makes it work, but explicit coercion is safer and matches the typed `Kline`/query contract. `fix_hint`: `Number()` the params in the route handler.

## 5. Recommendation

**PROCEED with execution.** The three plans are goal-backward complete: all 5 requirements and all 5 success criteria are covered by concrete, wired, verify-able tasks; the cross-plan dependency chain is acyclic and correctly ordered; task sizing is on-target; every load-bearing claim (schemas vs PLAN.md, REC-02 contract, `--batch-size` removal, .vision/external-fetcher fallback ladder, string-number coercion, intermittency) was confirmed against the actual research and source. The previously flagged warnings (workers.dev subdomain setup, `parseKline` coercion, stale PROJECT.md constraint) are already resolved in the current revisions.

The three remaining warnings are small, low-risk edits to make before or during execution: (W-01) create `public/` in Task 1 so the first dry-run passes, (W-02) fix the spike verify to accept the legitimate 502 blocked outcome, (W-03) add a PUT-invalid curl to prove the SC3 PUT guard. None blocks any success criterion, and each has a concrete fix in §4.