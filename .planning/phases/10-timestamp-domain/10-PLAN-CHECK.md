# Phase 10 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (adversarial, goal-backward)
**Date**: 2026-09-01
**Phase**: 10 — Timestamp Domain Abstraction
**Plan(s) verified**: 10-01 (backend integration), 10-02 (frontend integration), 10-03 (code review & verification)
**Status**: **ISSUES FOUND — 0 blocker(s), 3 warning(s), 7 info**

---

## 1. Coverage Summary

| Requirement / Scope | Covering Task(s) | Covered? |
|---------------------|------------------|----------|
| CODE-01 (type safety) | 10-01: 6 backend conversions → typed `Timestamp` API; 10-02: 4 frontend conversions → `public/js/timestamp.js`; `npm run typecheck` (tsconfig `strict:true`) + `typecheck:scripts` | ✅ |
| CODE-02 (maintainability) | 10-01/10-02: collapse 10 scattered `Math.floor(ms/1000)` sites into one value-object class; single source of truth; parity tests for the frontend duplicate; grep-verified zero | ✅ |
| Backend conversion sites (6) | 10-01: db.ts:51,89,124; binance.ts:17; klines.ts:21,22 | ✅ |
| Frontend conversion sites (4) | 10-02: charts.js:95,96; datetime.js:42; records.js:124 | ✅ |
| New file `public/js/timestamp.js` (D2) | 10-02 task 1 + parity tests in `public/js/timestamp.test.js` | ✅ |
| SC5 code review | 10-03 (`gsd-code-review`; zero HIGH/CRITICAL is the acceptance criterion) | ✅ |

**Conversion inventory fact-check** (all against real source via ripgrep): 10 production sites verified exact — backend `db.ts:51/89/124` (`Math.floor(Date.now()/1000)`), `binance.ts:17` (`Math.floor(raw[0]/1000)`), `klines.ts:21/22` (`Math.floor(startMs/endMs/1000)`); frontend `charts.js:95/96`, `datetime.js:42` (`Math.floor(Date.UTC(...)/1000)`), `records.js:124` (`Math.floor(Date.now()/1000)`). `admin.ts:42` has only `Date.now() - 2*60*60*1000` (ms-domain spike window for the Binance API call, which requires ms) — correctly excluded. `scripts/backfill-fetcher.mts` has only `* 1000` ms-domain arithmetic and no `--dry-run` flag — the plan's revised verification (`npm test -- src/binance.test.ts`) is accurate. Inventory is complete and exact; no missed `Math.floor(ms/1000)` anywhere in src/ or public/js.

## 2. Success Criteria Traceability

