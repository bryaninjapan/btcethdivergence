# Phase 8 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (adversarial, goal-backward)
**Date**: 2026-08-31
**Phase**: 8 — Leverage Calculator
**Plan(s) verified**: `08-PLAN.md` v1.0 (08-01, 08-02, 08-03)
**Status**: **ISSUES FOUND — 0 blocker(s), 1 warning(s), 6 info**

> Note: This report replaces a prior `8-PLAN-CHECK.md` (08:39) that was written against an older plan draft. The plan was revised at 08:41 and the current text already resolves three items that draft flagged: the browser module import specifier is now `./calculator.js` (line 260, correct); the task breakdown is 08-01 → 08-03 (3 tasks, consistent everywhere); the coverage target is uniformly `≥95%` (lines 249/353/468). This report is against the **current** plan text and verified independently against the source tree.

---

## 1. Coverage Summary

| Requirement | Covered by task(s) | Concrete? | Notes |
|---|---|---|---|
| CALC-01 Long/Short toggle | 08-01 (toggle markup, L167–168), 08-02 (direction-aware engine, L219–226; input wiring, L251–263), 08-03 (directional validation, L288–293) | ✅ | |
| CALC-02 Inputs (margin, entry, SL, TP, leverage) | 08-01 (form fields, L168–173) | ✅ | |
| CALC-03 Display position size, SL $, TP $, R:R, loss %, gain % | 08-02 (engine outputs L216–234 + real-time `input` wiring L251–263) | ✅ | All six metrics present |
| CALC-04 Leverage dropdown standard values | 08-01 (L69: 1x, 2x, 3x, 5x, 10x, 20x, 25x, 50x, 75x, 100x, 125x — 11 values, exact CALC-04 enumeration) | ✅ | Verified against REQUIREMENTS.md:46 |
| CALC-05 Warning when R:R < 1.0 | 08-03 (`riskRewardTooLow` L298–300 + `#rr-warning` display L307 + tests 10/12) | ✅ | |
| CALC-06 Liquidation warning when SL $ > margin | 08-03 (`liquidationRisk` = `lossAmount > margin` L301–303 + `#liquidation-warning` L308 + tests 11/12) | ✅ | Consistent with research PITFALLS.md:200 (`lossRate > 100%`) |
| CALC-07 Purely client-side | Architecture (L39–43: no fetch, no external API) + 08-02 (pure module, no DOM/window) | ✅ | Enforced structurally; see I-3 |

**Coverage verdict**: 7/7 requirements covered by concrete tasks. No zero-coverage requirement.

## 2. Success Criteria Traceability

| SC | Delivering task(s) | Delivered? |
|---|---|---|
| SC1 Long/Short toggle + form (margin, entry, SL, TP, leverage dropdown 1x–125x) | 08-01 (markup, toggle, select L69/L167–173), 08-02 (direction flip + wiring) | ✅ |
| SC2 Displays position size, SL $, TP $, R:R, loss %, gain % as inputs change | 08-01 (result fields L174–180), 08-02 (`calculatePosition` + `input`-event recalc L251–263) | ✅ |
| SC3 Warning when R:R < 1.0 | 08-03 (flag + `#rr-warning` show/hide + tests 10/12) | ✅ |
| SC4 Liquidation warning when SL $ > margin | 08-03 (flag + `#liquidation-warning` + tests 11/12) | ✅ |
| SC5 No network requests (fully client-side) | 08-01/08-02 (pure module, no fetch import), SC5 verification row (DevTools Network) | ✅ (manual-only; see I-3) |

**Traceability verdict**: 5/5 criteria have covering tasks. No uncovered criterion.

## 3. Dimension Results

| # | Dimension | Result | Evidence |
|---|---|---|---|
| 1 | Requirement Coverage | ✅ PASS | 7/7 mapped to concrete tasks |
| 2 | Task Completeness | ✅ PASS | Each task has concrete files, specific deliverables, checkpoints (I-4, I-6 minor gaps) |
| 3 | Dependency Correctness | ✅ PASS | 08-01 → 08-02 → 08-03, acyclic; no task assumes uncreated output |
| 4 | Key Links / Wiring | ✅ PASS | Module import specifier correct (`./calculator.js` resolves to `/js/calculator.js`); stylesheet link only implicit (I-4) |
| 5 | Scope Sanity | ✅ PASS | 3 sequential tasks, ~50 min total; within 2–3 target |
| 6 | Success-Criteria Traceability | ✅ PASS | 5/5 covered |
| 7 | Locked Decision Compliance | ✅ PASS | No CONTEXT.md / *-RESEARCH.md in phase dir (N/A). PROJECT.md honored: pure static HTML/CSS/JS, no build step, calculator independent + manual input, single Worker + Static Assets (`public/` + ASSETS binding), no D1 changes |
| 8 | Scope Reduction Detection | ✅ PASS | No hedging on in-scope work. L513 "for now" is dark-theme polish (out of scope); L314 "placeholder results" is a UX display behavior, not a stub |
| 9 | Verification Plan Quality | ⚠️ WARNING | `npm run test` (vitest, 16 tests) is automated and real; but E2E checkpoint 4's expected profit values are arithmetically wrong and the scenario does not demonstrate the transition it claims (W-1). Coverage target `≥95%` is not wired to any coverage command (I-5). No typecheck step (I-1) |
| 10 | Fact-check load-bearing claims | ✅ PASS | All claims verified: `index.html` served at `/` with `lang="zh-Hant"` (public/index.html:2), `charts.html` exists, `public/css/style.css` exists, wrangler.jsonc `assets.directory = ./public`, `tsconfig.json` `include: ["src"]`, `chart-sync.test.ts:2` imports `./chart-sync.js` (relative-import convention), `api.js` is the only prod `fetch` module (grep), PITFALLS.md:200 liquidation guidance. No mismatch found |

