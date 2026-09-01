# Phase 13 代碼審查學習記錄

**日期**: 2026-09-01  
**階段**: Phase 13 — Frontend Data Isolation & UI Enhancement

---

## 審查 #1：初始代碼審查（gsd-code-reviewer agent）

**時間**: 驗收標準檢查  
**結論**: BLOCK 判決（發現關鍵集成問題）

### 核心問題

**CRITICAL-1**: 新工廠模塊是死代碼
- 文件: `public/js/chart-state.js`, `public/js/records-state.js`, `public/js/datetime-helpers.js`
- 問題: 已創建但從未被生產應用導入使用
- 根本原因: `charts.js` 和 `records.js` 仍在聲明全局變數，未整合新模塊
- **解決**: gsd-code-fixer agent 完成了整合

**CRITICAL-2**: E2E 測試讀取不存在的全局變數
- 文件: `e2e/charts.spec.ts`
- 問題: 測試引用 `window.btcChart` 而實際應該用工廠模式
- 選擇器不匹配實際 DOM
- **解決**: gsd-code-fixer 添加了 `window.__test_charts` 測試鉤子

**HIGH-1**: 記憶體洩漏 - `records-state.js#getState()`
- 問題: 淺層凍結但通過引用洩露 `recordsCache` 數組
- 影響: 狀態快照可被意外修改
- **解決**: 改為深層複製

**HIGH-2**: E2E 測試數據污染
- 問題: 完全平行執行導致跨瀏覽器競爭，未添加清理邏輯
- **解決**: 添加 `.serial` 修飾符，row-scoped 選擇器，cleanup hooks

**HIGH-3**: `datetime-helpers.js` 零測試覆蓋
- 問題: 新提取的共享模塊完全未測試
- **解決**: 創建 `src/public/datetime-helpers.test.ts`（12 個測試）

### 吸取教訓

1. **集成測試比單位測試更重要** — 新模塊的代碼本身是對的，但未被使用
2. **必須驗證外部接口** — 不只是檢查模塊本身，要檢查它如何被調用
3. **工廠模式需要入口點** — 每個新工廠都需要一個明確的導入站點，否則變成死代碼

---

## 審查 #2：全量代碼審查（完成修復後）

**時間**: TDD + 修復完成後  
**結論**: WARNING（2 個 HIGH 需修復）

### HIGH 問題（生產影響）

**HIGH-1**: E2E 競態條件 — 防抖延遲不匹配
```
文件: e2e/records.spec.ts:193 (should filter records by tag)
問題: 等待 200ms，但生產代碼防抖是 250ms
症狀: 測試可能在 loadRecords() 觸發前就檢查，導致間歇性失敗
修復: 等待改為 350ms (delay + buffer)
```

**學習點**: 
- E2E 測試必須了解生產代碼的計時假設（防抖、動畫、API 延遲）
- `waitForTimeout()` 是最脆弱的等待方式；優先用 `expect().toBeVisible()` 自動重試

**HIGH-2**: TypeScript 編譯門檐壞掉
```
文件: src/public/chart-state.test.ts
       src/public/records-state.test.ts
       src/public/datetime-helpers.test.ts
問題: 新測試直接引用 document/window，但 tsconfig 沒設 DOM lib
症狀: 43 個 TS2584 「Cannot find name 'document'」錯誤
      npm run typecheck 失敗
修復: 用 globalThis 別名方式（參考 calculator-init.test.ts）
```

**學習點**:
- 新測試文件需要遵守現有專案的約定
- Vitest 提供 DOM（jsdom），但 TypeScript 類型檢查需要顯式聲明
- 參考現有模式（calculator-init.test.ts）而不是重新發明

### MEDIUM 問題（技術債）

**3️⃣ 未使用的導入**
```
文件: charts.js:5-11, records.js:4-10
問題: datetime.js 導入但未使用（已移到 datetime-helpers.js）
修復: 刪除舊導入
```

**4️⃣ console.log 遺留**
```
文件: e2e/records.spec.ts:68
問題: cleanup 路徑中有調試日誌
修復: 移除（或改用 test.info().annotations）
```

### 吸取教訓

1. **集成測試的計時很脆弱** — 永遠添加緩衝
2. **TypeScript 規則必須一致** — 即使是 JS 文件的測試也要遵守
3. **死導入積累** — 重構後要清理舊的導入
4. **自動化審查發現邏輯問題，手動審查發現集成問題**

---

## 修復覆蓋範圍

| 審查循環 | Critical | High | Medium | 修復率 |
|---------|----------|------|--------|--------|
| #1 (初始) | 2 | 3 | - | 100% (gsd-code-fixer) |
| #2 (全量) | 0 | 2 | 2 | 100% (手動修復) |
| **合計** | **2** | **5** | **2** | **100%** |

---

## 最終狀態

✅ **357/357 測試通過**  
✅ **8/8 E2E 測試通過**（競態條件修復後）  
✅ **86.12% 覆蓋率**（超過 85% 目標）  
✅ **npm run typecheck 通過**（DOM 錯誤修復後）  

---

## 關鍵建議（應用於後續 phases）

1. **集成點優先** — 新模塊/工廠必須在真實代碼中被使用，not just tested
2. **計時安全** — E2E 測試需要了解應用的所有計時假設
3. **約定一致性** — TypeScript、測試命名、導入風格必須跟隨現有模式
4. **雙層審查** — 自動審查發現邏輯問題，手動審查發現架構問題

---

**修復提交清單**:
- ✅ chart-state.js 整合（commit 9befa0a）
- ✅ records-state.js 整合（commit 9befa0a）
- ✅ 記憶體洩漏修復（commit 0fe8cd9）
- ✅ E2E 隔離修復（commit fcc3427）
- ✅ datetime-helpers 測試（commit 5e3a969）
- ✅ E2E 競態條件修復（手動）
- ✅ TypeScript 編譯修復（手動）
- ✅ 死導入清理（手動）
- ✅ console.log 移除（手動）
