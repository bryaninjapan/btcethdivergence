# Phase 9 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward adversarial)
**Date**: 2026-08-31
**Phase**: 9 — Access & Launch Hardening
**Plan(s) verified**: `.planning/phases/09-access-launch/09-PLAN.md` v1.0 (tasks 09-01, 09-02 + sub-task 09-02-TDD); `PLAN-REVISION.md` (revision record); locked decisions `CONTEXT.md` D-09-01..04; ground truth `ROADMAP.md` Phase 9 (SC1-3, INFRA-04/06) + `REQUIREMENTS.md` INFRA-04/06
**Status**: **ISSUES FOUND — 0 blocker(s), 7 warning(s), 7 info**

---

## 1. Coverage Summary

| Plan Task | Files touched | Delivers Requirement | Verifiable? |
|---|---|---|---|
| 09-01 Unified Navigation Bar | `public/index.html`, `public/charts.html`, `public/calculator.html`, `public/css/style.css` (exist, verified); `public/js/nav.js` + `public/js/nav.test.ts` (new — confirmed absent from `public/js/`) | INFRA-06 | Yes — vitest (`npm run test -- public/js/nav.test.ts`; vitest.config.js: jsdom + globals), static 3-page grep (09-PLAN.md:233-243), `npm run deploy` + live curl (09-PLAN.md:244-258). Caveat: live curl only valid pre-Access (W7); nav.js module shape unspecified (W6) |
| 09-02 Cloudflare Access Config & Service Token (incl. 09-02-TDD) | `ACCESS-CONFIG.md` (new); `scripts/backfill-fetcher.mts` (add `Cf-Access-Client-Id/Secret` headers — both fetch calls, W4); `~/.config/btcethdivergence/backfill-runner.sh` + `-eth.sh` (both hard-code dead workers.dev URL, verified runner:3); `.github/workflows/fetch-binance.yml` (secrets + env wiring — W3); `wrangler.jsonc` stated "no changes" (accurate: route :18-23, `workers_dev:false` :17) | INFRA-04 | Yes — Policy 1 (owner email OTP: `/`, `/charts.html`, `/calculator.html`, `/api/records*`, `/api/klines*`), Policy 2 (`/api/admin/*` Service Token), default block; API checkpoints assert 401 + `Cf-Access-Denied` for records/klines/backfill-cursor/ingest (09-PLAN.md:432-438). UI-route 302 curl expectations wrong for bare curl (W5); SC3 manual-only (I2) |

Both requirement IDs have covering tasks. INFRA-04's layered policy set now matches the amended ROADMAP SC2 and REQUIREMENTS INFRA-04 (UI + data → email OTP; admin → Service Token + INGEST_TOKEN). The prior data-endpoints-public-vs-gated conflict is resolved.

---

## 2. Success Criteria Traceability

| Success Criterion (ROADMAP ground truth) | Covering Task(s) | Status |
|---|---|---|
| SC1: User can switch between Records, Charts, and Calculator pages via a shared navigation bar | 09-01 | ✓ Covered — nav hrefs (`/`, `/charts.html`, `/calculator.html`, 09-PLAN.md:58-68) match real pages (index.html:12-13, charts.html:13-14, calculator.html:12-13); active-page logic + vitest (09-PLAN.md:232); static 3-page grep + deploy + live curl checkpoints |
| SC2: An unauthenticated request to the site **or to any `/api/*` route** is blocked (UI → email OTP redirect; data APIs → Policy 1 email OTP; admin → Policy 2 Service Token) | 09-02 (Policy 1 + Policy 2 + default block; checkpoints 09-PLAN.md:415-439) | ✓ Covered — Policy 1 paths now include `/api/records*` + `/api/klines*` (09-PLAN.md:336); Policy 2 `/api/admin/*` (09-PLAN.md:341-343); API checkpoints assert 401 + `Cf-Access-Denied` for all four endpoints (09-PLAN.md:432-438). Consistent with amended ROADMAP SC2 / INFRA-04 / D-09-04 |
| SC3: Only the owner's allow-listed email can complete the Access login and reach the UI and data APIs | 09-02 (Policy 1 condition email == `gn01968711@gmail.com`, D-09-01) | ✓ Covered — owner email locked, email OTP, default block (09-PLAN.md:334-338). Evidence is manual-only (I2); fallback branch could weaken admin gating but is a contingency (I6) |

