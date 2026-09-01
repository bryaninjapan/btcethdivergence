# Phase 13 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial)
**Date**: 2026-09-01
**Phase**: 13 — Frontend Data Isolation & UI Enhancement
**Plan(s) verified**: `.planning/phases/13-frontend-data-isolation/PLAN.md` (13-01..13-04), `.planning/phases/13-frontend-data-isolation/PLAN-13B-UI.md` (13b-01, 13b-02)
**Status**: **ISSUES FOUND — 1 blocker, 9 warnings, 6 info**

No CONTEXT.md or *-RESEARCH.md exists for this phase. PROJECT.md locked decisions reviewed. All load-bearing claims independently verified against the actual tree (`wrangler.jsonc`, `charts.html`/`index.html`, `public/js/*`, `src/domains/divergence.ts`, `src/public/*`, `package.json`, `playwright.config.ts`, `e2e/`, `tsconfig.json`, vitest.config.ts, phase-12 artifacts). A prior PLAN-CHECK.md existed; this is an independent re-verification that also **corrects one factual error in that prior report** (see W-4).

## 1. Coverage Summary

| Requirement | Plan(s) covering it | Verdict |
|---|---|---|
| CODE-05 (Frontend Testability) | 13-01 (chartState factory + tests), 13-02 (recordsManager + tests), 13-03 (FormBinder) | Covered — but undermined by B-1; weakened by W-1, W-2, W-5, W-6, W-7 |
| UI-01 (Chart Styling) | 13b-01 (K-line colors), 13b-02 (indicator marks) | Covered — but 13b-01 is already done (W-3) and 13b-02's spec is factually broken (W-4) |

Both requirement IDs appear with concrete covering tasks → no zero-coverage BLOCKER.

## 2. Success Criteria Traceability

| SC (ROADMAP) | Delivering task(s) | Verdict |
|---|---|---|
| 1. Zero globals in `charts.js`, `records.js` | 13-01 T3, 13-02 T3 | Partial — W-1 (global sweep incomplete; `window.__charts` leak unaddressed); B-1 blocks the refactor from ever loading |
| 2. `createChartState()`, `createRecordsManager()` factories | 13-01 T1, 13-02 T1 | Covered, but blocked by B-1 (modules unreachable by browser) |
| 3. 350+ tests, ≥85% coverage | 13-04 T2 | Covered, but no enforcing command — W-2 |
| 4. E2E: charts/records/calculator journeys | 13-01 T4, 13-02 T4, 13-04 T3 | Covered, but manual-only (Playwright unused) and 13-02 T4 targets a nonexistent page — W-5, W-9 |
| 5. TradingView K-line colors | 13b-01 | Already satisfied in current code — W-3 |
| 6. Indicator marks, correct colors/positions | 13b-02 | Spec references nonexistent types + undefined geometry — W-4 |
| 7. Review: zero HIGH/CRITICAL | 13-04 T1 | Covered |
| 8. Docs: README, LEARNING, VERIFICATION | PLAN.md "Documentation Updates" | Covered (paths vague — I-5) |

All 8 SCs have a named task → no traceability BLOCKER, but four SCs (1, 3, 4, 6) hang on weak or factually-broken tasks.

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|---|---|---|
| 1 | Requirement Coverage | PASS | CODE-05 + UI-01 both present |
| 2 | Task Completeness | FAIL | B-1 (module path), W-7 (nonexistent function), W-8 (vague task), W-9 (nonexistent pages) |
| 3 | Dependency Correctness | PASS | 13-01 → 13-02 → 13-03 → 13-04 sequential; 13b depends on 13a; acyclic, no forward refs |
| 4 | Key Links / Wiring | FAIL | B-1 (module not browser-loadable), W-5 (E2E not wired to Playwright), W-4 (marks spec cannot match real records) |
| 5 | Scope Sanity | PASS | 3–4 tasks per plan (< 5); 13b = 2 changes + integration |
| 6 | Success-Criteria Traceability | PASS* | all 8 traceable; four depend on flawed tasks |
| 7 | Locked Decision Compliance | PASS | No contradiction; "no build step" constraint (PROJECT.md) actually reinforces B-1; display-only marks don't conflict with out-of-scope "click mark → calculator" |
| 8 | Scope Reduction Detection | PASS | No "v1/placeholder/stub/not wired yet" hedging on in-scope work |
| 9 | Verification Plan Quality | FAIL | W-2 (no 85% gate), W-5 (no `npx playwright test`), W-6 (no `npm run typecheck`); 13b has zero verification commands |
| 10 | Fact-check load-bearing claims | FAIL | B-1, W-1, W-3, W-4, W-7, W-9 (see Section 4) |

## 4. Issues

### Blockers

