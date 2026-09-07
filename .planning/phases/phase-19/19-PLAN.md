---
phase: 19
title: Core Migration — KLineChart v10 Integration Plan
date: 2026-09-07
status: READY FOR EXECUTION
duration: 16-20 hours
---

# Phase 19 Plan: 核心遷移 (Core Migration)

## Goal

**完全替換 lightweight-charts v9 → klinecharts v10，保持所有現有功能等價。**

遷移時間戳合約、事件系統、樣式配置；驗證雙圖表同步、數據通過、E2E 測試全部通過。

---

## Success Criteria

- [ ] KLineChart init/setSymbol/setPeriod/setDataLoader API correctly mapped and tested
- [ ] Event system migration (subscribeAction) verified across chart sync scenarios
- [ ] Data transformation (timestamp ms pass-through) works for all K-line sources
- [ ] Both BTCUSDT and ETHUSDT charts rendering with correct candles
- [ ] Timestamp sync between charts no longer uses lightweight-charts API
- [ ] No API differences from Phase 18 assessment cause runtime errors
- [ ] All existing Phase 13 E2E tests pass with KLineChart
- [ ] npm test suite passes (628/628)

---

## Architecture Overview

### Before (v9 — lightweight-charts)
```
charts.html (UMD CDN)
    ↓
ChartManager.js (init, createChart, setData, setVisible)
    ↓
charts.js (subscribe to onVisibleLogicalRangeChange, sync two charts)
    ↓
Binance API → D1 → Render 1000+ candles
```

### After (v10 — klinecharts)
```
charts.html (UMD CDN → klinecharts v10)
    ↓
ChartManager.js (REWRITTEN: init, renderChart, setDataLoader, overrideYAxis)
    ↓
charts.js (MIGRATED: subscribe to subscribeAction, sync two charts)
    ↓
Binance API → D1 → Render 1000+ candles (same flow, different API)
```

**Key Difference**: Event names change, style config structure changes, but data pipeline identical.

---

## Task Breakdown

### Wave 1: ChartManager Rewrite (New Implementation)

**Goal**: Create new `ChartManager.js` using klinecharts v10 API, replacing all v9-specific code.

#### Task 1.1: Analyze Current ChartManager Structure
- **Input**: Current `public/js/managers/ChartManager.js` (v9)
- **Output**: Code diff identifying all v9-specific calls
- **Acceptance**:
  - [ ] List all methods: `init`, `createChart`, `setData`, `setVisible`, etc.
  - [ ] Mark which are v10-incompatible (e.g., chart.setData is now chart.setDataLoader)
  - [ ] Identify style config references (colors, fonts, axes)

#### Task 1.2: Translate API Calls (v9 → v10)
- **Input**: 18-COMPATIBILITY-ASSESSMENT.md (13 mappings), ChartManager v9
- **Output**: New ChartManager v10 implementation
- **Acceptance**:
  - [ ] `const chart = klinecharts.init(dom)` works
  - [ ] `chart.renderChart('kline', ...)` renders candlesticks
  - [ ] `chart.setDataLoader({ loadMoreData, getBarInRange })` binds loader
  - [ ] Timestamp field **unmapped** (passed as-is, no Math.floor)
  - [ ] Style config translated (nested object structure)
  - [ ] Zero console errors in Chrome

#### Task 1.3: Style Config Migration
- **Input**: v9 chart styles from existing ChartManager
- **Output**: v10-equivalent style objects
- **Acceptance**:
  - [ ] K-line colors (upColor, downColor) applied
  - [ ] Axis labels visible and readable
  - [ ] Grid lines present (if v9 had them)
  - [ ] Test in isolation: `npm run dev` → visit `/charts.html` with one symbol

#### Task 1.4: Test ChartManager Isolation
- **Input**: New ChartManager.js, BTCUSDT data
- **Output**: Single chart rendering correctly
- **Acceptance**:
  - [ ] Binance API fetches 1000+ candles
  - [ ] Chart renders without errors
  - [ ] Candle wicks align with data range
  - [ ] Manual scroll/zoom works (no crashes)

---

### Wave 2: Event System Migration (charts.js)

**Goal**: Replace v9 event listener with v10 `subscribeAction`, maintain time-sync between both charts.