| SC | Criterion | Delivering Task(s) | Covered? |
|----|-----------|--------------------|----------|
| SC1 | All backend time operations use `Timestamp` API instead of `Math.floor(ms / 1000)` | 10-01 (6 replacements in db.ts, binance.ts, klines.ts; `npm run typecheck`) | ✅ |
| SC2 | All frontend time operations use `Timestamp` API for conversions | 10-02 (4 replacements in charts.js, datetime.js, records.js) | ⚠️ Partial — see W1 (4 frontend sec→ms sites remain raw arithmetic: records.js:25, datetime.js:46, charts.js:179, chart-range.js:5,6,22) |
| SC3 | Zero `Math.floor(ms / 1000)` in production code | 10-01 grep (`rg "Math.floor" src --type ts -g '!*.test.*'` → only timestamp.ts:27); 10-02 grep (`public/js --type js` → empty) | ⚠️ Partial — see W3 (1 sanctioned exception retained inside `src/lib/timestamp.ts`) |
| SC4 | Timestamp class fully tested, 44/44 passing | Pre-existing: 44 `it()` blocks verified in `src/lib/timestamp.test.ts`; re-verified by 10-01 `npm test -- src/` | ✅ |
| SC5 | Code review approval, no HIGH issues | 10-03 (acceptance = zero HIGH/CRITICAL) | ✅ |

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|-----------|--------|-------|
| 1 | Requirement Coverage | ✅ PASS | CODE-01 and CODE-02 both have concrete covering tasks (verified above) |
| 2 | Task Completeness | ✅ PASS | Every task names concrete files, a specific action, verify step, and acceptance; 10-01/10-02/10-03 each end with an explicit commit + "Success" definition |
| 3 | Dependency Correctness | ✅ PASS | 10-01 ∥ 10-02 → 10-03 is acyclic; 10-02 depends only on pre-existing `src/lib/timestamp.ts`; no task assumes output produced later in the phase |
| 4 | Key Links / Wiring | ✅ PASS | Each artifact delivers a criterion: timestamp.ts→db/binance/klines (SC1), timestamp.js→charts/datetime/records (SC2), parity tests→D2 risk, grep→SC3, typecheck→CODE-01, review→SC5 |
| 5 | Scope Sanity | ⚠️ PASS w/ note | 9–12 checklist items per plan exceeds the 2-3 target, but items are 5–15 min sub-steps (replace→run→grep→commit) of one cohesive 2–3h unit; splitting would fragment it. ROADMAP mandates exactly 2 plans (I3) |
| 6 | Success-Criteria Traceability | ⚠️ Partial | SC2 (W1) and SC3 (W3) literal wording broader than delivered scope; both are documented decisions with cheap closures |
| 7 | Locked Decision Compliance | ✅ PASS | D1 Option B: `Kline.open_time: number` (types.ts:7) unchanged, no migration, no type ripple — verified. D2 Option A: `public/js/timestamp.js` plain ESM via Static Assets (`wrangler.jsonc` assets → ./public) honors the no-build-step constraint (Phase 6 SC4, PROJECT.md) |
| 8 | Scope Reduction Detection | ✅ PASS | No hedging/v1/stub language on in-scope work; exclusions (chart-range.js, sec→ms sites) are documented decisions with rationale, not placeholders |
| 9 | Verification Plan Quality | ⚠️ PASS w/ issue | `npm test -- src/`, `npm run typecheck`, `npm run typecheck:scripts`, grep commands, and parity test all valid against package.json/tsconfig. W2: the two frontend grep commands in the plan disagree on test-file exclusion |
| 10 | Fact-check load-bearing claims | ✅ PASS | All 10 line numbers, 112-line/44-test Timestamp class, `fromMillis` floor at timestamp.ts:27, negative-ms rejection, `Math.trunc`≠`Math.floor` on negatives (hence the added negative guard is required), `strict:true`, ESM `<script type="module">`, no `--dry-run` — all verified against source. No mismatch found |

## 4. Issues

### Blockers
None. Every success criterion has a delivering task or a verified pre-existing condition (SC4's 44/44 is already true). The prior check's 4 blockers (incomplete inventory, frontend mechanism, type ripple, admin.ts scope) are verified resolved: inventory is exact, D1 Option B matches `types.ts:7`, D2 Option A matches the no-build-step constraint, and admin.ts genuinely contains no target conversion.

### Warnings

**W1 — SC2 wording is broader than the plan's frontend conversion set.**
ROADMAP SC2 says *"All frontend time operations use `Timestamp` API for conversions."* The plan converts the 4 `Math.floor(ms/1000)` sites but leaves these frontend sec→ms conversion operations on raw arithmetic: `records.js:25` (`new Date(ts * 1000)`), `datetime.js:46` (`new Date(ts * 1000)`), `charts.js:179` (`loadRange(startSec * 1000, …)`), `chart-range.js:5,6,22` (`* 1000`). The W1/W5 sections document the scoping with the phase-goal rationale (the Goal line scopes to `Math.floor(ms / 1000)`), and the exclusions are defensible (unidirectional, well-named adapters), but the criterion's literal text is only partially satisfied.
- *fix_hint*: Either convert the four sites in 10-02 (cheap: `Timestamp.fromSeconds(ts).toDate()`, `Timestamp.fromSeconds(s).toMillis()`), or tighten ROADMAP SC2 to "all ms↔sec conversions that use `Math.floor(ms/1000)`" so the criterion matches the goal. Decide before closing the phase.

**W2 — The two frontend grep verification commands in the plan disagree.**
The 10-02 task list (PLAN.md:165) runs `rg -n "Math\.floor" public/js --type js -g '!*.test.js'` and demands empty. The W1 verification summary (PLAN.md:236) runs `rg -n "Math\.floor" public/js --type js` (no exclusion) and also demands empty. `--type js` matches `*.js` — including the NEW `public/js/timestamp.test.js`. If the parity test computes any expected value with `Math.floor` (plausible, since it mirrors floor semantics), the summary command fails spuriously even though all production code is clean. (Existing `datetime.test.ts:41` is `.ts`, so it is correctly not matched either way.)
- *fix_hint*: Standardize both commands on `-g '!*.test.js'`, or require the parity test to use only literal expected values / `Math.trunc`. Pick one source of truth for the final verification.

**W3 — SC3 literal wording ("zero `Math.floor(ms/1000)` in production") vs. the retained sanctioned exception.**
After 10-01, exactly one `Math.floor(millis / 1000)` remains in production: `src/lib/timestamp.ts:27`, inside the Timestamp class itself — the single source of truth the phase exists to create. This is semantically correct (it *is* the consolidation), and the grep deliberately accepts it, but SC3's literal text will not be true.
- *fix_hint*: Either switch `timestamp.ts:27` to `Math.trunc(millis / 1000)` — equivalence is already TDD-validated by `test-math-trunc-equivalence.mts` in the repo root, making the count literally zero — or amend ROADMAP SC3 to "zero `Math.floor(ms/1000)` outside `src/lib/timestamp.ts`." Cheap either way; close it so criterion and verification agree.

### Info

**I1 — `LEARNING.md` does not exist for phase 10.** Phases 02, 04–09 each have one; `10-timestamp-domain/` does not. The Documentation checklist (PLAN.md:77) says "LEARNING.md updated" — should read "create LEARNING.md".

**I2 — Task granularity above the 2-3/plan target.** 10-01 (~9 items), 10-02 (~12), 10-03 (~6) exceed the target, but each item is a small sub-step (replace, run, grep, commit) within one cohesive 2–3h unit. No split needed.

**I3 — 10-03 is not in the ROADMAP.** ROADMAP's "Plans" line lists only 10-01 and 10-02, and the progress table shows "0/2". If 10-03 is a formal plan (it is, and it's the SC5 delivery point), ROADMAP should list it and show "0/3".

