# Requirements: v3.0 TradingView 級升級

**Milestone**: v3.0  
**Phases**: 18-22  
**Start**: 2026-09-03  
**Status**: 🚧 In Progress

---

## Phase 18: 充分準備 (Full Preparation)

> Goal: 環境就緒、評估完成、第一個 demo 運行、性能基準已記錄

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R18-01 | klinecharts@10.0.3 已安裝並驗證（`import` 可用） | HIGH | ✅ |
| R18-02 | @klinecharts/extension CDN 連線測試通過 | HIGH | ✅ |
| R18-03 | 三倉庫相容性評估文件完成（版本衝突、API 差異、timestamp 格式） | HIGH | ✅ |
| R18-04 | Migration Checklist 逐條確認（所有項目已理解） | HIGH | ✅ |
| R18-05 | 獨立 KLineChart demo HTML 可以渲染 BTCUSDT K 線（使用假資料） | HIGH | ✅ |
| R18-06 | 性能基準已記錄：lightweight-charts 初始化時間、記憶體用量、bundle size | MEDIUM | ✅ |
| R18-07 | 5 個 phase 詳細計劃已最終確認（此 ROADMAP 文件） | HIGH | ✅ |
| R18-08 | 開發分支 `feature/klinechart-migration` 已建立並推送 | HIGH | ✅ |
| R18-09 | 已識別所有高風險 API 差異（timestamp ms→s、事件名稱、style config） | HIGH | ✅ |
| R18-10 | 已確認 data-aggregator 延後至 v3.1（使用者為事後分析交易者） | LOW | ✅ |

**Success Criteria (充分準備版)**: 所有 R18-0x 完成，demo 可正確渲染，基準數據記錄完整。

---

## Phase 19: 核心遷移 (Core Migration)

> Goal: lightweight-charts 完全替換為 KLineChart，所有現有功能保持等價

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R19-01 | 從 charts.html 移除 lightweight-charts CDN，加入 KLineChart UMD | HIGH | ⬜ |
| R19-02 | ChartManager.js 遷移到 KLineChart API（init、destroy、dispose） | HIGH | ⬜ |
| R19-03 | Timestamp pass-through: Binance open_time (ms) 以 `timestamp` 鍵直通，無轉換 | CRITICAL | ⬜ |
| R19-04 | 雙圖表時間同步功能正常（左右滾動連動） | HIGH | ⬜ |
| R19-05 | Log scale 切換功能正常 | HIGH | ⬜ |
| R19-06 | 從記錄表「查看K線」跳轉功能正常 | HIGH | ⬜ |
| R19-07 | 所有現有 K 線顯示正常（顏色、陰影線、成交量） | HIGH | ⬜ |
| R19-08 | 回到歷史區間功能正常 | MEDIUM | ⬜ |
| R19-09 | 無 console.error，無 JavaScript 異常 | HIGH | ⬜ |
| R19-10 | 性能提升已驗證（初始化時間 ≤ lightweight-charts 的 60%） | MEDIUM | ⬜ |

---

## Phase 20: 繪圖工具 (Drawing Tools)

> Goal: @klinecharts/extension 整合，使用者可在圖上繪製分析標記

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R20-01 | @klinecharts/extension 已安裝並整合（CDN 或 npm） | HIGH | ⬜ |
| R20-02 | 繪圖工具欄 UI 顯示在圖表旁（趨勢線、水平線、矩形） | HIGH | ⬜ |
| R20-03 | 趨勢線工具可正常繪製和刪除 | HIGH | ⬜ |
| R20-04 | 斐波那契回撤工具可正常繪製 | HIGH | ⬜ |
| R20-05 | 水平線工具（支撐/阻力線）可繪製 | HIGH | ⬜ |
| R20-06 | 磁吸模式（magnet mode）啟用後游標吸附到 K 線高低點 | HIGH | ⬜ |
| R20-07 | 繪圖物件持久化（切換圖表後保留） | MEDIUM | ⬜ |
| R20-08 | 清除所有繪圖按鈕 | LOW | ⬜ |
| R20-09 | 兩張圖表（BTC/ETH）各自獨立管理繪圖 | MEDIUM | ⬜ |

---

## Phase 21: 技術指標 (Indicators)

> Goal: 內建技術指標面板，使用者可疊加標準指標到 K 線

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R21-01 | 指標選單 UI（下拉或工具欄按鈕）可開啟 | HIGH | ⬜ |
| R21-02 | MA（移動平均）可添加，週期可設定 | HIGH | ⬜ |
| R21-03 | EMA（指數移動平均）可添加 | HIGH | ⬜ |
| R21-04 | MACD 指標顯示在副面板 | HIGH | ⬜ |
| R21-05 | RSI 指標顯示在副面板 | HIGH | ⬜ |
| R21-06 | Bollinger Bands 顯示在主面板 | MEDIUM | ⬜ |
| R21-07 | 可移除已添加的指標 | HIGH | ⬜ |
| R21-08 | 指標設定（顏色、週期）可個別配置 | MEDIUM | ⬜ |
| R21-09 | 指標在兩張圖表（BTC/ETH）各自獨立 | MEDIUM | ⬜ |

---

## Phase 22: 優化上線 (Polish & Production)

> Goal: 所有功能完整，性能達標，部署到生產

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R22-01 | 與 Phase 18 基準比較，初始化速度提升 ≥ 30% | MEDIUM | ⬜ |
| R22-02 | Bundle size 減少（lightweight-charts 50KB gzip → KLineChart 28KB） | MEDIUM | ⬜ |
| R22-03 | 手機/平板響應式佈局正常（繪圖工具欄不遮擋圖表） | MEDIUM | ⬜ |
| R22-04 | 生產環境部署完成（Cloudflare Workers） | HIGH | ⬜ |
| R22-05 | 所有現有 v1.0 功能驗證通過（記錄、查看K線、計算器） | HIGH | ⬜ |
| R22-06 | E2E 測試通過（現有測試套件 ≥ 前一次通過率） | HIGH | ⬜ |
| R22-07 | `feature/klinechart-migration` merge to `main` | HIGH | ⬜ |

---

## Traceability Matrix

| Phase | Requirements | Priority |
|-------|-------------|----------|
| 18 (Preparation) | R18-01 to R18-10 | 充分準備版 (18-20h) |
| 19 (Core Migration) | R19-01 to R19-10 | 核心功能等價 (16-20h) |
| 20 (Drawing Tools) | R20-01 to R20-09 | @klinecharts/extension (20-25h) |
| 21 (Indicators) | R21-01 to R21-09 | 技術指標面板 (16-20h) |
| 22 (Polish) | R22-01 to R22-07 | 生產就緒 (12-16h) |
| **Total** | **45 requirements** | **82-101 hours** |

---

## Out of Scope (v3.0)

- @klinecharts/data-aggregator（實時 tick 聚合）→ 延後至 v3.1
- @klinecharts/pro（商業版）→ 不在計劃內
- 自動背離檢測 → v4+
- 多用戶支持 → v4+

---

*Last updated: 2026-09-03 — v3.0 milestone initialized*
