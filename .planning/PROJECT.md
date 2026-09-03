# BTC/ETH Divergence Tracker

## What This Is

一個私人交易分析工具，用於記錄和分析 BTC/ETH 價格不同步（divergence）現象，並提供獨立的杠桿交易計算器。只有擁有者本人使用，透過 Cloudflare Access 密碼保護。

## Core Value

讓使用者能快速記錄、回顧和分析 BTC 與 ETH 之間的價格背離事件，累積可靠的歷史觀察數據。

## Requirements

### Validated (v1.0) ✅

- [x] 使用者可以建立不同步記錄（含開始/結束時間、類型、備註、標籤） — Phase 4
- [x] 使用者可以編輯和刪除已有的不同步記錄 — Phase 4
- [x] 使用者可以查看所有歷史不同步記錄的表格 — Phase 4
- [x] 使用者可以按類型和標籤篩選記錄 — Phase 5
- [x] 使用者可以查看 BTC 和 ETH 的 1 小時 K 線圖（上下並排） — Phase 6
- [x] 兩張 K 線圖時間同步（滾動/縮放連動） — Phase 6
- [x] K 線圖支持 log 縮放 — Phase 7
- [x] 使用者可以從記錄表點擊「查看K線」自動加載對應時段圖表 — Phase 7
- [x] 使用者可以用獨立的杠桿計算器計算盈虧比（輸入開倉/止損/止盈價格） — Phase 8
- [x] K 線歷史數據從 Binance API 抓取並緩存在 D1 — Phase 2–3
- [x] 每天自動 cron 更新最新 K 線數據 — Phase 3
- [x] 時間輸入使用下拉選單（年/月/日/時）而非手打 — Phase 5
- [x] 網站透過 Cloudflare Access 進行密碼保護 — Phase 9

### Active (v3.0 — TradingView 級升級)

- [ ] 將圖表庫從 lightweight-charts 遷移到 KLineChart — Phase 19
- [ ] 整合 @klinecharts/extension 繪圖工具（趨勢線、斐波那契、磁吸模式） — Phase 20
- [ ] 新增技術指標面板（MA, EMA, MACD, RSI, Bollinger） — Phase 21
- [ ] 環境準備、相容性評估、性能基準 — Phase 18
- [ ] 優化、上線、生產驗證 — Phase 22

### Out of Scope

- 4 小時 K 線 — 使用者決定只用 1h，不需要 4h 也不需要合成
- 疊圖（overlay chart）— 太亂，使用上下並排即可
- 圖表互動標記（在圖上點擊選點帶入計算器）— 手動輸入價格更簡單
- 其他交易對 — 只做 BTCUSDT 和 ETHUSDT
- 多用戶支持 — 只有擁有者一人使用
- 自動檢測不同步 — MVP 只做手動記錄
- 移動端 app — Web 即可

## Context

- 擁有者有加密貨幣交易經驗，主要觀察 BTC 和 ETH 的價格背離
- 背離類型基於 K-線高低點組合（4 種），加上 Major Structure Break (MSB) 標記：
  1. **BTC HH + ETH LH**: BTC 創新高，ETH 反彈不力（ETH 弱）
  2. **BTC LH + ETH HH**: BTC 反彈，ETH 創新高（ETH 強）
  3. **BTC LL + ETH HL**: BTC 創新低，ETH 支撐（ETH 強）
  4. **BTC HL + ETH LL**: BTC 支撐，ETH 創新低（BTC 強）
  - 每個記錄可標記是否有 **Major Structure Break (MSB: yes/no)**
- 歷史數據需要從 2021 年 1 月開始回溯，手動回看歷史 K 線逐條標記
- 擁有者已有 Cloudflare 使用經驗（soapwavehealing 專案）
- 前端 UI 計劃用 Google AI Studio 生成，再手動整合
- 擁有者對後端和架構不熟悉，需要 Claude 協助

## Constraints