All three SCs map to concrete tasks → no SC-coverage blocker.

---

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|---|---|---|
| 1 | Requirement Coverage | PASS | INFRA-06 → 09-01 ✓; INFRA-04 → 09-02 ✓ (layered: UI+data email OTP, admin Service Token + INGEST_TOKEN). REQUIREMENTS.md and ROADMAP SC2 amended to match the plan |
| 2 | Task Completeness | PARTIAL | 09-01: concrete files/actions/checkpoints/automated tests ✓. 09-02: TDD + dashboard + 2 policies + token + runners + CI + docs present; gaps: CI env wiring (W3), fetcher two-fetch snippet (W4), wrong typecheck command (W2), `-eth.sh` omitted from Files Modified (I7) |
| 3 | Dependency Correctness | PARTIAL | Acyclic; phase deps (5,7,8) correct. TDD block placed before Access Application Setup but its RED state requires Access live (W1). 09-01 live curl checks only pass pre-Access (W7) |
| 4 | Key Links / Wiring | PARTIAL | Nav ↔ SC1 ✓; Access policies ↔ SC2 ✓; cron re-wire present (runners + fetcher headers + live-sync checkpoint) but CI `env:` block not extended (W3) |
| 5 | Scope Sanity | PASS | 2 tasks (09-01 light, 09-02 ops-heavy); within 2–3 target |
| 6 | Success-Criteria Traceability | PASS | SC1 → 09-01; SC2 → 09-02; SC3 → 09-02. No criterion uncovered |
| 7 | Locked Decision Compliance | PASS | D-09-01 ✓ (Policy 1 owner email), D-09-02 ✓ (custom domain in wrangler route + plan), D-09-03 ✓ (Self-hosted), D-09-04 ✓ (data gated email OTP) — D-09-04 now agrees with ROADMAP/REQUIREMENTS. No task contradicts a D-XX |
| 8 | Scope Reduction Detection | PASS | No "v1 / for now / stub / placeholder / not wired yet" on in-scope work. Old "data remain public / decision deferred" hedge gone. TDD fallbacks (09-PLAN.md:320-322) are risk contingencies, not scope reduction |
| 9 | Verification Plan Quality | PARTIAL | vitest + static grep + deploy + curl present. Issues: typecheck command wrong (W2); UI-route curl expecting 302 from bare curl (W5); nav.js testability unspecified (W6); SC3 manual-only (I2) |
| 10 | Fact-check Load-bearing Claims | PASS (notes) | Verified on disk: page files + nav hrefs ✓; wrangler routes + `workers_dev:false` (commit 61a4f96) ✓; runners hard-code dead workers.dev URL ✓; fetcher endpoints + Bearer INGEST_TOKEN (backfill-fetcher.mts:50-51, 91-95) ✓; admin `auth()` exact-match (admin.ts:11-27) ✓; `/api/records` (records.ts:14), `/api/klines` (klines.ts:8), `/api/health` (index.ts:10), `/api/admin/binance-spike` (admin.ts:34) ✓; `#new-record` header binding (index.html:14, records.js:265, style.css:79-87) ✓; CSS vars `--panel/--text/--border/--accent` (style.css:3-7) ✓; nav.js/nav.test.ts absent ✓; root tsconfig includes only `src` (tsconfig.json:12) → `typecheck:scripts` required (W2); fetcher tests stub fetch without header assertions → CF-header change won't break them (W4) |

---

## 4. Issues

### Blockers

None. The two prior blockers are resolved: (B1) ROADMAP SC2, REQUIREMENTS INFRA-04, CONTEXT D-09-04 and the plan's Route Coverage all now agree that UI + data APIs are email-OTP-gated (Policy 1) and admin APIs are Service-Token-gated (Policy 2), so SC2 has covering tasks; (B2) Policy 1 now includes `/api/records*` and `/api/klines*`, so the policy set, Route Coverage, and checkpoints (401 + `Cf-Access-Denied`) are internally consistent.

### Warnings

