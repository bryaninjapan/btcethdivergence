# Phase 13: Frontend Data Isolation & UI Enhancement

## Goal
Refactor frontend state management from global variables to isolated, testable module instances. Prepare for TradingView-style UI improvements (K-line colors, indicator marks).

## Depends On
- Phase 12 (Service Layer) — Complete ✅
- All backend services stable

## Sub-Plans

### 13-01: Charts State Refactoring (2 days)
**Objective**: Convert `charts.js` global variables to `createChartState()` factory

**Tasks**:
1. **Create `public/js/chart-state.js` module** (B-1 修正: 改為 public/js/ 而非 src/public/)
   - TDD RED: 寫測試驗證模塊從 /js/ 可載入 ❌
   - TDD GREEN: 建立 chart-state.js ✅
   - TDD REFACTOR: 最小化 API 表面
   - `createChartState()` factory 返回狀態物件
   - Encapsulate: btcChart, ethChart, btcSeries, ethSeries, lastZoomLevel, syncToken
   - Methods: get(key), set(key, value), getState()

2. **移除全局變數洩露** (W-1 修正)
   - TDD RED: 寫測試 window.__charts === undefined ❌
   - TDD GREEN: 刪除 window.__charts 賦值 ✅
   - TDD REFACTOR: 驗證無污染
   - 掃描完整全局清單: sync, unsubBtc, unsubEth, activeController
   - 所有狀態由 createChartState() 返回值管理

3. **寫單位測試**
   - Test state isolation (multiple instances)
   - Test no global pollution
   - Test sync logic (re-entrancy guard)
   - Test zoom tracking
   - 目標: 100% chartState 覆蓋率

4. **E2E 測試 (Playwright)** (W-5 修正)
   - TDD RED: 寫 e2e/charts.spec.ts ❌
   - TDD GREEN: 實現 E2E 測試 ✅
   - 新增 e2e/charts.spec.ts:
     * render K-line chart ✅
     * time-sync across charts ✅
     * zoom-sync works ✅
     * log scale toggle works ✅

**Success Criteria**:
- ✅ Zero global variables in charts module
- ✅ window.__charts is undefined
- ✅ Unit tests: 100% coverage for chartState
- ✅ E2E tests pass via `npx playwright test`
- ✅ 327 existing tests still pass

---

### 13-02: Records State Refactoring (1.5 days)
**Objective**: Convert `records.js` global state to isolated instance

**Tasks**:
1. **Create `public/js/records-state.js` module** (B-1 修正: 改為 public/js/)
   - TDD RED: 寫測試驗證模塊從 /js/ 可載入 ❌
   - TDD GREEN: 建立 records-state.js ✅
   - TDD REFACTOR: 最小化 API 表面
   - `createRecordsManager()` factory
   - Encapsulate: recordsCache, editingId, deleteId, latestRequestToken
   - Methods: get(key), set(key, value), listRecords(), createRecord(), etc.

2. **寫單位測試**
   - Test CRUD operations in isolation
   - Test cache isolation (multiple instances)
   - Test request deduplication
   - 目標: 100% recordsManager 覆蓋率

3. **提取重複的選擇器幫手** (W-7 修正)
   - TDD RED: 寫測試確保無重複代碼 ❌
   - TDD GREEN: 建立 `public/js/datetime-helpers.js` ✅
   - TDD REFACTOR: 兩個模塊都導入而非本地定義
   - 提取: fillSelect, rebuildDays, setPickerFromEpoch, pickerEpoch
   - 刪除: charts.js 和 records.js 中的重複定義

4. **E2E 測試** (W-5 修正)
   - TDD RED: 寫 e2e/records.spec.ts ❌
   - TDD GREEN: 實現 E2E 測試 ✅
   - 新增 e2e/records.spec.ts:
     * create record ✅
     * edit record ✅
     * delete record ✅
     * filter by type/tag ✅

**Success Criteria**:
- ✅ Zero global variables in records module
- ✅ Unit tests: 100% coverage for recordsManager
- ✅ E2E tests pass via `npx playwright test`
- ✅ Zero duplication of picker helpers
- ✅ 327 existing tests still pass

---