**B-1 — New modules placed in `src/public/` are unreachable by the browser.**
`wrangler.jsonc:7` serves static assets only from `./public` (`"directory": "./public"`); `src/` is the Worker bundle (`main: src/index.ts`). Charts/records pages load browser ES modules from `/js/...` (`charts.html:58-60`, `index.html:116-118`), which resolve to `public/js/`. 13-01 T1, 13-02 T1, 13-03 T1 create `src/public/chart-state.js`, `src/public/records-state.js`, `src/public/form-binder.js` → runtime 404 → SC #1/#2/#4 and 13b all fail. Repo precedent confirms `src/public/` is for **tests only**: it currently holds only `src/public/calculator-init.test.ts`, which dynamic-imports the real production module from `public/js/calculator-init.js`. Placing modules in `src/public/` would also either break the locked "no build step" constraint or require an unplanned copy/bundle step that does not exist.
**fix_hint**: Create the three modules in `public/js/` (chart-state.js, records-state.js, form-binder.js) as plain ES modules so `charts.js`/`records.js` can import them; keep tests in `src/public/*.test.ts` or `public/js/*.test.ts` per existing convention.

### Warnings

**W-1 — SC #1 global sweep is incomplete; the plan's own global list is wrong.**
`charts.js:15-17` module globals: `btcChart, ethChart, btcSeries, ethSeries, sync, unsubBtc, unsubEth, activeController`, plus a deliberate leak `window.__charts` (`charts.js:165`). `records.js:15-18`: `recordsCache, editingId, deleteId, latestRequestToken`. PLAN.md 13-01 T1 says the factory encapsulates `btcChart, ethChart, btcSeries, ethSeries, lastZoomLevel, syncToken` — but **`lastZoomLevel` and `syncToken` do not exist anywhere** (verified: no matches in `public/js/` or `src/`), while `sync`, `unsubBtc/unsubEth`, `activeController`, and `window.__charts` are unaccounted for.
**fix_hint**: Enumerate every real module global in the factory (or module-scoped internals); add an explicit task to remove `window.__charts`; assert `window.__charts === undefined` in a test.

**W-2 — SC #3 coverage gate is not enforced.**
`package.json:13` `test:coverage` runs with `--coverage.thresholds.lines=80` and include globs `src/**/*.ts` + `public/js/**/*.js`. PLAN 13-04 T2 says only "Coverage report (target 85%+)" — no command that fails below 85. Modules left at `src/public/*.js` (see B-1) would also be silently excluded from the coverage report.
**fix_hint**: Add enforcing step, e.g. `npm run test:coverage -- --coverage.thresholds.lines=85`, and keep new modules under `public/js/` so they are counted.

**W-3 — 13b-01 (K-line colors) is already implemented; the plan's premise is false.**
`charts.js:45-51` already sets `upColor: '#26a69a'`, `downColor: '#ef5350'`, `borderVisible: false`, `wickUpColor: '#26a69a'`, `wickDownColor: '#ef5350'` — the exact TradingView-style values 13b proposes. PLAN-13B-UI.md:15 ("Current: Default Lightweight Charts colors") is factually wrong; SC #5 is already satisfied.
**fix_hint**: Convert 13b-01 into a verification-only task (assert the color values, e.g. a chartState/Playwright assertion) or drop it; re-scope the 0.5d budget.

**W-4 — 13b-02 indicator-mark spec references nonexistent types and undefined geometry.**
The real domain enum is `btc_hh_eth_lh | btc_lh_eth_hh | btc_ll_eth_hl | btc_hl_eth_ll` (`src/domains/divergence.ts:3-8`, mirrored in `public/js/divergence.js:3-8`). There is **no** `bearish`/`bullish` value. PLAN-13B-UI.md:56 `type === 'bearish' ? '#ef5350' : '#26a69a'` cannot match any real record — executed literally, every mark falls to the green branch and SC #6's "correct colors/positions" fails. The type→color→position mapping, per-pane assignment (each type describes a BTC+ETH combination), how record time (start vs end) maps to mark time, and "Line: divergence duration" (PLAN-13B-UI.md:50, not expressible with single-point `series.setMarkers`) are all unspecified. No 100+ mark perf command exists despite the criterion.
**Note (correction of prior check)**: the previous PLAN-CHECK incorrectly stated the enum as `time_lag | structural | opposite`; the verified values are the four HH/LH/HL/LL combinations above.
**fix_hint**: Define an explicit mapping over the real 4-type enum (type → color → pane → start/end time), choose a concrete duration representation (start+end markers or an overlay series), and add a performance/verification step for 100+ marks.

**W-5 — SC #4 E2E is not wired to the repo's existing Playwright infra.**
`playwright.config.ts` (baseURL `localhost:8787`, `webServer: npm run dev`) exists and phase 12 ran `npx playwright test → 13 passed` (12-SUMMARY.md:64). `e2e/` contains only `calculator-init.spec.ts`. The plan's 13-01 T4 / 13-02 T4 / 13-04 T3 are manual browser checklists and never mention Playwright or new charts/records specs.
**fix_hint**: Add `e2e/charts.spec.ts` (render + time-sync + zoom-sync + log-scale) and `e2e/records.spec.ts` (create/edit/delete/filter); reference `npx playwright test` in the verification section.

**W-6 — Verification omits type-checking.**
`package.json:10-11` defines `typecheck` (`tsc --noEmit`, tsconfig includes `src`) and `typecheck:scripts`; phase 12 explicitly kept them clean. The plan changes `public/js/*` and adds tests under `src/`, but no task runs either command.
**fix_hint**: Add `npm run typecheck` and `npm run typecheck:scripts` to 13-04's verification commands.