**W1 — 09-02-TDD is ordered before "Access Application Setup," but Test 1's RED state requires Access to already be live**
- Where: Sub-Task 09-02-TDD (09-PLAN.md:276-322) precedes step 1 Access Application Setup (09-PLAN.md:326-330). Test 1 RED expects "HTTP 401 with `Cf-Access-Denied: true` (proves Cloudflare Access blocked it)" — that header only exists once the Access application gates the domain. Executed in written order, the request reaches the Worker directly and returns the app's 401 JSON **without** `Cf-Access-Denied` — indistinguishable from the GREEN signature, a false positive that triggers the wrong fallback.
- fix_hint: Reorder so Access Application Setup (step 1) comes first, then TDD Test 1 RED, then create the Service Token policy, then Test 1 GREEN + Test 2. Add one sentence: "The Access application must be live before Test 1 RED." Also state explicitly that the daily cron fails between Access going live and the Service Token re-wire landing (the live-sync checkpoint at 09-PLAN.md:380-384 covers the re-wire; make the failing window explicit).

**W2 — Typecheck command for the edited fetcher is wrong**
- Where: 09-PLAN.md:385-389, `npm run typecheck -- scripts/backfill-fetcher.mts`. `npm run typecheck` = `tsc --noEmit` with tsconfig include `["src"]` only (tsconfig.json:12); passing a file path ignores the project include list and does not use `scripts/tsconfig.json`.
- fix_hint: Use `npm run typecheck:scripts` (package.json:11 → `tsc --project scripts`), and run `npm run test` after editing `scripts/backfill-fetcher.mts`.

**W3 — GitHub Actions re-wire is incomplete: secrets are added but the workflow `env:` block is never extended, and `fetch-binance.yml` is missing from 09-02's Files-Modified list**
- Where: step 3 (09-PLAN.md:370-373) updates the `WORKER_URL` secret and adds `CF_CLIENT_ID`/`CF_CLIENT_SECRET` secrets, but the "Run backfill fetcher" step's env block (`fetch-binance.yml:34-38`) maps only `WORKER_URL`/`INGEST_TOKEN`/`SYMBOL`/`START_TIME_OVERRIDE`. The fetcher reads `process.env.CF_CLIENT_ID`/`CF_CLIENT_SECRET` (09-PLAN.md:379-380); without env mappings the job sends empty CF headers → 401 once Policy 2 is live. Files Modified (09-PLAN.md:268-272) omits the workflow file.
- fix_hint: Add `fetch-binance.yml` to Files Modified; specify extending the step `env:` with `CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}` and `CF_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}`; smoke-test one `workflow_dispatch` run post-gate.

**W4 — Fetcher change touches two fetch calls, but the plan shows one generic header snippet**
- Where: header snippet (09-PLAN.md:375-383) is generic; `backfill-fetcher.mts` has two fetches — `fetchCursor` GET (backfill-fetcher.mts:49-52) and ingest POST (:91-98) — each with its own headers object. Both must receive `Cf-Access-Client-Id`/`Cf-Access-Client-Secret` or Policy 2 rejects them.
- fix_hint: State that both fetch calls get the CF headers (or factor a shared `headers()` helper). Verified: `backfill-fetcher.test.mts` stubs global fetch without asserting request headers, so the change won't break existing tests; still run `npm run typecheck:scripts` + `npm run test` after.

**W5 — UI-route checkpoints expect HTTP 302 from a bare curl; Cloudflare Access serves 401 to non-browser clients**
- Where: 09-PLAN.md:423-430, comment "Expected: HTTP 302 (with Location: *.cloudflareaccess.com header)". Access redirects browser-like requests to the login page but returns 401 + `Cf-Access-Denied: true` for non-browser clients; a bare `curl` (`Accept: */*`, `User-Agent: curl/*`) is treated as non-browser. The checkpoints would fail against a correctly-configured gate — and the API checks at :432-438 rely on the same 401 behavior.
- fix_hint: For UI routes, assert 401 + `Cf-Access-Denied` for bare curl, or send browser-like headers (`curl -H "Accept: text/html" -H "User-Agent: Mozilla/5.0" -o /dev/null -w "%{http_code} %{redirect_url}"` → 302 → `*.cloudflareaccess.com`). Keep the incognito-browser manual check (Access-1, 09-PLAN.md:498) as the authoritative 302 proof.