**I4 — Redundant backend-grep task.** 10-02 re-runs 10-01's backend `rg "Math.floor" src` check. Harmless confirmation; keep one as source of truth.

**I5 — New `public/js/timestamp.js` is not type-checked.** tsconfig `include` is `["src"]`, so `npm run typecheck` never covers the frontend duplicate. This is by design (plain-JS frontend, no build step); the parity tests are the safety net. Acceptable, but the coverage boundary is worth noting in LEARNING.md.

**I6 — CONTEXT.md problem statement lists admin.ts as a conversion site.** Verified: admin.ts has none (`Date.now() - 2*60*60*1000` is ms-domain spike-window arithmetic for the Binance call, not `Math.floor(ms/1000)`). PLAN.md's inventory correctly excludes it; only CONTEXT.md's prose is stale.

**I7 — charts.js negative URL-param edge case changes behavior.** `parseRangeParams` (chart-range.js:13-17) accepts negative finite values, so `/charts.html?start=-3600000&end=3600000` currently renders a 1969-era picker with a 200 empty response. After 10-02 the frontend `Timestamp.fromMillis` negative guard throws, failing chart init gracefully ("圖表初始化失敗" via the top-level catch) — consistent with the new backend 400 rejection. Deliberate and reasonable, but not called out in the plan; add a one-line note or clamp in `setPickersFromMs`.

## 5. Recommendation

The plan is execution-ready with **zero blockers**. All 5 success criteria have delivering tasks or verified pre-conditions; the 10-site conversion inventory is exact against real source; D1 (boundaries-only) and D2 (duplicate JS) honor the locked decisions and the no-build-step constraint; the negative-millis guard on the frontend duplicate is genuinely required (Math.trunc ≠ Math.floor for −1000 < ms < 0, and the plan handles it); and the new klines 400 guard now covers both `startMs` and `endMs` with a test.

Address the three warnings before/while executing — all are cheap, non-blocking:
1. **W3 first** (cheapest): switch `timestamp.ts:27` to `Math.trunc`, or amend ROADMAP SC3 wording. Either closes the literal criterion.
2. **W2** (execution-text bug): standardize the frontend grep on `-g '!*.test.js'`.
3. **W1** (SC2 wording): convert the 4 sec→ms sites or tighten ROADMAP SC2 — decide before closing so the phase can be marked honestly complete.

No success criterion is unachievable as written. Plans verified. Ready to execute.

---

*Plan check: 2026-09-01. Supersedes the prior check (0 blockers / 3 warnings / 6 info): W3 from that check (endMs guard + test) is now resolved in PLAN.md; W2 (grep test-file exclusion) remains in the W1 summary section; W1 (SC2 wording) remains open.*