### 13-03: Form Binding & Helper Extraction (1 day)
**Objective**: Extract shared form logic and consolidate datetime helpers

**Tasks**:
1. **使用共享的 datetime-helpers** (W-7 修正已在 13-02 完成)
   - charts.js 和 records.js 都導入 datetime-helpers.js
   - 驗證 buildUtcEpoch 只在 datetime.js 定義一次

2. **簡化 FormBinder 設計**
   - TDD RED: 寫測試驗證表單讀寫 ❌
   - TDD GREEN: 實現基礎表單方法 ✅
   - TDD REFACTOR: 避免過度設計
   - 方法: readForm(selector), populateForm(data)
   - 注意: 無 DOM 全局副作用，但允許注入的 DOM 元素操作

3. **集成驗證**
   - 確認 charts.js 表單使用 datetime-helpers
   - 確認 records.js 表單使用 datetime-helpers
   - 驗證選擇器邏輯相同

**Success Criteria**:
- ✅ FormBinder 純函數 (接收 DOM 元素，無全局引用)
- ✅ 零代碼重複 (所有重複提取到 datetime-helpers)
- ✅ 兩個表單行為相同

---

### 13-04: Code Review & Integration (0.5 days)
**Objective**: Final review and integration verification

**Tasks**:
1. **型別檢查** (W-6 修正)
   - TDD RED: 寫測試驗證 typecheck 命令執行 ❌
   - TDD GREEN: 執行型別檢查 ✅
   - 命令:
     * `npm run typecheck`
     * `npm run typecheck:scripts`
   - 修正任何 TypeScript 錯誤

2. **Run `/code-review` on refactored files**
   - Address CRITICAL + HIGH issues
   - Document architectural decisions

3. **覆蓋率驗證** (W-2 修正)
   - TDD RED: 寫測試驗證 85% 門檻 ❌
   - TDD GREEN: 強制執行 85% ✅
   - 命令: `npm run test:coverage -- --coverage.thresholds.lines=85`
   - 應包含: src/**/*.ts, public/js/**/*.js
   - 新模塊都在 public/js/ 以確保計入

4. **完整測試套件**
   - `npm test -- --run` (should be 350+ tests)
   - E2E: `npx playwright test` (e2e/charts.spec.ts, e2e/records.spec.ts)

5. **E2E 驗證 (完整用戶旅程)**
   - Load app → 記錄表
   - Navigate to /charts.html → 驗證渲染 + 同步
   - Navigate to /records.html → 驗證 CRUD
   - Navigate to /calculator.html → 驗證仍可用
   - 所有操作都通過 Playwright 自動化

**Success Criteria**:
- ✅ Type check passes (no errors)
- ✅ All unit tests pass (350+)
- ✅ Coverage ≥85% (強制門檻)
- ✅ E2E tests pass via Playwright
- ✅ No HIGH/CRITICAL code review issues
- ✅ Full app functionality verified

---

## Documentation Updates

### Files to Create/Update
1. **README.md** (Frontend Architecture section)
   - Explain new state isolation pattern
   - Show `createChartState()` example

2. **Phase 13 Artifacts**
   - PLAN.md (this file)
   - SUMMARY.md (completion report)
   - LEARNING.md (patterns learned, decisions made)
   - VERIFICATION.md (E2E test results)

3. **Code Comments**
   - Add JSDoc to each state factory
   - Document re-entrancy guard in chart-sync

## Timeline

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Mon-Tue | 13-01: Charts refactoring | Claude | —— |
| Wed | 13-02: Records refactoring | Claude | —— |
| Thu | 13-03: Form abstraction | Claude | —— |
| Fri | 13-04: Review + verification | Claude | —— |

**Total**: 4 days, 327+ tests maintained, ~0 lines removed (just restructured)

---

## Success Criteria (Overall Phase 13)

- ✅ Zero global state variables in frontend modules
- ✅ All state encapsulated in factory functions
- ✅ 350+ unit tests passing
- ✅ Code coverage ≥85%
- ✅ E2E verification: all user journeys work
- ✅ Code review: zero HIGH/CRITICAL issues
- ✅ Documentation: README updated, LEARNING.md written
- ✅ Ready for Phase 13b (UI improvements)

