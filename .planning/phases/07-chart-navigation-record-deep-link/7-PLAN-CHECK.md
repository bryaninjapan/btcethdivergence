# Phase 7 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial)
**Date**: 2026-08-31
**Phase**: 7 — Chart Navigation & Record Deep Link
**Plan(s) verified**: 07-01-PLAN.md (CHART-04, CHART-05), 07-02-PLAN.md (CHART-06)
**Status**: **ISSUES FOUND — 0 blocker(s), 2 warning(s), 7 info**

Ground truth used: ROADMAP.md Phase 7 section, REQUIREMENTS.md (CHART-04/05/06 + v2 ECHART-01/02), PROJECT.md, research/ARCHITECTURE.md + PITFALLS.md, and the live source tree (`public/js/charts.js`, `chart-sync.js`, `datetime.js`, `records.js`, `api.js`, `charts.html`, `index.html`, `css/style.css`, `src/routes/klines.ts`, `src/lib/db.ts`, `src/types.ts`, `tsconfig.json`, `package.json`, `wrangler.jsonc`). No CONTEXT.md and no `*-RESEARCH.md` exist in the phase dir; Phase 5/6 are merged (git log `573b92b`, `44fc1bf`) and Phase 6 signed off (6-UAT.md), so `depends_on: ["06-02"]` and the 07-02 dependency on existing `records.js` hold.

## 1. Coverage Summary

| Requirement | Covered by | Concrete task(s) |
|---|---|---|
| CHART-04 (toggle log scale on/off for both charts) | 07-01 | Task 2 (`#log-scale` checkbox, one control not per-chart) + Task 3 (`setLogScale(enabled)` iterates `btcChart`/`ethChart` right price scale via `LightweightCharts.PriceScaleMode.Logarithmic/Normal`) |
| CHART-05 (custom time range via date pickers) | 07-01 | Task 1 (`nowRange()`, `parseRangeParams`, validation) + Task 2 (UTC-labeled start/end dropdowns + `載入範圍` button + `#range-summary`) + Task 3 (`loadRange(startMs,endMs)` → `Promise.all` fetch → `setData` on BOTH series) |
| CHART-06 (record → chart deep link, ±24h padding) | 07-01 + 07-02 | 07-01 Task 1 (`recordToRange` ±24h + round-trip test) + 07-01 Task 3 (`parseRangeParams(window.location.search) ?? nowRange()` init) + 07-02 Task 1 (`查看K線` per row → `recordToRange` → `location.assign('/charts.html?start=…&end=…')`) + 07-02 Task 2 (E2E SC3 proof + fallback regression) |

No requirement has zero coverage. **PASS.**

## 2. Success Criteria Traceability