**W-7 — 13-03 references a function that does not exist and misstates the duplication.**
`buildUtcDate()` does not exist; the real function is `buildUtcEpoch` (`datetime.js:43`), and it is **already** the single source of truth both modules import. The actual duplication 13-03 should target is the picker DOM helpers duplicated in both files: `fillSelect`, `rebuildDays`, `setPickerFromEpoch`, `pickerEpoch` (charts.js:56-93, records.js:106-153; `populatePicker` only in records.js:126-136).
**fix_hint**: Restate 13-03 T2 as "extract the duplicated picker helpers into the shared module"; `buildUtcEpoch` is already shared and should be imported, not re-extracted.

**W-8 — 13-01 T3's "Update chart-range.js, chart-sync.js to use chartState" is vague and likely wrong.**
`chart-sync.js:5` is already an isolated factory (`createRangeSync`) and `chart-range.js` is pure functions; "make them use chartState" is undefined and would couple already-isolated modules back into shared state. The factory should consume them, not vice-versa.
**fix_hint**: Restate as "the factory owns `sync`/`unsubBtc`/`unsubEth` lifecycle via `createRangeSync`, leaving chart-sync.js/chart-range.js unchanged", or delete the task.

**W-9 — Plan references two pages that do not exist.**
`public/records.html` does not exist — the records page is `public/index.html` served at `/` (verified: `#records-table` at index.html:40); PLAN.md 13-02 T4's "Load /records.html" would 404. PLAN-13B-UI.md:3 targets "chart.html"; the file is `charts.html`.
**fix_hint**: Use `/` for the records journey and `charts.html` for the chart page.

### Info

**I-1 — Test-baseline ambiguity; no per-module new-test targets.**
Phase 12 docs disagree internally (12-SUMMARY.md:62 "326 passed", 12-VERIFICATION.md/UAT "327"); the plan cites "327". Reaching 350+ needs ≥23 new tests; the plan gives no per-module counts for chartState / recordsManager / FormBinder.
**fix_hint**: Add explicit per-module new-test counts so SC #3 is auditable.

**I-2 — Timeline mismatches.**
ROADMAP durations 13-01..13-04 sum to 5 days (2+1.5+1+0.5); PLAN.md's timeline table sums to ~4.5 days but header says "4 days". 13b: ROADMAP sums 1.5d; PLAN-13B-UI timeline says 2d (0.5+1+0.5).
**fix_hint**: Reconcile the durations between ROADMAP and both plan files.

**I-3 — Premature ✅ checkmarks.**
Both plan files mark dependencies and success criteria as ✅ pre-execution (e.g., PLAN-13B-UI.md:10 "Phase 13a — Complete ✅"; PLAN.md's overall SC block is all ✅). Misleading in a not-yet-executed plan.
**fix_hint**: Use ☐ until actually done.

**I-4 — "FormBinder is pure (no DOM side effects)" contradicts its own duties.**
`readForm(selector)`/`populateForm(data)` and UTC-picker logic manipulate the DOM by design.
**fix_hint**: Clarify as "no global/module-level side effects; DOM accessed only via injected elements/selectors".

**I-5 — Documentation and 13b criteria not integrated into PLAN.md.**
"Documentation Updates" names README/SUMMARY/LEARNING/VERIFICATION but no paths or contents; PLAN.md's overall SC section (lines 161-170) omits the K-line color and indicator-mark criteria that live only in the 13b file.
**fix_hint**: Add file paths to doc tasks; have 13-04 T1's review cover the 13b files; fold 13b SCs into the overall success-criteria list.

**I-6 — "~0 lines removed (just restructured)" is not an acceptance metric.**
The refactor removes globals and adds factory code; a line-count claim neither proves nor measures the goal.
**fix_hint**: Drop the claim; replace with the enforceable SC #1/#2 assertions.

## 5. Recommendation

The plan's structure is sound — requirements covered, dependencies acyclic and correctly ordered, all 8 success criteria traceable to named tasks, scope within limits, no locked-decision violations, no hedging. It is **not executable as written**: the single BLOCKER (production modules placed in `src/public/`, which the browser can never load) directly breaks SC #1/#2/#4 and everything 13b builds on, and it would drag in a phantom build step that contradicts the locked "no build step" architecture. Four of the eight success criteria additionally sit on weak or factually-wrong tasks: colors are already implemented (13b-01), the mark spec references nonexistent types (13b-02), E2E ignores the repo's Playwright setup, and the 85% coverage gate has no enforcing command and no typecheck step.

Revise before execution: (a) relocate the three new modules to `public/js/`; (b) fix the global enumeration + remove `window.__charts`; (c) correct the 13b-02 type mapping over the real 4-type enum; (d) add `npx playwright test` + `npm run test:coverage -- --coverage.thresholds.lines=85` + `npm run typecheck` to verification; (e) correct the `buildUtcDate` and page-name references. Then re-run this check.

**Verdict**: ISSUES FOUND — **1 blocker, 9 warnings, 6 info. Plan needs revision before execution.**