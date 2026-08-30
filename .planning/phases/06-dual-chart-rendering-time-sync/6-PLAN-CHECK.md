# Phase 6 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial) / **Date**: 2026-08-31 / **Phase**: 6 / **Plan(s) verified**: 06-01-PLAN.md, 06-02-PLAN.md / **Status**: ISSUES FOUND — 0 blocker(s), 2 warning(s), 6 info

## 1. Coverage Summary

| Requirement ID | Requirement (REQUIREMENTS.md) | Covering plan(s) | Covering task(s) | Verdict |
|---|---|---|---|---|
| CHART-01 | BTCUSDT 1h candlestick chart, top pane | 06-01 | T1 (`charts.html` `#btc-chart` pane above `#eth-chart`, stacked CSS) + T2 (`renderChart` + `CandlestickSeries` on real D1 rows) | ✓ Covered |
| CHART-02 | ETHUSDT 1h candlestick chart, bottom pane, stacked below BTC | 06-01 | T1 (`#eth-chart` directly below `#btc-chart`) + T2 (ETH series render) | ✓ Covered |
| CHART-03 | Scroll/zoom one chart applies same range to other | 06-02 | T2 (initial logical-range alignment + bidirectional `sync.link` after setData) | ✓ Covered |
| CHART-07 | LWC v5 standalone build, CDN-loaded, no build step | 06-01 | T1 (pinned `lightweight-charts@5.2.1` standalone script tag; must-never-appear greps for `addCandlestickSeries` and `@latest`) | ✓ Covered |
| CHART-08 | Logical range (not time range) with re-entrancy guard for gaps | 06-02 | T1 (pure `chart-sync.js` — only `subscribeVisibleLogicalRangeChange`/`setVisibleLogicalRange`, shared `syncing` flag, `isUsableRange` rejection, vitest gap test) + T2 (guard wired; logical-range-only greps) | ✓ Covered |

**Zero-coverage check**: all five requirement IDs from the ROADMAP Phase 6 line appear in a plan with concrete tasks. No uncovered requirement.

## 2. Success Criteria Traceability

| Success criterion | Delivering task(s) | How it becomes TRUE |
|---|---|---|
| SC1 — BTCUSDT 1h top pane + ETHUSDT 1h bottom pane, stacked single-page | 06-01 T1 (panes + `.chart-pane` explicit-height CSS + reachability link) and 06-01 T2 (`loadWindow` + `renderChart` for both symbols) | Deployed curl markers (`#btc-chart` byte-offset before `#eth-chart`, pinned CDN tag, `href="/charts.html"`, `.chart-pane` CSS) + browser checkpoint showing both titled panes render real candles |
| SC2 — Scroll/zoom either chart applies same range to the other automatically | 06-02 T2 (initial alignment `btcScale → ethScale`, then `sync.link(btcScale, ethScale)` + `sync.link(ethScale, btcScale)`) | Deployed markers (`createRangeSync`, `getVisibleLogicalRange`, `sync.link`) + browser checkpoint pan/zoom both directions in lockstep |
| SC3 — Rapid pan/zoom no desync/double-fire/crash; guard holds incl. gaps | 06-02 T1 (shared `syncing` guard + `isUsableRange` rejection; vitest: forwarding, re-entrancy loop, rapid-fire, symmetric, null/NaN, gap, unsubscribe) and 06-02 T2 (guard wired into real charts; rapid-pan + 2021-boundary scrub + gap pan checkpoints) | Automated: vitest proves loop/double-fire/crash-free behavior against a synchronous-notify-back `FakeTimeScale`. Manual: browser checkpoints |
| SC4 — LWC v5 standalone from CDN, no build step | 06-01 T1 (pinned `https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js`) and 06-01 T2 (v5-only `addSeries(CandlestickSeries)` API) | Deployed grep for the pinned tag; must-never-appear greps for v4 `addCandlestickSeries` and `@latest`; no npm package/bundler anywhere in the plan |

**Zero-coverage check**: every one of the 4 success criteria has at least one named task. No orphan criterion.

## 3. Dimension Results