#### Task 2.1: Audit Current Event Binding
- **Input**: `public/js/charts.js` (v9)
- **Output**: Event binding map
- **Acceptance**:
  - [ ] Identify all `onVisibleLogicalRangeChange` calls
  - [ ] Document what they do (scroll/zoom sync)
  - [ ] Understand `getVisibleRange()` → v10 equivalent

#### Task 2.2: Migrate to subscribeAction
- **Input**: 18-COMPATIBILITY-ASSESSMENT Part 4, v9 event binding
- **Output**: v10 event subscription
- **Acceptance**:
  - [ ] `chart.subscribeAction('click' | 'crosshair' | 'candle')` — correct action name chosen
  - [ ] Callback receives v10 event data (coordinates, bar index, etc.)
  - [ ] getVisibleRange → v10 alternative (e.g., getVisibleBarRange)
  - [ ] Both charts still sync when one scrolls/zooms

#### Task 2.3: Test Double-Chart Sync
- **Input**: Two ChartManager instances (BTCUSDT + ETHUSDT), event binding
- **Output**: Time-sync working end-to-end
- **Acceptance**:
  - [ ] Render two charts side-by-side
  - [ ] Scroll left chart → right chart follows (same time range)
  - [ ] Zoom in left → right chart zooms proportionally
  - [ ] Zoom out → both return to full 1h view
  - [ ] No lag or flicker

---

### Wave 3: Integration & Cleanup

**Goal**: Wire up HTML, remove v9 references, verify all E2E tests pass.

#### Task 3.1: Update charts.html CDN Reference
- **Input**: Current `public/charts.html` (points to lightweight-charts)
- **Output**: HTML points to klinecharts v10 UMD
- **Acceptance**:
  - [ ] `<script src="https://unpkg.com/klinecharts@10.0.3/dist/kline.umd.js"></script>`
  - [ ] `window.klinecharts` global available
  - [ ] No errors in browser console on page load

#### Task 3.2: Remove Lightweight-Charts References
- **Input**: Project source (all files)
- **Output**: v9 library + imports removed
- **Acceptance**:
  - [ ] `npm ls lightweight-charts` returns "not found" or removed from package.json
  - [ ] `grep -r "lightweight" public/` returns 0 results
  - [ ] No broken imports or require statements

#### Task 3.3: Clean Up Phase 18 Demo
- **Input**: `public/demo-klinechart.html` (Phase 18 verification artifact)
- **Output**: Archive or remove after Phase 19 verify passes
- **Acceptance**:
  - [ ] Demo kept in git history (commit message notes archival)
  - [ ] Not deployed to production
  - [ ] Link in README updated

#### Task 3.4: Run Full Test Suite
- **Input**: Phase 13 E2E tests + npm test suite
- **Output**: 100% pass rate (628/628 unit + all E2E)
- **Acceptance**:
  - [ ] `npm test` → all green
  - [ ] `npm run test:e2e` → all critical flows pass:
    - [ ] Create divergence record
    - [ ] View BTCUSDT chart
    - [ ] View ETHUSDT chart
    - [ ] Zoom/scroll charts (both sync)
    - [ ] Filter by date range
    - [ ] Leverage calculator
  - [ ] No console warnings/errors in Chrome DevTools

#### Task 3.5: Final Verification & Documentation
- **Input**: All changes from Wave 1-3
- **Output**: Phase 19 Summary + verification report
- **Acceptance**:
  - [ ] Both charts render live Binance data (1000+ 1h candles)
  - [ ] Time-sync verified across multiple zoom/scroll scenarios
  - [ ] Performance baseline (init time, memory) recorded
  - [ ] Screenshot: side-by-side BTCUSDT + ETHUSDT at same time range
  - [ ] Commit all changes with clear message
  - [ ] Push to `feature/klinechart-migration`

---

## File Modifications Summary

| File | Action | Lines | Notes |
|------|--------|-------|-------|
| `public/charts.html` | Modify | ~5 | Change CDN URL (lightweight → klinecharts) |
| `public/js/managers/ChartManager.js` | Rewrite | ~200-250 | New v10 API, timestamp passthrough, style config |
| `public/js/charts.js` | Modify | ~50-80 | Event binding migration (onVisibleLogicalRangeChange → subscribeAction) |
| `package.json` | Modify | ~2 | Remove lightweight-charts, klinecharts already in devDependencies |
| Tests (Phase 13) | Verify | 0 | E2E tests should pass as-is (no changes needed) |