**W6 — nav.js module shape is underspecified; a classic script containing `export` throws, and the vitest import needs a pure function**
- Where: Deliverable 3 (09-PLAN.md:220-224) + the only concrete snippet (09-PLAN.md:141-155) is a load-time script mutating DOM via `window.location.pathname`/`document.querySelector`. If included as a classic `<script src="/js/nav.js">` with ES `export`, every page throws a SyntaxError; if it runs DOM logic at import time, the vitest/jsdom test cannot control pathname deterministically.
- fix_hint: Specify nav.js as an ES module: export a pure `setActivePage(pathname, doc = document)` (no side effects at import), include it as `<script type="module" src="/js/nav.js">` (still matches the `src="/js/nav.js"` grep at :236-241), and run a tiny bootstrap on DOMContentLoaded. Then `nav.test.ts` imports `./nav.js` under jsdom, consistent with existing `public/js/*.test.ts`.

**W7 — 09-01's live nav verification only passes before 09-02 enables Access; the ordering is never stated**
- Where: 09-01 deploy verification (09-PLAN.md:244-258) curls the live site and greps for `nav-link`. Once 09-02 applies Access, an unauthenticated curl returns 401 (or 302), not page HTML → false failure.
- fix_hint: Add one line: "09-01 live nav checks must complete before 09-02 enables Access; afterwards these curls return 401/302 by design (verify via authenticated session or browser)."

### Info

**I1 — ROADMAP is stale for Phase 9**: "Plans: 09-01: TBD" and the progress table show all phases "Not started" despite 09-PLAN.md existing and prior phases having plans/code. Update after this check.

**I2 — SC3 evidence (non-owner blocked; session persists across navigation) is inherently manual dashboard testing.** Record date + result of each manual check in `ACCESS-CONFIG.md` so SC3 is provably true at phase close.

**I3 — "No Code Changes Required" (09-PLAN.md:190) is only true of `src/`; 09-02 modifies `scripts/backfill-fetcher.mts` and the runner scripts.** Amend to "no backend (`src/`) changes required."

**I4 — `/api/health` (index.ts:10) and `/api/admin/binance-spike` (admin.ts:34) are not enumerated in Route Coverage (09-PLAN.md:397-408).** Both are covered by the application include rule and the `/api/admin/*` policy pattern; list them so the coverage statement is complete.

**I5 — Service Token has a 90-day expiry (09-PLAN.md:358); after expiry the cron/CI backfill silently 401s.** Add a rotation/renewal reminder step to `ACCESS-CONFIG.md`.

**I6 — The TDD fallback "exclude `/api/admin/*` from Access" (09-PLAN.md:320-322) would leave SC2's admin clause unfulfilled as written; it relies on app-level INGEST_TOKEN alone.** Acceptable contingency, but if ever used, SC2/INFRA-04 and D-09-04 must be amended and it must be logged in ACCESS-CONFIG.md.

**I7 — `~/.config/btcethdivergence/backfill-runner-eth.sh` is updated in step 3 (09-PLAN.md:368) but missing from 09-02's Files-Modified list (09-PLAN.md:268-272).** Add it for completeness.

---

## 5. Recommendation

**Ready to execute.** The revision resolved the two prior blockers: ROADMAP SC2 and REQUIREMENTS INFRA-04 were amended to the layered policy split, CONTEXT D-09-04 now says data endpoints are email-OTP-gated, and the plan's Policy 1 (`/api/records*`, `/api/klines*` under owner email OTP), Policy 2 (`/api/admin/*` under Service Token), default block, and checkpoints (401 + `Cf-Access-Denied` for all `/api/*`) are internally consistent and traceable to SC1/SC2/SC3. All load-bearing claims verified on disk; scope is 2 tasks; no scope-reduction hedging.

The 7 warnings are execution-time clarity and verification-fidelity issues, none of which prevent the goal being met if the executor follows them: sequence TDD after Access is live (W1), use `typecheck:scripts` (W2), extend the CI `env:` block (W3), add CF headers to both fetcher fetches (W4), fix the UI-route curl expectation (W5), make nav.js an ES module with a pure `setActivePage` (W6), and finish 09-01's live checks before enabling Access (W7).

Re-check only if a fallback path (W1/I6) is taken during execution.

---

*Checker note: this check supersedes the previous 9-PLAN-CHECK.md (2 blockers / 5 warnings / 7 info). Resolved since then: SC2/INFRA-04/D-09-04 alignment (prior B1), self-consistent policy set + checkpoints (prior B2), data-endpoint checkpoints now assert 401 consistently with the gated decision (prior W4). Remaining warnings focus on operational wiring and verification fidelity.*