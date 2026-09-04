# Roadmap: BTC/ETH Divergence Tracker

## Milestones

- ✅ **v1.0 MVP** — Phases 1-13 (shipped 2026-08-30)
- ✅ **v2.0 Architecture Deepening** — Phases 14-17 (shipped 2026-09-03)
- 🚧 **v3.0 TradingView 級升級** — Phases 18-22 (started 2026-09-03)

---

## Active Development

### v3.0: TradingView 級升級 (Phases 18-22) 🚧

**Branch**: `feature/klinechart-migration`  
**Started**: 2026-09-03  
**Estimated**: 82-101 hours, 5 phases

#### Phase 18: 充分準備 (Full Preparation) — 18-20h

**Goal**: 環境就緒、評估完成、第一個 demo 運行、性能基準已記錄

**Deliverables**:
- Dev environment validation (klinecharts@10.0.3 + extension CDN)
- Three-repo compatibility assessment document
- Migration checklist line-by-line verification
- First KLineChart standalone demo rendering real Binance data
- Performance baseline: lightweight-charts timing/memory/bundle
- Finalized 5-phase detailed plan

**Success Criteria (充分準備版)**:
- [ ] klinecharts 可正確 import 和渲染
- [ ] @klinecharts/extension CDN 連線測試通過
- [ ] Migration checklist 所有項目理解並標記
- [ ] Demo HTML 使用假資料與真實 Binance 數據皆正確顯示 K 線（先假後真）
- [ ] 性能基準數字已記錄到文件
- [ ] 5-phase 計劃確認（此 ROADMAP）
- [ ] 所有高風險 API 差異已識別

**Requirements**: R18-01 to R18-10  
**Status**: 🚧 IN PROGRESS

---

#### Phase 19: 核心遷移 (Core Migration) — 16-20h

**Goal**: lightweight-charts 完全替換為 KLineChart，所有現有功能保持等價

**Deliverables**:
- charts.html 改用 KLineChart UMD CDN
- ChartManager.js 完整重寫（KLineChart API）
- charts.js 遷移（資料格式、事件監聽）
- 雙圖表時間同步（用 KLineChart 事件系統）
- 所有現有功能通過測試

**Key Risks**:
- Timestamp 合約：Binance `open_time` 已是毫秒，KLineChart v10 亦需毫秒（`timestamp` 欄位）→ 直通 pass-through，無需轉換
- 事件 API 變更：`onVisibleLogicalRangeChange` → `subscribeAction`
- Style config 語法完全不同（物件結構）

**Success Criteria**:
- [ ] KLineChart init/setSymbol/setPeriod/setDataLoader API correctly mapped and tested
- [ ] Event system migration (subscribeAction) verified across chart sync scenarios
- [ ] Data transformation (timestamp ms pass-through) works for all K-line sources
- [ ] Both BTCUSDT and ETHUSDT charts rendering with correct candles
- [ ] Timestamp sync between charts no longer uses lightweight-charts API
- [ ] No API differences from Phase 18 assessment cause runtime errors
- [ ] All existing Phase 13 E2E tests pass with KLineChart

**Requirements**: R19-01 to R19-10  
**Status**: ⬜ Not started

---

#### Phase 20: 繪圖工具 (Drawing Tools) — 20-25h

**Goal**: @klinecharts/extension 整合，使用者可在圖上繪製分析標記

**Deliverables**:
- @klinecharts/extension 整合（CDN 或 npm build）
- 繪圖工具欄 UI（在圖表旁）
- 趨勢線、水平線、矩形、斐波那契回撤
- 磁吸模式（magnet）啟用後游標吸附 K 線高低點
- 繪圖物件持久化（切換區間不消失）

**Success Criteria**:
- [ ] @klinecharts/extension loads without console errors (via ESM CDN or npm)
- [ ] Drawing toolbar renders and is positioned correctly on page
- [ ] User can draw trend lines, horizontal lines, rectangles without crashes
- [ ] Fibonacci retracement tool calculates and displays levels correctly
- [ ] Magnet mode toggles on/off and cursor snaps to candle wicks when enabled
- [ ] Drawing objects persist when switching timeframes or symbols
- [ ] Drawing state clears when user clicks a clear/reset button
- [ ] No regressions in Phase 19 chart functionality

**Requirements**: R20-01 to R20-09  
**Status**: ⬜ Not started

---

#### Phase 21: 技術指標 (Indicators) — 16-20h

**Goal**: 內建技術指標面板，使用者可疊加標準指標到 K 線

**Deliverables**:
- 指標選單 UI
- 主面板指標：MA, EMA, Bollinger Bands
- 副面板指標：MACD, RSI
- 指標週期和顏色設定
- BTC/ETH 各自獨立指標管理

**Success Criteria**:
- [ ] Indicator menu renders and lists available indicators (MA, EMA, BB, MACD, RSI)
- [ ] User can add/remove indicators from chart without crashes
- [ ] Main panel indicators (MA, EMA, BB) display candle overlays correctly
- [ ] Sub-panel indicators (MACD, RSI) render in separate lower pane
- [ ] Period parameter changes (e.g., MA 20→50) update chart immediately
- [ ] Color picker works and updates indicator colors on chart
- [ ] BTC and ETH charts manage indicators independently
- [ ] Indicators persist when switching timeframes
- [ ] All Phase 19-20 functionality remains intact