| Dimension | Result | Notes |
|---|---|---|
| 1. Requirement coverage | PASS | All 5 requirement IDs mapped to concrete tasks (§1). |
| 2. Task completeness | PASS | Every task names concrete files, a specific action (with inline code to author), a verify step (deployed curl greps / vitest / browser checkpoint), and a `<done>` acceptance statement. |
| 3. Dependency correctness | PASS | 06-01 T1 → 06-01 T2 → 06-02 T1 → 06-02 T2; waves 1→2. 06-01 depends on 05-02 (exists and committed; touches `public/index.html` + `public/js/*` — ordering rationale holds, no file conflicts). 06-02 correctly assumes 06-01 T2's chart/time-scale instances exist. Acyclic. |
| 4. Key links / wiring | PASS | `charts.js` → `/api/klines` via `api()`; `charts.html` → pinned CDN global; `charts.js` → `chart-sync.js` (`createRangeSync`); `#chart-error` wired to the `init()` catch. Every artifact delivers a success criterion, not created in isolation. |
| 5. Scope sanity | PASS | 2 tasks per plan (4 total across the phase), within the 2–3 target. |
| 6. Success-criteria traceability | PASS | See §2 — all 4 SCs delivered by named tasks. |
| 7. Locked-decision compliance | PASS | No CONTEXT.md / D-XX decisions for this phase. PROJECT.md constraints honored: pure static HTML/CSS/JS with no build step; Lightweight Charts; stacked-not-overlay; BTCUSDT/ETHUSDT only; chart→calculator interaction kept out (PROJECT.md Out of Scope + PITFALLS.md:248 #1608). |
| 8. Scope reduction | PASS | No hedging ("v1"/"placeholder"/"stub"/"not wired yet") on any in-scope item. Explicit non-goals are all Phase 7/9/out-of-scope items (CHART-04/05/06, INFRA-06, crosshair). The load-once window and "sync not wired in 06-01" are deliberate plan boundaries, not reductions. |
| 9. Verification plan quality | PASS (with caveats) | Automated where possible: targeted vitest + full suite, `npm run typecheck`, deployed curl markers, must-never-appear greps (CHART-08 logical-range-only, v4 API, `innerHTML`, direct `fetch()`). SC2/SC3 real-browser proof rests on human checkpoints plus an optional Playwright spec — see W-2 for a correctness bug in that optional spec. |
| 10. Fact-check load-bearing claims | PASS (with warnings) | Verified against source: `/api/klines` accepts ms `start`/`end`, converts to seconds (`src/routes/klines.ts:15-24`); `queryKlines` returns `open_time, open, high, low, close, volume` ordered (`src/lib/db.ts:32-45`); `open_time` stored as unix seconds (`src/lib/binance.ts:17`), matching LWC v5 `UTCTimestamp`; `api()` chokepoint returns `body.data` (`public/js/api.js:11`); `records.js` uses `textContent` only, no `innerHTML`; pinned CDN URL returns HTTP 200 and matches STACK.md:47/100 exactly; v5 API surface confirmed (STACK.md:56/64/85); tsconfig `include: ["src"]` → public/js not tsc-checked (consistent with claim); vitest `.js`-import precedent exists (`datetime.test.ts`); PITFALLS.md:184 performance trap cited correctly; PITFALLS.md:248 #1608 crosshair citation accurate; STACK.md:287 contains the "avoid silent breaking changes" pinning rationale cited by 06-01. See W-1 / W-2 / I-1..I-6. |

## 4. Issues

### Blockers
None.

### Warnings
- **W-1 — The exception-safety test (06-02 T1, case 8) is wired backwards and would fail as specified.** The plan's prose says "a ThrowingTimeScale ... wire two-way links" but the code shows `sync.link(a, b)` with `a = new ThrowingTimeScale()` as the *source* and `b = new FakeTimeScale()` as the *target*. `a.fire(...)` only invokes `a`'s handlers, which call `b.setVisibleLogicalRange(...)` — `b` is a non-throwing Fake, so nothing throws and `expect(() => a.fire(...)).toThrow()` fails. The guard's `try/finally` in the module itself is correct; only the test spec is wrong. If the executor authors it literally, `npx vitest run public/js/chart-sync.test.ts` goes red — which the plan's own verify step requires to be green.
  - *fix_hint*: make the throwing scale the **target** of a link, e.g. `sync.link(b, a)` where `a = new ThrowingTimeScale()`, then `expect(() => b.fire({ from: 1, to: 2 })).toThrow(); expect(sync.isSyncing()).toBe(false)` — the throw happens inside `to.setVisibleLogicalRange` and the `finally` resets the guard.

- **W-2 — The optional Playwright spec (06-02 Verification Track) asserts globals charts.js never sets.** It says to "assert `window.btcChart` and `window.ethChart` exist," but the plan's own `init()` keeps chart references in local `const` variables and never assigns them to `window`. A spec written as described would fail against the real page.
  - *fix_hint*: either expose the refs in `init()` (e.g. `window.btcChart = btcChart; window.ethChart = ethChart;` — harmless, aids debugging), or change the assertion to target a DOM signal (e.g. canvas elements inside `#btc-chart`/`#eth-chart`), or drop the spec and keep the manual checkpoint as the SC2/SC3 proof.

### Info
- **I-1 — Test-count mismatch.** 06-02 T1 `<done>` and the Verification Track both say the suite is "7/7," but 8 test cases are enumerated (forwarding, re-entrancy, rapid-fire, symmetric, null/NaN, gap, unsubscribe, exception-safety) and the Verification Track's inline list omits "exception-safety." The count was not bumped when the W-1 `try/finally` fix added case 8.
  - *fix_hint*: update both mentions to "8/8" and add "exception-safety" to the enumerated list.

- **I-2 — Exception test prose/code drift.** Case 8's prose says "wire two-way links," the code shows only `sync.link(a, b)`, and the preliminary `b.fire({ from: 1, to: 2 })` is a no-op (nothing subscribes to `b`). Harmless to execution but confusing.
  - *fix_hint*: fold into W-1's fix (use `sync.link(b, a)`, drop the stray `b.fire(...)`).

- **I-3 — Filename divergence from research.** ARCHITECTURE.md names the page `chart.html`; the plans consistently use `charts.html`. ROADMAP/PROJECT.md don't lock the filename, so no conflict — research doc is stale on naming.
  - *fix_hint*: optionally update ARCHITECTURE.md after the phase, or accept the divergence.

- **I-4 — Logical-range alignment across unequal datasets.** When one symbol has gaps, BTC's auto-fit logical range applied verbatim to ETH maps bar indices, so the two charts can show marginally different wall-clock spans. This is the CHART-08-mandated logical-range semantic, explicitly acknowledged in the plan.
  - *fix_hint*: none; document as an accepted consequence if the owner queries it.

- **I-5 — `public/js/*.test.ts` are not type-checked.** tsconfig `include: ["src"]`, so `chart-sync.test.ts` (and the existing `datetime.test.ts`/`api.test.ts`) never pass through `tsc`; vitest transpiles without type-checking. `npm run typecheck` will not catch type errors in the new test file. Consistent with precedent, but the exception-safety test's wiring bug (W-1) is exactly the kind of error typechecking would not catch.
  - *fix_hint*: none required; optionally widen tsconfig to `["src", "public/js/*.test.ts"]` with DOM lib, or accept the standing gap.

- **I-6 — `ThrowingTimeScale` is undefined in the code sample.** Case 8 references it only in prose; the executor must construct a throwing subclass from `FakeTimeScale`. Implementable, but under-specified.
  - *fix_hint*: add the one-line subclass to the test sample (`class ThrowingTimeScale extends FakeTimeScale { setVisibleLogicalRange() { throw new Error('boom'); } }`).

## 5. Recommendation

**VERIFICATION PASSED — proceed to execution.** Both plans are goal-backward complete: all five requirements (CHART-01/02/03/07/08) and all four success criteria are delivered by named tasks with concrete files, wired end-to-end, and fact-checked against the real source (`/api/klines` ms→s contract, seconds-based `open_time`, `api()` chokepoint, `textContent`-only DOM discipline, tsconfig scope, STACK.md's pinned v5.2.1 URL, vitest `.js`-import precedent, PITFALLS.md:184/:248 citations). Dependencies are acyclic and correctly ordered (06-01 → 06-02, resting on committed 05-02); scope is 2 tasks per plan with no in-scope hedging; PROJECT.md locked decisions are respected and no CONTEXT.md/D-XX constraints exist.

The two warnings are correctness bugs in the plan's own test/verification *specifications*, not in the shipped feature logic, and neither threatens the goal: W-1 (exception-safety test wired source→target backwards — the guard's `try/finally` itself is right) will surface immediately as a red vitest run during 06-02 T1 execution and is a one-line fix; W-2 (optional Playwright spec asserting non-existent `window.btcChart`/`window.ethChart`) only matters if the executor opts into that optional automation. Fold both fixes into execution; no re-planning required.