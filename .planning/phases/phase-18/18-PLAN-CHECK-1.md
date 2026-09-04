---
status: issues_found
blockers: 4
warnings: 6
info: 4
iteration: 1
max_iterations: 3
---

# Phase 18 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker (goal-backward, adversarial)  
**Date**: 2026-09-03  
**Phase**: 18 (充分準備 / Full Preparation)  
**Plan(s) verified**: `.planning/phases/phase-18/18-PLAN.md` (Tasks 1.1, 1.2, 2.1, 2.2, 2.3, 3.1)  
**Status**: **ISSUES FOUND — 4 blocker(s), 6 warning(s), 4 info**

---

## 1. Coverage Summary

| Deliverable (ROADMAP) | Plan task(s) | Coverage |
|---|---|---|
| Dev env validation (klinecharts@10.0.3 + extension CDN) | Task 1.1 | ⚠️ BROKEN (wrong UMD global, invalid options, extension has no UMD) |
| Three-repo compatibility assessment doc | Task 2.1 | ⚠️ Present, but built on v9-era API mappings |
| Migration checklist line-by-line verification | Task 2.3 | ✅ Present (verify command mismatch) |
| First KLineChart standalone demo (real Binance data) | Tasks 1.1, 1.2 | ❌ BLOCKED (API + timestamp premise wrong) |
| Performance baseline (lightweight-charts) | Task 2.2 | ⚠️ Present (wrong page: index.html vs charts.html) |
| Finalized 5-phase detailed plan | Task 3.1 | ✅ Present |
| R18-01..R18-10 requirement coverage | see §2 | ❌ R18-08 zero coverage; R18-10 no explicit; R18-01/05 partial |

## 2. Success Criteria Traceability

| ROADMAP Success Criterion | Covering task(s) | Verdict |
|---|---|---|
| klinecharts 可正確 import 和渲染 | Task 1.1 | ❌ Task exists but encodes non-existent API (`KLineChart.init`, `applyNew()`, `kline:{}`) → demo cannot render |
| @klinecharts/extension CDN 連線測試通過 | Task 1.1 step 2 | ❌ extension@0.1.0 is ESM-only, no UMD build; plain `<script>` import impossible |
| Migration checklist 所有項目理解並標記 | Task 2.3 | ✅ covered (verify grep mismatch, see W4) |
| Demo HTML 使用假資料正確顯示 K 線 | Task 1.2 (partial) | ⚠️ Plan renders real data only; fake-data inline test logs to console, never rendered; conflicts with CONTEXT locked "real data" decision |
| 性能基準數字已記錄到文件 | Task 2.2 | ⚠️ covered, but measures `index.html` (no charts) instead of `charts.html` |
| 5-phase 計劃確認（此 ROADMAP） | Task 3.1 | ✅ covered |
| 所有高風險 API 差異已識別 | Tasks 1.2, 2.1, 2.3 | ❌ Identifies a FALSE risk (ms→s) and misses the real v10 API surface (setDataLoader, ms timestamps, ESM-only extension) |
| *(CONTEXT)* 開發分支 `feature/klinechart-migration` 已推送 | none | ❌ NO task; branch exists locally, not pushed (R18-08, HIGH) |
| *(CONTEXT)* data-aggregator 延後至 v3.1 已確認 | none (implicit) | ⚠️ no explicit covering task/line (R18-10, LOW) |

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|---|---|---|
| 1 | Requirement Coverage | ❌ FAIL | R18-08 zero coverage (BLOCKER); R18-10 no explicit line; R18-01 (npm `import` verification) only partially covered via CDN; R18-05 fake-data variant not rendered |
| 2 | Task Completeness | ⚠️ PARTIAL | Tasks have file/action/verify/acceptance, but Task 1.1 steps 4-5 specify wrong/vague API calls |
| 3 | Dependency Correctness | ✅ PASS | Acyclic; T1.1→T1.2 ordered; all read_first deps exist on disk |
| 4 | Key Links / Wiring | ⚠️ PARTIAL | Artifacts wired to criteria, but demo + risk-checklist content is wrong |
| 5 | Scope Sanity | ⚠️ WARN | 6 tasks > 2-3 target; each task cohesive and wave-structured, but exceeds guideline |
| 6 | Success-Criteria Traceability | ❌ FAIL | 2 criteria blocked (import/render, risk identification), 1 partial (fake data) |
| 7 | Locked Decision Compliance | ⚠️ PARTIAL | Real-data, no-build, Chrome+iOS decisions followed; "timestamp-first" decision implemented on a wrong premise |
| 8 | Scope Reduction Detection | ⚠️ PARTIAL | Task 1.1 "applyNew() **or** setData() equivalent" hedged/vague on the load-bearing render call |
| 9 | Verification Plan Quality | ⚠️ PARTIAL | Task 1.1 verify uses broken jq; Task 1.2 verifies arithmetic only, on a wrong premise; Task 2.3 grep count mismatch; no TS changed so typecheck N/A |
| 10 | Fact-check load-bearing claims | ❌ FAIL | Multiple wrong API claims verified against installed klinecharts@10.0.3 (see Blockers) |