**Requirements**: R21-01 to R21-09  
**Status**: ⬜ Not started

---

#### Phase 22: 優化上線 (Polish & Production) — 12-16h

**Goal**: 所有功能完整，性能達標，merge 到 main 並部署

**Deliverables**:
- 性能對比報告（vs Phase 18 基準）
- 響應式佈局修復
- Cloudflare Workers 生產部署
- 現有 E2E 測試全部通過
- feature/klinechart-migration → main merge
- ROADMAP.md 更新為 ✅

**Success Criteria**:
- [ ] KLineChart init time ≤ 60% of lightweight-charts baseline (from Phase 18)
- [ ] Memory usage with 1000+ candles ≤ 60% of lightweight-charts
- [ ] Bundle size with extension ≤ 45KB gzip
- [ ] Responsive layout works on mobile (iPhone, iPad, Android)
- [ ] All Phase 13 E2E tests pass on production build
- [ ] Cloudflare Workers deployment successful (both /api/klines and /admin routes)
- [ ] feature/klinechart-migration merged to main with zero conflicts
- [ ] ROADMAP.md marked complete; no open issues blocking production

**Requirements**: R22-01 to R22-07  
**Status**: ⬜ Not started

---

### v2.0 Complete ✅

<details open>
<summary>✅ v2.0: Architecture Deepening (Phases 14-17) — SHIPPED 2026-09-03</summary>

**Timeline**: 2 days (2026-09-02 → 2026-09-03)

#### Phase 14: Architecture Foundations (Temporal + Divergence)
- Centralized temporal API (`TemporalConverter`)
- Unified divergence type definitions
- 30+ unit tests, zero HIGH issues

#### Phase 15: Frontend State Refactoring (ChartManager)
- Merged 4 chart modules into unified state machine
- Re-entrancy guards for race-condition-free sync
- 62 tests (49 unit + 13 integration), 81/81 E2E pass

#### Phase 16A: Structured Logging System
- Custom lightweight logger (no dependencies, preserves no-build)
- ChartManager/charts/records instrumented
- Workers Logs enabled, 100% head sampling

#### Phase 16: Backend Service Deepening (RecordsRepository)
- Extracted all records SQL into rich service
- `findByTimeRange()` with overlap semantics
- `listWithStats()` with JS-computed aggregates
- Routes simplified to ≤10 LOC

#### Phase 17: Future-Proofing (Calculator Validation)
- Zod schemas for calculator input/output
- API endpoint stubs (POST /validate, /compute → 501)
- Frontend mirror + parity tests
- 57 tests (42 unit + 15 contract), 100% coverage on new code

**Quality Summary**:
- ✅ 628 tests (42 files), 88.42% coverage (≥85%)
- ✅ TypeScript clean, zero regressions
- ✅ 0 new technical debt
- ✅ All v1 requirements (41/41) still met

</details>

---

## Historical Milestones

<details>
<summary>✅ v1.0: MVP (Phases 1-13) — SHIPPED 2026-08-30</summary>

**Delivered:**
- Worker + D1 infrastructure (Phase 1)
- Binance kline ingestion + daily cron (Phases 2-3)
- Records CRUD + filtering (Phases 4-5)
- Dual chart rendering + time sync (Phases 6-7)
- Leverage calculator (Phase 8)
- CF Access gating + navigation (Phase 9)
- Timestamp abstraction (Phase 10)
- Structured error handling (Phase 11)
- Service layer pattern (Phase 12)
- Frontend state isolation (Phase 13)

**Coverage**: 41/41 v1 requirements ✅

</details>

---

## What's Next

### v3.1+ (Deferred)

- **@klinecharts/data-aggregator** — 實時 tick 聚合（WebSocket → K 線）
- **記錄標記疊加** — 在圖上顯示背離記錄時間點
- **Analytics Dashboard** — 記錄統計、類型頻率、CSV 匯出

---

## Archive

Full phase details, requirements traceability, and quality metrics for each milestone are archived in `.planning/milestones/`:

- `v1.0-ROADMAP.md` — Phase 1-13 details
- `v1.0-REQUIREMENTS.md` — 41 completed v1 requirements
- `v2.0-ROADMAP.md` — Phase 14-17 details, decisions, metrics
- `v2.0-REQUIREMENTS.md` — v1 completion summary + v2 backlog

---

## Quick Reference

| Milestone | Phases | Status | Date | Tests | Coverage |
|-----------|--------|--------|------|-------|----------|
| v1.0 MVP | 1-13 | ✅ Shipped | 2026-08-30 | 571 | 86.12% |
| v2.0 Architecture | 14-17 | ✅ Shipped | 2026-09-03 | 628 | 88.42% |
| v3.0 TradingView 級 | 18-22 | 🚧 In Progress | Started 2026-09-03 | — | — |

---

*For detailed phase plans, quality gates, and technical decisions, see archived milestones in `.planning/milestones/`*