**No changes to**:
- Backend (src/) — v10 only affects client-side rendering
- Database schema — timestamp already in ms
- API contracts — Binance API unchanged

---

## Risk Mitigations

| Risk | Mitigation | Owner | Verify By |
|------|-----------|-------|-----------|
| **Timestamp off-by-factor-1000** | Verified in Task 1.2 — no conversion, add comment | Executor | Chart renders correct date range (2026, not 1970) |
| **Event sync fails** | Test in Task 2.3 with explicit scenarios | Executor | Manual scroll/zoom → both charts move together |
| **Missing API (setPriceScale)** | Already hedged in 18-MIGRATION-CHECKLIST | 18 archive | grep confirms no setPriceScale calls in v10 impl |
| **Style renders incorrectly** | Reference v10 demo baseline + screenshot compare | Executor | Visual parity with Phase 18 demo |
| **E2E tests break** | Run full suite in Task 3.4, compare to Phase 13 baseline | Executor | npm test 628/628 + E2E all pass |

---

## Dependencies & Blockers

**Required Before Starting**:
- ✅ Phase 18 complete (demo works, APIs mapped, risks documented)
- ✅ 19-CONTEXT.md reviewed and locked
- ✅ Branch `feature/klinechart-migration` ready (Phase 18 pushed)

**External Dependencies**:
- klinecharts@10.0.3 already installed (devDependencies)
- Binance API accessible (no changes expected)
- D1 database schema (no changes)

**No Blockers Identified**. Phase 19 can start immediately after Phase 18 verification sign-off.

---

## Acceptance Gates (Go/No-Go Checklist)

**Before Phase 19 Execution Approved**:
- [ ] 19-CONTEXT.md reviewed by team (locked decisions)
- [ ] 19-PLAN.md reviewed (task breakdown, risks)
- [ ] Phase 18 verification report (18-VERIFICATION.md) all green
- [ ] No regressions from Phase 18 (npm test baseline matches)

**During Phase 19 Execution**:
- [ ] Wave 1 (ChartManager) complete + tested in isolation
- [ ] Wave 2 (Event sync) complete + tested with two charts
- [ ] Wave 3 (Integration) complete + E2E all pass

**Phase 19 Completion Criteria**:
- [ ] All 8 success criteria marked ✅
- [ ] npm test 628/628 green
- [ ] E2E suite 100% pass
- [ ] No console errors in Chrome/Safari
- [ ] Performance baseline recorded
- [ ] Branch committed + pushed
- [ ] Ready for Phase 20 (Drawing Tools)

---

## Timeline & Effort Estimate

| Wave | Task | Est. Hours | Notes |
|------|------|-----------|-------|
| 1 | ChartManager rewrite | 5-7h | Includes API translation, style config, testing |
| 2 | Event migration | 3-4h | Event binding audit, subscribeAction integration, sync test |
| 3 | Integration & cleanup | 4-5h | HTML update, v9 removal, E2E test suite, final verify |
| **Total** | | **12-16h** | **Within 16-20h estimate** |

**Buffer**: 4h reserved for debugging, unexpected API issues, or rework.

---

## Next Step

**Invoke**: `/gsd-plan-phase 19 --execute` (or wait for manual execution approval)

**Or manually start Wave 1**: Review ChartManager.js structure, begin API translation using 18-COMPATIBILITY-ASSESSMENT as reference.

---

## Appendix: Reference Documents

- **19-CONTEXT.md** — Locked decisions, risks, scope
- **18-RESEARCH.md** — Full klinecharts v10 API reference
- **18-COMPATIBILITY-ASSESSMENT.md** — 13 API mappings (4 sections)
- **18-MIGRATION-CHECKLIST-VERIFIED.md** — Week 1-3 verification, gotchas
- **18-BASELINE-LIGHTWEIGHT.md** — Performance baseline for comparison

---

**Status**: ✅ READY FOR EXECUTION

**Executor**: Ready to begin Wave 1 (ChartManager rewrite) upon approval.
