# Phase 18 Discussion Log

**Date**: 2026-09-03  
**Phase**: 18 (Full Preparation — 充分準備版)  
**Participants**: User, Claude

---

## Discussion Summary

User confirmed four verification/testing approach decisions for Phase 18 preparation work.

---

## Area 1: Demo 資料規模

**Question**: Demo 應該用多少 K 線數據？

**Options Presented**:
1. 假資料 (100 筆，快速測試)
2. 少量真實數據 (300-500 筆，1-2 API 調用)
3. 完整真實數據 (1000+ 筆，完整驗證)

**User Selection**: 完整真實數據 (1000+ 筆)

**Notes**: 選擇確保性能基準能準確反映實際使用情況。Demo 需要用完整月份數據（BTCUSDT 1h 級別 ~1000+ K 線）。

---

## Area 2: 性能測量環境

**Question**: Baseline 【初始化時間、記憶體、bundle】應該在哪些瀏覽器/設備上測量？

**Options Presented**:
1. Chrome (desktop) — 開發主力環境
2. Firefox (desktop) — 跨瀏覽器驗證
3. Safari (desktop) — WebKit 效能驗證
4. Safari iOS (手機) — 移動設備驗證

**User Selection**: Chrome (desktop) + Safari iOS

**Notes**: 
- Chrome: DevTools Performance 標籤精確測量，開發效率高
- Safari iOS: 使用者實際環境（手機交易應用）
- Firefox/Safari desktop: 可延後至 Phase 22 優化階段

---

## Area 3: 相容性評估深度

**Question**: 三倉庫相容性評估的深度（CDN vs npm, 版本較較, API 角度）

**Options Presented**:
1. 輕量級 (2h) — CDN 版本檢查，快速驗證
2. 中量級 (4h) — 深入理解主要 API 候選，小規模演示
3. 深度 (6-8h) — 獲得對 minor API 和邊界情況的充分理解

**User Selection**: 深度 (6-8h)

**Notes**: 
- 充分準備版 (💎) 需要充分理解三倉庫細節
- 涵蓋版本相容性、次要 API、邊界情況
- 結合 technical-assessment.md 和 migration-checklist.md 的深度分析

---

## Area 4: 遷移風險優先級

**Question**: Phase 18 偵測高風險時，哪個優先驗證？

**Options Presented**:
1. Timestamp 轉換 (ms → s) — 最關鍵的阻塞風險
2. Event API 變化 (onVisibleLogicalRangeChange → subscribeAction)
3. Style config 語法差異 — 最不緊急的優先

**User Selection**: Timestamp 轉換

**Notes**:
- 最關鍵的驗證項目：如果時間戳錯誤，圖表無法渲染
- Demo 中首先測試 `Math.floor(open_time / 1000)`
- 其他 API 差異可在圖表運行後逐步調試

---

## Deferred Ideas Captured

1. @klinecharts/pro 作為未來「高級版」參考（不在 v3.0 範圍內）
2. Real-time tick aggregation via data-aggregator（v3.1+）
3. Dark mode（使用者未提及，暫時跳過）

---

## Decision Confidence

All four decisions made with clear rationale:
- ✓ Demo scope = complete real data (aligned with baseline measurement goal)
- ✓ Measurement env = Chrome + iOS (covers dev + actual usage)
- ✓ Evaluation depth = deep (appropriate for 💎 Full Preparation standard)
- ✓ Risk priority = Timestamp first (blocks everything else)

**Ready to proceed**: Phase 18 planning can now begin with clear context.

---

*Created by discuss-phase workflow on 2026-09-03*