- **Tech stack**: Cloudflare Workers (單一部署，含 Static Assets binding) + D1 — 不使用 Pages，單一 Worker 專案服務靜態資源和 API（架構已鎖定於 Phase 1 ROADMAP INFRA-01）
- **Data source**: Binance public API (no API key required for klines)
- **Frontend**: 純靜態 HTML/CSS/JS — 由 Google AI Studio 生成，無構建步驟
- **Chart library**: KLineChart v10.0.3 (replacing Lightweight Charts) + @klinecharts/extension
- **Privacy**: Public repo + Cloudflare Access 密碼保護
- **Budget**: 免費/低成本方案（Cloudflare free tier）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 只存 1h K 線，不存 4h | 使用者決定不需要看 4h 圖表 | ✅ VALIDATED — Lightweight Charts handles 1h adequately |
| Cloudflare D1 而非 Supabase | 數據量小（~110K 行），使用者已有 CF 經驗 | ✅ VALIDATED — D1 scales easily to 50K+ klines |
| 計算器獨立，手動輸入 | 圖表互動開發量大，手動輸入更實際 | ✅ VALIDATED — Client-side calculator works well |
| 上下並排 K 線圖，非疊圖 | 使用者偏好清晰的分開顯示 | ✅ VALIDATED — Stacked charts render clearly, sync reliable |
| 時間輸入用下拉選單 | 使用者希望快速選擇，避免手打格式錯誤 | ✅ VALIDATED — Dropdowns prevent typos, UX smooth |
| 前端由 Google AI Studio 生成 | 使用者熟悉該工具，加速 UI 開發 | ✅ VALIDATED — AI-generated UI integrated successfully |
| Build order: 記錄表 → K線圖 → 計算器 | 使用者定義的優先級 | ✅ VALIDATED — Order matches 9-phase roadmap, all complete |

## Current Status

**Milestone**: v3.0 🚧 IN PROGRESS (TradingView 級升級, Phases 18-22)  
**Live URL**: https://btcethdivergence.bryanlab.cc  
**Branch**: feature/klinechart-migration  
**Started**: 2026-09-03  
**Phases**: 0/5 complete (0%)  

---

## v1.0 Achievements

✅ **Phases 1–9 shipped and verified**
- Worker foundation with D1 schema
- Binance kline backfill engine (cursor-paginated, rate-limit aware)
- Daily cron sync (2021-present historical data)
- Records CRUD (create, read, update, delete)
- Records filtering (by type, tag, time)
- Dual chart rendering (BTC/ETH time-synced)
- Chart navigation (log scale, date range, deep link)
- Leverage calculator (client-side, all features)
- Access hardening (Cloudflare Access + Service Token + Email OTP)

✅ **All requirements validated in production**
- Manual divergence recording working as designed
- Historical klines from Binance accessible and displayed
- Calculator provides accurate risk/reward visualization
- Authentication properly gates all endpoints

✅ **Performance targets met**
- Page load: <2s after login
- API queries: <100ms
- Chart sync: <50ms desync tolerance
- Daily cron: <10ms CPU

---

## v3.0 Goals (TradingView 級升級)

KLineChart 生態系統遷移，讓圖表達到 TradingView 級功能：

1. **KLineChart 核心遷移** — 從 lightweight-charts 換到 KLineChart v10（更快、更小）
2. **繪圖工具** — @klinecharts/extension（趨勢線、斐波那契、磁吸、更多形狀）
3. **技術指標** — 內建 MA/EMA/MACD/RSI/Bollinger（無需自行實作）
4. **@klinecharts/data-aggregator** — 延後至 v3.1（使用者為事後分析，REST API 足夠）

## v4 Candidates (Deferred)

- **Automated divergence detection** — Patterns vs manual observation
- **Additional trading pairs** — XRP, SOL, etc.
- **Real-time updates** — WebSocket sync + data-aggregator
- **Backtesting engine** — Historical simulation of rules
- **Dark mode** — Light mode only for v1-v3

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-01 — v1.0 complete, milestones archived*