## 4. Issues

### Blockers

**B1. Wave-1 tracer (Tasks 1.1/1.2) uses non-existent klinecharts v10.0.3 API — demo cannot render**
- `KLineChart.init('chart', { kline: {} })`: the UMD global exported by `node_modules/klinecharts/dist/umd/klinecharts.js` is `global.klinecharts = {}` (lowercase); `KLineChart` is undefined. The `Options` interface (dist/index.d.ts:934) has **no `kline` key** (valid keys: locale, timezone, styles, formatter, layout, …).
- `chart.applyNew({ candles })` / `setData()`: **neither exists** in v10.0.3 (grep of dist UMD+ESM finds no `applyNew`/`updateData`/`applyMoreData`). v10 loads data via `setDataLoader({ getBars, subscribeBar?, unsubscribeBar? })` in order `init → setSymbol → setPeriod → setDataLoader`.
- KLineData field is **`timestamp`**, not `time` (dist/index.d.ts:97). Passing `time:` keys yields an empty chart.
- RESEARCH.md §3 example (`chart.applyNew({ candles: data })`), §2.1 (`KLineChart: seconds`), and technical-assessment.md (`createShape`, `updateData`, `setVisibleRange`, `registerHandler`, `setPriceScale`) all encode the v9 API. Task 2.1 would therefore produce a compatibility document full of fictional mappings.
- **fix_hint**: Rewrite Task 1.1 steps 4-5 to: `<script src="https://unpkg.com/klinecharts@10.0.3/dist/umd/klinecharts.min.js">` → `const chart = klinecharts.init('chart')` → `chart.setSymbol({ ticker:'BTCUSDT', pricePrecision:2, volumePrecision:5 })` → `chart.setPeriod({ span:1, type:'hour' })` → `chart.setDataLoader({ getBars: ({callback}) => callback(bars) })` mapping each Binance row to `{ timestamp, open, high, low, close, volume }`. Correct Task 2.1 API mapping (lightweight-charts `setData` → v10 `setDataLoader`/`getBars`). Treat technical-assessment.md / migration-checklist.md as untrusted and re-verify during Task 2.1/2.3.

**B2. Timestamp risk is inverted for v10 — Task 1.2 would certify a bug as "VERIFIED SAFE"**
- Official KLineChart v10 docs and the v9→v10 migration table state: `timestamp` must be in **milliseconds**; `applyNewData`/`updateData` are removed. Binance `open_time` is already ms, so `Math.floor(open_time / 1000)` **breaks** rendering (bars collapse to 1970s).
- Task 1.2's premise ("prove Math.floor(ms/1000) is correct", acceptance "10-digit seconds", verify asserting `1693526400000/1000 === 1693526400`) validates the wrong transform; Task 2.1's risk checklist and Task 2.3's "Critical Data Transform VERIFIED" would record a false-safe verdict that Phase 19 then builds on. R18-09 ("all high-risk API differences identified") is therefore **not met** — the plan identifies a non-existent risk and misses the real ones (loader API, ms timestamps, ESM-only extension).
- **fix_hint**: Replace the conversion with a **pass-through** (Binance ms → v10 ms). Redefine the phase's critical verification as: confirm KLineChart renders with ms timestamps unchanged, and confirm `timestamp` (not `time`) key. Update RESEARCH.md §2.1, Task 2.1 §5 risk checklist, and Task 2.3 "Critical Data Transform" accordingly.

