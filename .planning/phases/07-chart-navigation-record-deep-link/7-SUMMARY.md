# Phase 7 Summary — Chart Navigation & Record Deep Link

**Phase**: 7 — Chart Navigation & Record Deep Link
**Requirements**: CHART-04 (log-scale toggle), CHART-05 (custom date range), CHART-06 (record → chart deep link)
**Date**: 2026-08-31
**Status**: ✅ COMPLETE — all three success criteria verified end-to-end
**Commit range**: `44fc1bf..HEAD` (8 commits, see below)

---

## What Was Built

| File | Purpose |
|------|---------|
| `public/js/chart-range.js` | Pure, DOM-free module: `PADDING_SECONDS`/`DEFAULT_WINDOW_SECONDS` constants, `recordToRange(record)` (±24h padding → ms), `parseRangeParams(search)` (deep-link param parsing/validation → `{startMs,endMs}` or `null`), `nowRange()` (default 30-day window). Single source of the range math for both charts.js and records.js. |
| `public/js/chart-range.test.ts` | Vitest suite (10 cases): padding math, param parsing/validation, default window, and the record→URL→parse round-trip contract (automated SC3 proof). |
| `public/charts.html` | Charts controls bar: `#log-scale` single checkbox, UTC-labeled 開始時間/結束時間 (UTC) dropdown pickers (`data-picker="start"|"end"`), `#load-range` 載入範圍 button, `#range-summary` live window readout. LWC v5.2.1 CDN kept pinned (SRI hash corrected). |
| `public/css/style.css` | `.chart-controls` bar, `.time-picker` select spacing, `.range-summary` styles. |
| `public/js/charts.js` | `loadRange(startMs,endMs)` reusable load path (unsubscribe sync → `setData` both series → re-align BTC→ETH → re-subscribe), `setLogScale(enabled)` applying `PriceScaleMode.Logarithmic/Normal` to **both** charts, param-driven `init()` (`parseRangeParams(window.location.search) ?? nowRange()`), UTC picker helpers, plus year/month→`rebuildDays` listeners. |
| `public/js/records.js` | `查看K線` (`view-chart`) button per row (before 編輯/刪除); delegated handler builds `?start/end` from `recordToRange(record)` and `window.location.assign('/charts.html?start=…&end=…')`. |

## Success Criteria — Verified

| SC | Evidence |
|----|----------|
| **SC1** log scale toggles both charts at once | Playwright: checking `#log-scale` sets both price scales to `Logarithmic` (mode 1); unchecking → `Normal` (0). Pan while log-ON keeps both charts in lockstep. |
| **SC2** custom range loads on both charts | Playwright: 2023-01-01→2023-02-01 loads 745 hourly candles/symbol, both charts start/end exactly at the picked window, synced, summary reflects it. PLAN-CHECK W1 added: **full-history 2021-01→present loads 49,613 candles/symbol on both charts with no error and sync intact** — the plan's "~48K candles renders fine" claim is now proven. |
| **SC3** record → chart deep link, ±24h padding | Playwright (live record id 8, 2024-01-15T12:00→2024-01-16T04:00Z): clicking 查看K線 navigates to `?start=1705233600000&end=1705464000000`; both charts load data starting exactly 24h before and ending exactly 24h after; summary/pickers reflect the padded window; sync holds after pan. Round-trip unit test proves record→URL→parse. |

## Tasks Completed vs. Blocked

- **07-01 Task 1** (chart-range.js + vitest) — ✅ committed `8ffd290`; 10/10 cases, full suite green.
- **07-01 Task 2** (controls bar HTML + CSS) — ✅ committed `9c3af69`; all deployed markers present.
- **07-01 Task 3** (charts.js `loadRange`/`setLogScale`/param-init) — ✅ committed (charts.js + `a232259`/`15a8610` SRI fixes + `a780614` `window.__charts` hook + `7d56e3b` rebuildDays listeners); all 24 browser checks passed (no-params, SC2, W1 full-history, SC1, sync-under-log, validation, no console errors).
- **07-02 Task 1** (records.js 查看K線 button + navigation) — ✅ committed `88854ad` + `3de2974`; all deployed markers present.
- **07-02 Task 2** (E2E verification battery) — ✅ all 20/20 deep-link browser checks passed (row button order, padded-window load on both charts, summary/picker reflection, sync after pan, no-params + malformed-params fallbacks, edge-of-history no-crash), vitest green, typecheck exit 0.
- **Blocked on human**: **none.** All browser checkpoints were executed as automated Playwright proofs. Optional: eyeball the deployed page to confirm visual rendering (log spacing, candle colors) — not a gate.

## [CONFLICT] / [PLAN-GATE] Decisions

None. No plan-gate markers were present and no code-vs-plan conflicts arose.

## Deviations from Plan