| Success Criterion (ROADMAP) | Delivered by | Evidence |
|---|---|---|
| SC1 — toggle log scale on/off for both charts at once | 07-01 Task 2 (single `#log-scale` checkbox) + 07-01 Task 3 (`setLogScale` applies mode to both chart instances' `priceScale('right')`) | One control flips both; browser checkpoint 3 + 4 (log toggle does not break CHART-03 sync); `PriceScaleMode` marker curl |
| SC2 — pick a custom start/end range, both charts load it | 07-01 Task 1 (range math/validation) + Task 2 (UTC pickers, `載入範圍`, `#range-summary`) + Task 3 (`loadRange` → both series `setData`) | Browser checkpoint 2 (2023-01-01→2023-02-01 on both charts); `/api/klines` ms contract verified (klines.ts:15-22) |
| SC3 — "View Chart" loads both charts centered on the record window with ~24h padding | 07-01 Task 1 (`recordToRange` ±24h; unit + round-trip case 10) + 07-01 Task 3 (param-driven init) + 07-02 Task 1 (`查看K線` → deep-link URL) + 07-02 Task 2 (checkpoint B) | Automated: chart-range.test.ts round-trip (record→URL→parse); manual: 07-02 checkpoint B (axis shows start−24h … end+24h, record span centered) |

Symmetric ±24h padding plus LWC auto-fit on `setData` places the record's span geometrically centered in the loaded window. No criterion lacks a covering task. **PASS.**

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|---|---|---|
| 1 | Requirement Coverage | PASS | CHART-04/05/06 all covered by concrete tasks; no zero-coverage |
| 2 | Task Completeness | PASS | Every task names files, concrete action (with mandated code), verify steps, and done criteria |
| 3 | Dependency Correctness | PASS | 07-01 (T1→T2→T3), 07-02 (T1→T2), 07-02→07-01, 07-01→06-02; acyclic; every precondition names its exact prior output |
| 4 | Key Links / Wiring | PASS | charts.js→chart-range.js→records.js→charts.html chain delivers every SC; sync re-link discipline (unsub→setData→align→resub) matches Phase 6 "align before link" |
| 5 | Scope Sanity | PASS | 07-01 = 3 tasks, 07-02 = 2 tasks (within 2–3 target) |
| 6 | Success-Criteria Traceability | PASS | See §2; all three SCs delivered |
| 7 | Locked Decision Compliance | PASS | No CONTEXT.md (no D-XX). PROJECT.md constraints respected: single Worker + static assets (INFRA-01), no build step, LWC v5 CDN pinned (5.2.1 verified in charts.html:8), UTC labeling (REC-08 carry-over), logical-range-only sync (CHART-08) enforced via must-never-appear greps |
| 8 | Scope Reduction Detection | PASS | Deferrals are legitimately out of scope: ECHART-01/02 are v2 per REQUIREMENTS.md; log-scale persistence is not required by SC1; record button is split to 07-02, not dropped |
| 9 | Verification Plan Quality | PASS* | vitest (incl. record→URL→parse round-trip), typecheck, deployed-marker curls, must-never-appear greps, per-SC browser checkpoints. *Gap: SC2 worst-case range never exercised (see W1). No missing typecheck step — tsconfig include is `src` only (verified), public/js is untyped by design |
| 10 | Fact-check load-bearing claims | PASS* | All external claims verified true (klines ms contract, `queryKlines` unbounded, `link()` returns unsub, chart-sync/datetime/records shapes, CSS vars, CDN pin, no `chart-range.js` yet). *Prose/code contradiction inside 07-01 Task 1 (see W2) |

## 4. Issues

### Blockers

None.

### Warnings

**W1 — SC2's worst case is asserted but never verified, and it contradicts the project's own anti-pattern list.** 07-01 Task 1's rationale states "the full 2021→present dataset (~48K candles/symbol) is a bounded, single-query fetch that LWC v5 renders fine via one setData." The pickers legitimately allow a full-history range (2021-01 → present), so this is an in-scope SC2 input — yet the SC2 browser checkpoint (Task 3, step 2) exercises only a ~1-month window (2023-01-01→2023-02-01), and no automated or manual check covers the ~50K-candle-per-symbol fetch. PITFALLS.md's own Performance Traps row flags "fetching full unbounded kline ranges for `/api/klines`" and recommends a server-side max-range cap, which this phase does not add. The plan's assertion is plausible (LWC can render tens of thousands of bars; D1 can return them) but is unverified for exactly the range the rationale boasts about, and the JSON payload at that scale (~5–10MB) is a real, testable risk.
*fix_hint*: Add a full-history (or multi-year) range to the SC2 browser checkpoint (e.g. pick 2021-01-01→present, confirm both charts render and stay synced with no console errors / no API failure), OR explicitly add a server-side cap on `/api/klines` (documented as a deliberate deviation) and prove the capped behavior. Do not let the rationale claim "renders fine" without a checkpoint that exercises it.

**W2 — Internally contradictory plan text in 07-01 Task 1 "Key points" vs the mandated `parseRangeParams` code.** The mandated code now correctly guards `if (params.get('start') === null || params.get('end') === null) return null;` (so the missing-`start` case `?end=1704160800000` → `null`, matching test case 5). But the adjacent rationale paragraph still describes the pre-guard behavior: "`Number(null) === 0`, and `0 >= 0` → null" — which is only true for the missing-*end* case and is factually wrong for the missing-*start* case. If an executor "simplifies" the code to match the prose (removing the guard), the missing-start case regresses to a 1970→end window — exactly the defect this phase previously fixed.
*fix_hint*: Rewrite the rationale paragraph to describe the explicit null guard (absent `start` or `end` → `null`), keeping prose consistent with the mandated code and tests.

### Info

**I1 — Research doc uses a stale deep-link route.** ARCHITECTURE.md lines 204 and 234 show `/chart?start=…&end=…`; the plans correctly target `/charts.html?start=…&end=…`, which matches the real static file (`index.html:12` links `/charts.html`). Do not "fix" the plan to match the doc.

**I2 — Test-count/numbering inconsistency.** 07-01 Task 1 action enumerates 10 test cases with the round-trip as **case 10**; Task 1's `<verify>` says "10/10"; but the 07-01 Verification Track says "9/9" and 07-02 Task 2 references "chart-range.test.ts **test 9**" as the round-trip contract. Cosmetic, but the executor should treat the round-trip as the final case and expect the full suite count to settle at whatever the written file produces (10 cases).

**I3 — Rapid `載入範圍` clicks can race.** `loadRange` does not abort a prior in-flight request on a new call (the AbortController is per-call and not stored), so two overlapping fetches can `setData`/`setPickersFromMs` in nondeterministic completion order (last-writer-wins is not guaranteed). Not covered by any checkpoint; unlikely in single-owner use. *fix_hint (optional)*: track and abort the previous controller in `loadRange`.

**I4 — Log-scale state is page-local and resets on navigation.** 07-01 Task 3 explicitly scopes this out; SC1 only requires on-page toggling of both charts at once. If the owner later expects log state to survive the record→chart round-trip, revisit in a later phase (e.g. a `?log=1` param).

**I5 — STATE.md and the ROADMAP progress table are stale.** STATE.md reports "Current focus: Phase 1" / "Phase 4 complete"; ROADMAP's progress table lists Phase 5 and 6 as "Not started", while their code is merged (git log) and 6-UAT.md exists. Also 07-02's `depends_on` omits the Phase 5/6 plan IDs. Execution order is strictly sequential, so source presence is guaranteed — do not use STATE.md/ROADMAP-progress as the dependency source of truth.

**I6 — Verify blocks use the `<deployed-workers-dev-url>` placeholder** rather than the concrete URL given in `user_setup`. Consistent with prior-phase convention and harmless, but substituting the live URL directly in the verify blocks would remove an execution-time substitution step.

**I7 — No automated test for `setLogScale`/`loadRange` DOM wiring.** Only the `chart-range.js` math is unit-tested; the price-scale-mode and subscribe/unsubscribe behavior rests on browser checkpoints. Acceptable for a no-build, CDN-rendered static app, but a jsdom-based vitest case for `setLogScale` (mode applied to both chart instances) would make SC1 machine-provable.

**I8 — Prior-check findings re-verified as FIXED in the current plan text.** The previous check's W1 (`loadRange` double-subscribe in try+finally) and W2 (`parseRangeParams` missing-`start` returns a 1970 window) are both resolved in the plan as it now stands: the subscribe call appears only in the `finally` block, and the null guard covers both absent params. Executors should follow the current mandated code and not reintroduce the old shapes.

## 5. Recommendation

**Proceed to execution with both plans.** They are requirement-complete (CHART-04/05/06), dependency-correct and acyclic, correctly wired to all three success criteria, and carry unusually strong verification (the record→URL→parse round-trip test is a genuine automated SC3 contract; deployed-marker curls plus per-SC browser checkpoints cover the DOM wiring). Every external load-bearing claim was fact-checked against the current source and holds. The two prior warnings are already fixed in the current plan text.

Apply the two remaining warnings during execution: **W1** — add a full-history range to the SC2 checkpoint (or implement a documented server-side cap), so the "~48K candles renders fine" claim is actually proven; **W2** — align the `parseRangeParams` rationale prose with the guarded code so no executor "fixes" the code back to the buggy shape. Neither blocks a success criterion, so execution may proceed with both fixes folded in.

*Note: this report supersedes the prior `7-PLAN-CHECK.md`; its W1/W2 findings were re-verified against the updated plan text and are now resolved (see I8).*