**B3. R18-08 (HIGH) has zero task coverage — branch not pushed**
- `git branch -vv` shows `feature/klinechart-migration` is local-only (no `origin/feature/klinechart-migration` upstream; remote tracks only `origin/main`). R18-08 requires the branch to be "已建立並推送". No task in the plan creates or pushes it.
- **fix_hint**: Add a Wave-3 task (or Task 3.1 step) that runs `git push -u origin feature/klinechart-migration` and verifies `git ls-remote origin feature/klinechart-migration` returns the commit.

**B4. @klinecharts/extension@0.1.0 is ESM-only — "Import extension CDN" via plain `<script>` cannot work**
- Verified `@klinecharts/extension@0.1.0` (npm) ships only ESM (`dist/*.js`/`*.cjs`, `"type":"module"`); **no UMD/IIFE build**, so `unpkg.com/@klinecharts/extension@0.1.0/dist/index.js` cannot be loaded with `<script src=...>`. R18-02 ("extension CDN 連線測試通過") as written is not executable, and the demo's "zero console errors" acceptance criterion is unachievable with a script-tag import. RESEARCH.md §5 also lists the "extension CDN URL" checklist without ever providing a URL.
- **fix_hint**: In Task 1.1 use `<script type="module">` + `import * as klineChartsExtension from 'https://unpkg.com/@klinecharts/extension@0.1.0/dist/index.js'` (or jsdelivr ESM), or restrict R18-02 to a curl HEAD/200 connectivity check against the ESM file URL and defer functional integration to Phase 20. Record the resolved URL in the demo doc (Task 1.1 step 3) and in RESEARCH.md §5.

### Warnings

**W1. Task 2.2 measures the wrong page** — Action step 1 says "Open `public/index.html` (with current lightweight-charts)" but `index.html` is the records page with **no charts**; the charts live in `public/charts.html` (`#btc-chart`, `#eth-chart`, lightweight-charts@5.2.1 at line 8). Measurements taken on index.html would find nothing to measure.
- **fix_hint**: Point Task 2.2 (and its read_first) at `public/charts.html`; note that charts load async after `/api/klines` fetch, so measure after both series render.

**W2. Task 1.1 automated verify command is wrong for the Binance response shape** — `jq '.[] | .time'` on `/api/v3/klines` (array-of-arrays like `[openTime, open, high, ...]`) yields `null` per element, not a timestamp; and `fails_when` ("value < 1000000000000") would flag any valid 13-digit ms openTime as invalid.
- **fix_hint**: Use `jq -r '.[0][0]'` (first candle openTime, ms) and assert it is a 13-digit number, or assert response length ≥ 1000 via `jq 'length'`.

**W3. "Demo HTML 使用假資料" success criterion conflicts with the locked CONTEXT decision (real data) and is not delivered either way** — CONTEXT.md decision = 完整真實數據 (1000+); ROADMAP/R18-05 = fake data. The plan renders real data only; Task 1.2's fake-data snippet is console-only (`console.log`/`console.assert`), never fed to the chart.
- **fix_hint**: Resolve the conflict explicitly (e.g., demo renders seeded fake data first, then swaps to real Binance data via a toggle), so both the success criterion and the CONTEXT decision are verifiably demonstrated; note the resolution in the demo doc.

**W4. Task 2.3 automated verify mismatches its own template** — Verify requires ≥3 lines containing "VERIFIED" (`grep -c "VERIFIED"`), but the plan's checklist template contains only one ("**Critical Data Transform** ✓ VERIFIED"). The step would either fail or be gamed by padding.
- **fix_hint**: Align the verify with the actual template (e.g., grep per-section marker lines, or `grep -c "VERIFIED\|Understand"`), or restructure the checklist to mark every item "VERIFIED"/"Understand" as claimed.

**W5. R18-10 (data-aggregator deferral confirmation) has no explicit covering task** — No task states "data-aggregator deferred to v3.1 confirmed"; it is only implicit in referenced CONTEXT.md/ROADMAP.
- **fix_hint**: Add one bullet to Task 2.1's Known Limitations / assessment doc ("@klinecharts/data-aggregator — deferred to v3.1, not in scope") and reference it in acceptance criteria.