## 4. Issues

### Blockers

None.

### Warnings

- **W-1 — E2E checkpoint 4 (R:R < 1.0) has wrong expected values and does not demonstrate the claimed off→on transition.** Plan L371–374: for Margin 1000, Entry 42000, SL 41500, Leverage 1x, posSize = 1000/42000 = 0.0238. Loss = 0.0238 × 500 = **11.90** (plan: ~11.9, correct). Profit at TP 42100 = 0.0238 × 100 = **2.38**, not ~11.9; profit at TP 42050 = 0.0238 × 50 = **1.19**, not ~5.95. Consequently R:R is **0.2 at TP 42100 already** (and 0.1 at 42050) — the warning is on before the "Adjust TP" step, so the narrative "adjust TP → warning appears" is false. A verifier following the plan will see the warning already present at the initial values and numbers that don't match. The unit test 10 still covers the R:R warning and the formula is correct, so this does not block the goal — but the manual verification track as written will mislead.
  *fix_hint*: Rewrite checkpoint 4 with correct expectations, e.g. initial TP = **42500** (profit = 0.0238 × 500 = 11.9 → R:R = 1.0, warning off), then adjust TP to 42400 (profit = 0.0238 × 400 = 9.5 → R:R = 0.80 < 1.0, warning on). Recompute the loss/profit expected values in the checkpoint so they match `posSize × priceDistance`.

### Info

- **I-1 — No typecheck step; new `calculator.test.ts` falls outside tsconfig.** Verification only runs `npm run test`. This matches the existing repo state (`tsconfig.json` `include: ["src"]`, so `public/js/*.test.ts` — api, chart-range, chart-sync, datetime — are all already untracked by `tsc`; no `vitest.config.*` exists and vitest's default include picks up `public/js/*.test.ts`, so tests will run). Not a plan defect; optional hygiene.
  *fix_hint*: Optionally add `"public/js"` to `tsconfig.json` `include` and append `npm run typecheck` to 08-02/08-03 checkpoints.

- **I-2 — Position-size unit and precision ambiguity.** Design L74 shows "USDT or coins" while the formula `(margin × leverage) / entryPrice` yields coin quantity; E2E checkpoints treat it as coins (≈0.024). Also L132 says "2 decimal places" which renders 0.0238 as 0.02 — conflicting with the E2E expectation of 0.024.
  *fix_hint*: Pin the output label to coin quantity (e.g., "BTC"); specify display precision that keeps sub-cent precision (e.g., 4–6 significant digits) for small positions.

- **I-3 — SC5 client-side guarantee is structurally enforced but verified only manually.** `api.js` is the only production module that calls `fetch` (verified by grep); since the calculator page imports only `calculator-init.js` → `calculator.js`, no fetch is reachable. But no task states "do not include `/js/api.js` on this page," and the only SC5 verification is the DevTools Network tab.
  *fix_hint*: Add an explicit "no `/js/api.js` import on calculator.html" constraint to 08-01; optionally add a vitest test that reads `calculator.js`/`calculator-init.js` and asserts no `fetch(`/`import` of `api.js` appears, making SC5 automated.

- **I-4 — Stylesheet `<link>` and toggle-listener type unspecified.** The `calculator.html` deliverable (L162–184) never lists `<link rel="stylesheet" href="/css/style.css">` even though 08-01's CSS additions target `style.css` (all existing pages link it). Separately, L251 says an `input` listener covers `longShort`, which fires for radio buttons but not for a `<button>` toggle; the plan allows either ("radio buttons or toggle button", L59).
  *fix_hint*: List the stylesheet link in the HTML deliverable; specify listener per control (radios → `input`/`change`, button → `click`).

- **I-5 — `≥95% coverage` target is not wired to a command.** The plan asserts a coverage target (L249/L353/L468) but `npm run test` is `vitest run` with no `--coverage` flag, so the target is unmeasurable and unenforced. `@vitest/coverage-v8` is already installed.
  *fix_hint*: Change the checkpoint to `npx vitest run --coverage` (or add a `test:coverage` script) so the 95% gate is actually measured.

- **I-6 — 08-03 "Files Modified" omits `calculator.test.ts` (and `calculator-init.js`).** 08-03's file list (L278–281) covers only `calculator.js`, `calculator.html`, `style.css`, but deliverable 5 (L318–325) adds tests 10–16 to `calculator.test.ts`, and the warnings display also touches `calculator-init.js` (wired in 08-02, re-shown in 08-03). Minor completeness nit.
  *fix_hint*: Add `public/js/calculator.test.ts` (and note `calculator-init.js`) to 08-03's "Files Modified".

## 5. Recommendation

**Plans verified. Ready to execute.** No blockers. All 7 CALC requirements and all 5 success criteria have concrete, correctly ordered covering tasks; the current plan text already incorporates the earlier draft's fixes (import specifier, task count, coverage target). Every load-bearing source claim was verified against the real tree and matches. The single warning (W-1) is confined to the manual E2E checkpoint's expected numbers — the formula and unit tests are correct, so fix the checkpoint values during execution per the hint. I-1…I-6 are optional hygiene.