---
phase: 19
title: 核心遷移 (Core Migration) — Context Document
date: 2026-09-07
status: READY FOR PLANNING
---

# Phase 19 Context — 核心遷移

## Phase Goal

**完全替換 lightweight-charts v9 → klinecharts v10，保持所有現有功能等價。**

移除 v9 legacy code，集成 v10 API，驗證數據通過、事件監聽、圖表同步全部正常。

---

## Critical Decisions (LOCKED from Phase 18 Research)

### 1. Timestamp Contract: Pass-Through (No Conversion)
- **決策**: Binance API `openTime` 已是 13-digit ms，直接傳給 klinecharts `timestamp` 欄位，**無 Math.floor**
- **證據**: Task 1.2 驗證 — 1693526400000ms → 1693526400000ms (unchanged)
- **為什麼**: v10 期望 ms，Binance 已提供 ms → 零轉換
- **風險**: 若誤用 `/1000` 或 `Math.floor`，圖表會渲染 1970 年左右的日期
- **Phase 19 Do**: 在 ChartManager.js 中映射時務必不轉換，加註解明確標記

### 2. Event API Migration: `subscribeAction` (Not `onVisibleLogicalRangeChange`)
- **決策**: v10 用 `subscribeAction` 監聽圖表事件，v9 的 `onVisibleLogicalRangeChange` 已不可用
- **涉及**: 雙圖表時間同步依賴事件 → 需重寫事件綁定
- **Phase 19 Do**: 在 charts.js 中搜尋 `onVisibleLogicalRangeChange`，替換為 v10 的事件訂閱模式

### 3. Style Config Syntax: Nested Object Structure
- **決策**: v10 style config 不同於 v9，需要完整重寫樣式對象
- **涉及**: K 線顏色、軸標籤、網格線等視覺設定
- **Phase 19 Do**: 在 ChartManager.js 中檢視現有 style 設定，轉換為 v10 格式（可參考 18-COMPATIBILITY-ASSESSMENT.md Part 2）

### 4. UMD vs ESM
- **決策**: Phase 19 用 **UMD CDN** (klinecharts@10.0.3/dist/kline.umd.js)，不用 ESM
- **為什麼**: 現有 charts.html 純靜態，無構建步驟 → UMD 全局 `window.klinecharts` 最簡單
- **Phase 20 後**: 才整合 @klinecharts/extension ESM（需要 import map 或構建工具）

---

## Known Risks & Mitigations

| Risk | Severity | Mitigation | Owner |
|------|----------|-----------|-------|
| Data format mismatch (timestamp) | CRITICAL | ✅ RESOLVED — verified in Task 1.2, add inline doc comment | Phase 19 executor |
| Event binding crash | HIGH | Review 18-COMPATIBILITY-ASSESSMENT Part 4, test sync in demo first | Phase 19 executor |
| Style config breaks rendering | HIGH | Reference v10 type definitions + demo baseline (18-BASELINE) | Phase 19 executor |
| Missing API (setPriceScale, etc) | MEDIUM | Hedge removed from 18-MIGRATION-CHECKLIST; use `overrideYAxis` instead | 18 archive (ref only) |

---

## Files to Modify (Phase 19 Scope)

### Core Files
1. **public/charts.html**
   - Replace `<script src="...lightweight-charts...">` with `<script src="...klinecharts@10.0.3/dist/kline.umd.js">`
   - No other HTML changes expected

2. **public/js/managers/ChartManager.js** (REWRITE)
   - Old: Uses `LightweightCharts` API (init, createChart, etc)
   - New: Uses `klinecharts` API (init, createChart with v10 config)
   - Key: Timestamp pass-through, style config translation
   - Size: ~200-250 lines (estimated from 18-COMPATIBILITY-ASSESSMENT)

3. **public/js/charts.js** (MIGRATE)
   - Old: Uses `onVisibleLogicalRangeChange` event
   - New: Uses `subscribeAction` for time-sync binding
   - Keep: Data transformation logic (already v10-compatible from Task 1.2)

### Test Files
- **test/e2e/charts.spec.ts** — verify both charts render + sync
- **npm test** — sanity check (628/628 green from v2.0 baseline)

### No Changes Needed
- `src/` backend code — v10 only changes client-side chart rendering
- `public/demo-klinechart.html` — Phase 18 demo, delete after Phase 19 verify
- Database schema — timestamp already in ms (no migration needed)

---

## Success Criteria (From ROADMAP)

- [ ] KLineChart init/setSymbol/setPeriod/setDataLoader API correctly mapped and tested
- [ ] Event system migration (subscribeAction) verified across chart sync scenarios
- [ ] Data transformation (timestamp ms pass-through) works for all K-line sources
- [ ] Both BTCUSDT and ETHUSDT charts rendering with correct candles
- [ ] Timestamp sync between charts no longer uses lightweight-charts API
- [ ] No API differences from Phase 18 assessment cause runtime errors
- [ ] All existing Phase 13 E2E tests pass with KLineChart

---

## Reference Documents

- **18-RESEARCH.md** — Full API reference (import paths, method signatures)
- **18-COMPATIBILITY-ASSESSMENT.md** — 13 API mappings, event system, style config (4 sections)
- **18-MIGRATION-CHECKLIST-VERIFIED.md** — Week 1-3 verification, 32+ items, gotchas
- **18-BASELINE-LIGHTWEIGHT.md** — Performance baseline (for comparison after Phase 19)

---

## Phase 19 Workflow Outline

### Wave 1: ChartManager Rewrite (New)
1. Create `ChartManager.js` using klinecharts v10 API
2. Map all old init/renderChart calls to new equivalents
3. Test in isolation (demo-klinechart.html as reference)

### Wave 2: charts.js Event Migration (Modify)
1. Replace `onVisibleLogicalRangeChange` with `subscribeAction`
2. Verify double-chart sync works in browser
3. Run E2E tests

### Wave 3: Cleanup & Verification
1. Remove lightweight-charts CDN reference
2. Delete mock data loaders (use real Binance API)
3. Verify all 7 E2E scenarios pass (from Phase 13)

---

## Definition of "Done"

✅ **Phase 19 complete when:**
1. BTCUSDT + ETHUSDT both render correctly (real Binance data, 1000+ candles)
2. Time-sync works: scroll/zoom one chart → other chart follows
3. npm test passes (628/628)
4. All E2E tests pass (Phase 13 suite)
5. No console errors in Chrome + Safari
6. Demo committed to branch, ready for Phase 20

---

**Next Step**: Invoke `/gsd-plan-phase 19` to generate detailed PLAN.md with task breakdown.
