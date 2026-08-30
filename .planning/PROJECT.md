# BTC/ETH Divergence Tracker

## What This Is

一個私人交易分析工具，用於記錄和分析 BTC/ETH 價格不同步（divergence）現象，並提供獨立的杠桿交易計算器。只有擁有者本人使用，透過 Cloudflare Access 密碼保護。

## Core Value

讓使用者能快速記錄、回顧和分析 BTC 與 ETH 之間的價格背離事件，累積可靠的歷史觀察數據。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 使用者可以建立不同步記錄（含開始/結束時間、類型、備註、標籤）
- [ ] 使用者可以編輯和刪除已有的不同步記錄
- [ ] 使用者可以查看所有歷史不同步記錄的表格
- [ ] 使用者可以按類型和標籤篩選記錄
- [ ] 使用者可以查看 BTC 和 ETH 的 1 小時 K 線圖（上下並排）
- [ ] 兩張 K 線圖時間同步（滾動/縮放連動）
- [ ] K 線圖支持 log 縮放
- [ ] 使用者可以從記錄表點擊「查看K線」自動加載對應時段圖表
- [ ] 使用者可以用獨立的杠桿計算器計算盈虧比（輸入開倉/止損/止盈價格）
- [ ] K 線歷史數據從 Binance API 抓取並緩存在 D1
- [ ] 每天自動 cron 更新最新 K 線數據
- [ ] 時間輸入使用下拉選單（年/月/日/時）而非手打
- [ ] 網站透過 Cloudflare Access 進行密碼保護

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
- 不同步類型有三種：時間差（time_lag）、結構背離（structural）、完全反向（opposite）
- 歷史數據需要從 2021 年 1 月開始回溯，手動回看歷史 K 線逐條標記
- 擁有者已有 Cloudflare 使用經驗（soapwavehealing 專案）
- 前端 UI 計劃用 Google AI Studio 生成，再手動整合
- 擁有者對後端和架構不熟悉，需要 Claude 協助

## Constraints

- **Tech stack**: Cloudflare Workers (單一部署，含 Static Assets binding) + D1 — 不使用 Pages，單一 Worker 專案服務靜態資源和 API（架構已鎖定於 Phase 1 ROADMAP INFRA-01）
- **Data source**: Binance public API (no API key required for klines)
- **Frontend**: 純靜態 HTML/CSS/JS — 由 Google AI Studio 生成，無構建步驟
- **Chart library**: Lightweight Charts — 開源，無需申請 API key
- **Privacy**: Public repo + Cloudflare Access 密碼保護
- **Budget**: 免費/低成本方案（Cloudflare free tier）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 只存 1h K 線，不存 4h | 使用者決定不需要看 4h 圖表 | — Pending |
| Cloudflare D1 而非 Supabase | 數據量小（~110K 行），使用者已有 CF 經驗 | — Pending |
| 計算器獨立，手動輸入 | 圖表互動開發量大，手動輸入更實際 | — Pending |
| 上下並排 K 線圖，非疊圖 | 使用者偏好清晰的分開顯示 | — Pending |
| 時間輸入用下拉選單 | 使用者希望快速選擇，避免手打格式錯誤 | — Pending |
| 前端由 Google AI Studio 生成 | 使用者熟悉該工具，加速 UI 開發 | — Pending |
| Build order: 記錄表 → K線圖 → 計算器 | 使用者定義的優先級 | — Pending |

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
*Last updated: 2026-08-30 after initialization*