**W6. Scope sanity: 6 tasks exceed the 2-3 task/plan target** — Tasks are individually cohesive and wave-structured (tracer 1.1-1.2, expansion 2.1-2.3, roadmap 3.1), so this is borderline, but the count violates the guideline.
- **fix_hint**: Either consolidate (e.g., merge Task 2.2 into Task 2.1 as a single "assessment + baseline" task) or formally split the plan into two plan units.

### Info

**I1.** The klinecharts UMD CDN URL in Task 1.1 (`https://unpkg.com/klinecharts@10.0.3/dist/umd/klinecharts.min.js`) is valid — the file exists at `node_modules/klinecharts/dist/umd/klinecharts.min.js`.

**I2.** `subscribeAction('onVisibleRangeChange')` (Task 2.1 §2 / RESEARCH §2.2) is a **correct** v10 mapping — `ActionType` in dist/index.d.ts includes `"onVisibleRangeChange"`.

**I3.** R18-01's install portion is already satisfied — `package.json` lists `klinecharts: ^10.0.3`, installed as 10.0.3. Only the "`import` 可用" verification is missing as an explicit step (covered indirectly via CDN in Task 1.1).

**I4.** Task 1.1 acceptance criterion "y-axis 3000-4000" uses a stale BTC price band; real current data will render far above it — adjust the criterion to "y-axis shows the fetched price range".

## 5. Recommendation

**Plan needs revision before execution.** The blocker class is systematic: the research base (RESEARCH.md §2-§3, technical-assessment.md, migration-checklist.md) and the plan were authored against the **klinecharts v9 API**, while the installed, locked dependency is **v10.0.3** (confirmed against `node_modules/klinecharts/dist/index.d.ts`, dist UMD/ESM, official v10 docs, and the v9→v10 migration table). The phase's entire purpose is de-risking, so shipping these wrong premises into the tracer demo, the risk checklist, and the "VERIFIED" verdicts would hard-code a false-safe conclusion that Phases 19-22 inherit.

The revision must: (1) rebuild Tasks 1.1/1.2 on the real v10 surface (`klinecharts.init` → `setSymbol` → `setPeriod` → `setDataLoader`, `timestamp` in ms, pass-through conversion); (2) correct the risk matrix (ms→s is not a v10 risk; the real risks are the loader API, ms timestamps, ESM-only extension); (3) add explicit coverage for R18-08 (branch push) and R18-10 (deferral confirmation); (4) fix the fake-vs-real data conflict (W3); (5) fix Task 2.2's target page (charts.html) and the broken jq/grep verify commands. Existing good parts to preserve: CDN choice (no-build constraint), Chrome + Safari iOS measurement env, real-data decision, and the correct `subscribeAction('onVisibleRangeChange')` mapping.

## Issues
- dimension: fact-check load-bearing claims
  severity: BLOCKER
  finding: Tasks 1.1/1.2 use non-existent v10.0.3 API: `KLineChart.init('chart',{kline:{}})` (UMD global is `klinecharts`, Options has no `kline`), `applyNew()`/`setData()` (v10 uses `setDataLoader({getBars})`), KLineData field is `timestamp` not `time`. Demo cannot render.
  affected_field: 18-PLAN.md Task 1.1 step 4-5, Task 1.2; 18-RESEARCH.md §2.1/§3; technical-assessment.md
  suggested_fix: Rebuild demo on `klinecharts.init` → `setSymbol` → `setPeriod` → `setDataLoader` with `{timestamp,open,high,low,close,volume}` mapping; correct API-mapping docs; treat research base as untrusted.
- dimension: fact-check load-bearing claims
  severity: BLOCKER
  finding: Timestamp risk inverted for v10: v10 requires MILLISECONDS; Binance open_time is already ms. Task 1.2 would certify `Math.floor(open_time/1000)` as VERIFIED SAFE, and R18-09's "high-risk API differences" would miss the real v10 surface (loader API, ms timestamps, ESM-only extension).
  affected_field: 18-PLAN.md Task 1.2, Task 2.1 §5, Task 2.3 "Critical Data Transform"; 18-RESEARCH.md §2.1
  suggested_fix: Use pass-through ms timestamps; re-define the phase's critical verification around v10's actual data contract; rewrite the risk checklist.