1. **Concurrent executor (double-dispatch)** — a second phase-7 executor (dispatch `7-20260831-080246-14225`, still marked `in_progress`) was committing the same work mid-session: it committed `7d56e3b` (charts.js rebuildDays listeners) and `88854ad` (records.js deep-link button). Its `88854ad` **omitted the `recordToRange` import** — the deployed records.js would have thrown `ReferenceError` on click. This session added the missing import (`3de2974`). Final state converges on the correct code; no conflict remains. Note: both agents' commits are in the range below.
2. **`/charts.html` serves via a 307 redirect to `/charts`** (query string preserved). The plan's deployed-marker curls target `/charts.html`, which with plain `curl -sf` (no `-L`) returns an empty body → the grep fails. Content is verified against `/charts` (and `-L` on `/charts.html`). This is an environment serving detail, not a code defect; deep-link navigation through the redirect works (proven in checkpoint B).
3. **PLAN-CHECK W1 applied** — full-history range added to the SC2 browser proof (49,613 candles/symbol render, synced, no error). No server-side cap added (project anti-pattern list notwithstanding), because the proof confirms the plan's claim at the true scale.
4. **PLAN-CHECK W2 confirmed** — `parseRangeParams` carries the explicit `params.get() === null` guard; the plan's stale prose describing `Number(null) === 0` behavior was **not** "simplified" into the code.
5. **Test-count prose** — plan Verification Track says "9/9"; the written suite has 10 cases (full suite 86). Cosmetic; the code/tests are the ground truth.
6. **PLAN-CHECK I3 (rapid `載入範圍` click race)** — left as planned (optional fix, single-owner use). Noted for a later phase.

## Security / Code-Quality Fixes

- **`[fix] missing import`** (`3de2974`): records.js referenced `recordToRange` without importing it — a runtime ReferenceError on every 查看K線 click. Fixed.
- **`[fix] SRI hash`** (`a232259`, `15a8610`): charts.html's pinned LWC v5.2.1 CDN `integrity` hash was invalid — the browser blocked the script so no chart ever rendered since Phase 6's code-review commit. Verified digest restored. This is the phase's most important correctness fix (nothing rendered without it).
- **`[fix] stale day options`** (`7d56e3b`): charts pickers didn't rebuild day options on year/month change — silent timestamp rollover. Matches records.js behavior.
- Must-never-appear greps all clean (innerHTML, fetch in charts.js/records.js, addCandlestickSeries, lightweight-charts@latest, v4 logical-range APIs, DOM refs in chart-range.js).

## Commit Range (`44fc1bf..HEAD`)

```
8ffd290 feat(phase-7): pure chart-range module — ±24h record padding, deep-link param parsing, default window + vitest suite
9c3af69 feat(phase-7): charts controls bar — log-scale checkbox, UTC start/end pickers, load-range button, range summary
a232259 fix(phase-7): correct SRI integrity hash on pinned LWC v5.2.1 CDN script — invalid hash blocked the script so charts never rendered
15a8610 fix(phase-7): correct SRI hash typo — extra char in integrity digest; LWC CDN script now loads
a780614 feat(phase-7): expose chart series on window.__charts test hook alongside chart instances
7d56e3b fix(phase-7): wire year/month change to rebuildDays in charts pickers — stale day options caused silent timestamp rollover
88854ad feat(phase-7): record → chart deep link — 查看K線 button navigates to /charts.html?start/end via recordToRange ±24h
3de2974 fix(phase-7): add missing recordToRange import to records.js — 查看K線 deep link referenced it without importing
```

## End-to-End Verification Commands

```bash
# 1. Unit + integration suite (86 tests incl. chart-range 10 cases & round-trip SC3 contract)
npx vitest run

# 2. Typecheck (src/ only by config)
npm run typecheck

# 3. Deployed markers (URL may 307 /charts.html → /charts; use -L)
B="https://btcethdivergence.gn01968711.workers.dev"
curl -sfL "$B/charts.html" | grep -q 'id="log-scale"'      && echo "controls bar OK"
curl -sfL "$B/charts.html" | grep -q '開始時間 (UTC)'       && echo "UTC labels OK"
curl -sf  "$B/css/style.css" | grep -q 'chart-controls'    && echo "CSS OK"
curl -sf  "$B/js/charts.js"  | grep -q 'PriceScaleMode'    && echo "log-scale JS OK"
curl -sf  "$B/js/charts.js"  | grep -q 'parseRangeParams'  && echo "param init OK"
curl -sf  "$B/js/records.js" | grep -q 'view-chart'        && echo "deep-link button OK"
curl -sf  "$B/js/records.js" | grep -q 'recordToRange'     && echo "recordToRange OK"

# 4. Discipline greps (expect 0 matches each)
rg -n "innerHTML" public/
rg -n "fetch\(" public/js/charts.js public/js/records.js
rg -n "addCandlestickSeries" public/
rg -n "lightweight-charts@latest" public/
rg -n "setVisibleTimeRange|subscribeVisibleTimeRangeChange|getTimeRange" public/js/
rg -n "document|window|location" public/js/chart-range.js

# 5. Manual/visual confirmation (optional — automated Playwright already covered):
#    - /charts.html no params → 30-day default, both charts synced
#    - pick 2023-01-01→2023-02-01 UTC, click 載入範圍 → both reload, summary updates
#    - tick 對數縮放 → both price axes go log at once
#    - on /, click a row's 查看K線 → /charts?start/end loads padded, centered window
#    - /charts.html?start=abc&end=xyz → falls back to default window, no errors
```