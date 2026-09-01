# BTC/ETH Divergence Tracker

一個私人交易分析工具，用於記錄和分析 BTC/ETH 價格不同步（divergence）現象，並提供獨立的杠桿交易計算器。

**Status**: ✅ **v1.0 COMPLETE** — All 35 requirements met, production live

---

## 📋 Overview

### What It Does

- 📊 **記錄不同步事件** — 捕捉 BTC/ETH 價格背離時刻，標記類型、時段、備註、標籤
- 📈 **檢視歷史 K 線** — 從 Binance 加載 2021 年至今的 1h 蠟燭圖，雙圖同步
- 🔀 **分析不同步模式** — 按 K 線結構（4 種組合）+ Major Structure Break（MSB）分類
- 🧮 **獨立杠桿計算器** — 手動輸入價格計算盈虧比、止損金額、風險率

### Who Uses It

只有擁有者本人使用，透過 Cloudflare Access 密碼保護。

---

## 🎯 Key Features

### 記錄管理
- ✅ 新建、編輯、刪除不同步記錄
- ✅ 按類型和標籤篩選
- ✅ UTC 時間下拉選單（避免手打錯誤）
- ✅ MSB（Major Structure Break）yes/no 標記

### 圖表
- ✅ BTC/ETH 1h K 線並排顯示
- ✅ 時間同步滾動/縮放
- ✅ Log/Linear 縮放切換
- ✅ 自訂日期範圍導航
- ✅ 從記錄表直接跳轉對應時段

### 計算器
- ✅ Long/Short 方向切換
- ✅ 輸入：開倉價、止損、止盈、杠桿
- ✅ 輸出：倉位大小、止損金額、止盈金額、盈虧比、風險率、清算預警

---

## 🏗️ Architecture

**部署**: 單一 Cloudflare Worker + D1 Database + 靜態資源綁定
- 無 Pages 專案，無構建步驟
- 純靜態前端（HTML/CSS/JS），由 Google AI Studio 生成
- 圖表庫：Lightweight Charts v5（開源，CDN 加載）

**技術棧**:
- **後端**: Cloudflare Workers + TypeScript
- **數據庫**: Cloudflare D1（SQLite）
- **前端**: 純 HTML/CSS/JS（無 React/Vue）
- **認證**: Cloudflare Access（密碼保護）
- **數據源**: Binance public API（無 API key 需求）

---

## 📊 Milestones

| Phase | 名稱 | 狀態 |
|-------|------|------|
| 1-3 | 基礎設施 + 數據回填 | ✅ Complete |
| 4-8 | 功能開發（記錄、圖表、計算器） | ✅ Complete |
| 9-12 | 質量保證 + 技術改進 | ✅ Complete |
| 13 | 前端數據隔離 + UI 增強 | ✅ Complete |

**v1.0 完成日期**: 2026-09-02  
**總 Requirements**: 35/35 ✅  
**總測試**: 365/365 passing ✅  
**代碼覆蓋率**: 86.12% ✅

---

## 🚀 Deployment

### Production
- 部署在 Cloudflare Workers
- D1 数据库自動備份
- 每日 cron 自動同步最新 K 線

### Local Development
```bash
# 安裝依賴
npm install

# 本地運行（使用 wrangler dev）
npm run dev

# 運行測試
npm run test

# 類型檢查
npm run typecheck

# 構建 (如果有)
npm run build
```

---

## 📝 Design Principles

1. **簡潔優先** — MVP 只做用戶實際需要的功能
2. **手動記錄** — 使用者自主判斷和標記不同步事件
3. **時間精度** — 所有時間都是 UTC，下拉選單避免手打錯誤
4. **獨立計算** — 計算器純前端，不依賴後端
5. **可靠數據** — Binance 歷史數據完整，無缺口

---

## 🔒 Privacy & Security

- **認證**: Cloudflare Access（密碼保護）
- **數據**: 私人 D1 數據庫，只有擁有者訪問
- **代碼**: 公開 GitHub repo（無敏感信息）
- **日誌**: 生產日誌不包含個人數據

---

## 📚 Documentation

- **Project**: [.planning/PROJECT.md](.planning/PROJECT.md) — 需求和決策
- **Roadmap**: [.planning/ROADMAP.md](.planning/ROADMAP.md) — 各 phase 計劃
- **Requirements**: [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — 35 項要求
- **Phases**: [.planning/phases/](.planning/phases/) — 各 phase 細節

---

## ✨ Recent Improvements

- **Phase 13** (2026-09-02): 前端數據隔離工廠模式，消除全局變數
- **SQL Safety** (2026-09-02): 通用 QueryBuilder，動態 SQL 參數構建
- **Phase 12** (2026-09-01): 服務層模式，業務邏輯解耦
- **Phase 11** (2026-09-01): 結構化錯誤處理，統一響應信封
- **Phase 10** (2026-09-01): 時間戳抽象，集中轉換邏輯

---

## 👤 Created By

User: bryaninjapan  
Email: gn01968711@gmail.com  
Last Updated: 2026-09-02

---

**License**: Private (internal tool only)