- dimension: requirement coverage
  severity: BLOCKER
  finding: R18-08 (HIGH) has zero task coverage; branch `feature/klinechart-migration` exists locally but is NOT pushed (no origin upstream).
  affected_field: 18-PLAN.md (no task); R18-08
  suggested_fix: Add a task/step that `git push -u origin feature/klinechart-migration` and verifies via `git ls-remote`.
- dimension: fact-check load-bearing claims
  severity: BLOCKER
  finding: @klinecharts/extension@0.1.0 is ESM-only (no UMD build); Task 1.1 "Import extension CDN" via plain `<script>` cannot work; R18-02 not executable as written; RESEARCH.md provides no extension CDN URL.
  affected_field: 18-PLAN.md Task 1.1 step 2; R18-02; 18-RESEARCH.md §5
  suggested_fix: Use `<script type="module">` import of the ESM dist URL, or restrict R18-02 to a curl connectivity check; record resolved URL.
- dimension: task completeness
  severity: WARNING
  finding: Task 2.2 measures `public/index.html` (records page, no charts); charts are in `charts.html`.
  affected_field: 18-PLAN.md Task 2.2 action step 1
  suggested_fix: Measure on `public/charts.html`; account for async /api/klines load.
- dimension: verification plan quality
  severity: WARNING
  finding: Task 1.1 automated verify uses `jq '.[] | .time'` on Binance array-of-arrays (yields null) and a fails_when threshold that flags valid ms timestamps as invalid.
  affected_field: 18-PLAN.md Task 1.1 <verify>
  suggested_fix: Use `jq -r '.[0][0]'` and assert 13-digit ms, or assert `jq 'length' >= 1000`.
- dimension: success-criteria traceability
  severity: WARNING
  finding: "Demo HTML 使用假資料正確顯示 K 線" (R18-05) conflicts with CONTEXT locked decision (real data) and is not delivered — Task 1.2 fake data is console-only, never rendered.
  affected_field: 18-PLAN.md Task 1.2; R18-05; 18-CONTEXT.md Decisions
  suggested_fix: Resolve conflict explicitly (seed fake data then swap to real data) and demonstrate both.
- dimension: verification plan quality
  severity: WARNING
  finding: Task 2.3 verify greps ≥3 "VERIFIED" lines but its template contains only one; step fails or is gamed.
  affected_field: 18-PLAN.md Task 2.3 <verify>
  suggested_fix: Align grep pattern with the per-section markers in the checklist template.
- dimension: requirement coverage
  severity: WARNING
  finding: R18-10 (data-aggregator deferral confirmation, LOW) has no explicit covering task/line.
  affected_field: 18-PLAN.md Task 2.1
  suggested_fix: Add an explicit "deferred to v3.1" bullet to the assessment doc + acceptance criteria.
- dimension: scope sanity
  severity: WARNING
  finding: 6 tasks exceed the 2-3 task/plan target (tasks are cohesive and wave-structured, hence not blocker).
  affected_field: 18-PLAN.md task list
  suggested_fix: Consolidate (e.g., merge Task 2.2 into Task 2.1) or split into two plan units.
- dimension: scope reduction detection
  severity: INFO
  finding: Task 1.1 hedges the render call as "applyNew() or setData() equivalent" and Task 1.1 acceptance uses stale "y-axis 3000-4000".
  affected_field: 18-PLAN.md Task 1.1 steps 4-5, acceptance criteria
  suggested_fix: Specify the single v10 call (setDataLoader/getBars); replace price band with "matches fetched data range".
- dimension: fact-check load-bearing claims
  severity: INFO
  finding: klinecharts UMD CDN URL is valid; `subscribeAction('onVisibleRangeChange')` mapping is correct for v10; `klinecharts@^10.0.3` already installed.
  affected_field: 18-PLAN.md Task 1.1, Task 2.1; package.json
  suggested_fix: None — confirm these in the revised plan.