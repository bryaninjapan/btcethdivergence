# Phase 18 Context: 充分準備版

**Date**: 2026-09-03  
**Phase**: 18  
**Title**: Full Preparation (充分準備版)  
**Goal**: 環境就緒、評估完成、第一個 demo 運行、性能基準已記錄

---

## Domain

KLineChart 生態系統遷移前的環境驗證 + 三倉庫相容性評估 + 性能基準設立。

不是寫實現代碼，而是：
1. 驗證工具（klinecharts@10.0.3 + @klinecharts/extension）可用
2. 深度評估三倉庫之間的 API 差異 + 版本相容性
3. 建立 lightweight-charts baseline（初始化時間、記憶體、bundle 大小）
4. 識別並驗證已知的高風險項
5. 運行第一個 KLineChart demo

---

## Decisions (Captured from Discussion)

### Demo 資料規模
**Decision**: 完整真實數據 (1000+ K 線)  
**Why**: 性能基準必須反映實際使用情況。只有用真實數據才能比較 lightweight-charts vs KLineChart 的初始化時間、記憶體消耗。  
**How**: 從 Binance REST API 拉取 BTCUSDT 的 1000+ 根 1h K 線（約 1 個月數據）。

### 性能測量環境
**Decision**: Chrome (desktop) + Safari iOS  
**Why**:
- Chrome: 開發主力環境，DevTools Performance 標籤可精確測量
- Safari iOS: 使用者實際使用環境，驗證行動設備性能

**How**: 使用 Chrome DevTools Performance 標籤 + 手動 `performance.now()` 搭配，以及 iOS Safari 的 Web Inspector。

### 相容性評估深度
**Decision**: 深度評估 (6-8 小時)  
**Why**: 充分準備版 (💎) 需要對三倉庫的細節有充分理解，不能只看表面。  
**How**:
- 逐個 API 對比 lightweight-charts vs KLineChart（事件、時間戳、style 配置）
- 檢查 @klinecharts/extension 與基礎庫的相容性（版本、依賴）
- 檢查 @klinecharts/pro 作為參考（雖然不用，但有助理解完整生態）

### 遷移風險優先級
**Decision**: Timestamp 轉換首先驗證  
**Why**: 最關鍵的阻塞風險。Binance `open_time` 是毫秒，KLineChart 需要秒。轉換錯誤 → 圖表無法渲染。  
**How**:
1. Demo 中首先測試 `Math.floor(open_time / 1000)` 轉換
2. 驗證 KLineChart 是否正確解析秒級時間戳
3. 再驗證其他 API 差異（Event、Style）

---

## Phase 18 Success Criteria (充分準備版)

根據 REQUIREMENTS.md R18-01 to R18-10：

- [ ] klinecharts@10.0.3 npm 安裝並驗證 (`import` 可用)
- [ ] @klinecharts/extension CDN URL 測試可連線
- [ ] 三倉庫相容性評估文件完成（版本、API 差異、timestamp 格式）
- [ ] Migration Checklist 逐條確認（所有項目已理解）
- [ ] 獨立 KLineChart demo HTML 可以渲染 BTCUSDT K 線（1000+ 筆真實數據）
- [ ] 性能基準已記錄（Chrome + Safari iOS）：
  - lightweight-charts 初始化時間
  - lightweight-charts 記憶體用量
  - lightweight-charts bundle size
- [ ] 5 個 phase 詳細計劃已確認（ROADMAP.md）
- [ ] 開發分支 `feature/klinechart-migration` 已推送
- [ ] 所有高風險 API 差異已識別（Timestamp ✓、Event、Style）
- [ ] 已確認 data-aggregator 延後至 v3.1

---

## Decisions (Prior Phases)

From PROJECT.md Key Decisions:
- KLineChart v10.0.3 為遷移目標（Canvas-based，2-3x 快速，44% 更小的 bundle）
- 使用者為事後分析交易者（REST API 足夠，不需實時 WebSocket）
- Cloudflare Workers + D1 架構（已驗證穩定）

---

## Deferred Ideas

- @klinecharts/pro 作為未來"高級版"的參考（不在 v3.0 計劃內）
- Real-time tick aggregation via @klinecharts/data-aggregator（延後至 v3.1）
- Dark mode（先不要，用戶沒提）

---

## Canonical References

Files downstream agents (researcher, planner) must read:

- `.planning/REQUIREMENTS.md` — Phase 18 的 10 項需求（R18-01 to R18-10）
- `.planning/ROADMAP.md` — 完整 5-phase 計劃
- `.planning/technical-assessment.md` — API 差異、性能基準預估、風險矩陣
- `.planning/migration-checklist.md` — 週次遷移清單、程式碼範例
- `.planning/performance-benchmark-plan.md` — 基準測試計劃（5 項測試）
- `.planning/klinecharts-ecosystem.md` — 三倉庫分析
- `package.json` — klinecharts@10.0.3 已安裝

---

*Created by discuss-phase on 2026-09-03*
