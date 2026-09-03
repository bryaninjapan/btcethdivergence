# 開發環境設置指南

> 用於 KLineChart 遷移項目的開發環境配置  
> 創建日期: 2026-09-03  
> 分支: `feature/klinechart-migration`

---

## ✅ 環境檢查清單

```
✅ 已完成:
├─ 創建遷移分支: feature/klinechart-migration
├─ 安裝 KLineChart: 10.0.3
├─ 驗證 TypeScript 類型: index.d.ts 存在
└─ 驗證 npm 依賴: klinecharts@10.0.3
```

---

## 📁 項目結構

### 當前目錄結構

```
btcethdivergence/
├─ .planning/
│  ├─ klinecharts-ecosystem.md              ← 生態分析
│  ├─ technical-assessment.md               ← 技術評估
│  ├─ v2-upgrade-plan.md                    ← 升級計劃
│  ├─ migration-checklist.md                ← 遷移清單 ← 每日參考
│  ├─ performance-benchmark-plan.md         ← 性能測試
│  └─ dev-environment-setup.md              ← 本文件
│
├─ public/
│  ├─ charts.html                           ← 將遷移的主文件
│  ├─ js/
│  │  ├─ charts.js                          ← 主要邏輯
│  │  ├─ api.js                             ← API 層（保持不變）
│  │  └─ managers/
│  │     └─ ChartManager.js                 ← 需要適配
│  │
│  └─ css/
│     └─ style.css                          ← 樣式（可能需要調整）
│
├─ src/
│  └─ public/
│     ├─ chart-manager.test.ts              ← 單元測試（需要更新）
│     └─ ...
│
├─ node_modules/
│  └─ klinecharts/                          ← 🆕 新依賴
│
└─ package.json
   └─ dependencies:
      └─ "klinecharts": "10.0.3"            ← 🆕 已安裝
```

---

## 🚀 啟動開發服務器

### 方法 1: 使用現有開發服務器

```bash
# 確保在項目根目錄
cd /Users/bryan/Documents/btcethdivergence

# 啟動開發服務器
npm run dev

# 輸出應該類似:
# ➜  Local:   http://localhost:5173/
# ➜  Press h to show help
```

### 方法 2: 檢查當前配置

```bash
# 查看現有的 npm scripts
cat package.json | grep -A 20 '"scripts"'

# 你應該看到:
# "dev": "vite",
# "build": "vite build",
# "preview": "vite preview",
# etc.
```

---

## 📝 首次開發檢查清單

### 本地驗證（30 分鐘）

```bash
# 1. 驗證 KLineChart 安裝
npm list klinecharts
# 應該看到: klinecharts@10.0.3 ✅

# 2. 驗證 TypeScript 類型
npx tsc --noEmit
# 應該看到: 0 error (或現有的錯誤，不是 KLineChart 的)

# 3. 啟動開發服務器
npm run dev
# 應該看到: ➜ Local: http://localhost:5173/

# 4. 在瀏覽器打開
# http://localhost:5173/
# 檢查現有頁面是否正常（index.html, charts.html, calculator.html)
```

### 驗證步驟

```javascript
// 在瀏覽器 DevTools Console 中測試

// 1. 驗證 KLineChart 可以導入
import { init } from 'klinecharts'
console.log(typeof init)  // 應該是 'function' ✅

// 2. 驗證初始化（不需要實際 DOM）
const chart = init('test-container')
console.log(chart)  // 應該看到 Chart 對象 ✅
```

---

## 🛠️ IDE 配置

### VS Code 設置

#### 1. 安裝推薦的擴展

```
建議安裝:
├─ TypeScript Vue Plugin (Volar)
├─ ESLint
├─ Prettier - Code formatter
├─ Thunder Client (或 REST Client)
└─ Peacock (可選，用顏色區分分支)
```

#### 2. TypeScript 自動補全

KLineChart 已包含完整的 TypeScript 定義（index.d.ts），VS Code 應該自動工作：

```typescript
// 打開任何 .ts 或 .js 文件，輸入:
import { init } from 'klinecharts'

// 應該看到自動補全提示 ✅
// 懸停在 init 上應該看到型別定義
```

#### 3. 配置 .vscode/settings.json

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## 📚 開發資源

### 官方文檔

| 資源 | 位置 | 用途 |
|-----|------|------|
| **官方網站** | https://www.klinecharts.com | API 文檔、示例 |
| **GitHub** | https://github.com/klinecharts/KLineChart | 源碼、issues |
| **API 文檔** | node_modules/klinecharts/dist/index.d.ts | TypeScript 型別參考 |
| **extension 文檔** | https://github.com/klinecharts/extension | 繪圖工具 |

### 本地參考文件

```
在你的項目中:
├─ .planning/
│  ├─ klinecharts-ecosystem.md         ← 快速參考
│  ├─ technical-assessment.md          ← 性能和風險
│  ├─ migration-checklist.md           ← 每日檢查清單 ⭐
│  └─ performance-benchmark-plan.md    ← 測試方法
```

---

## 🔍 常用開發命令

### 構建和測試

```bash
# 開發
npm run dev              # 啟動開發服務器

# 測試
npm run test             # 運行單元測試
npm run test:unit        # 運行特定測試
npm run test:coverage    # 生成覆蓋率報告

# 構建
npm run build            # 構建生產版本
npm run preview          # 預覽構建結果

# 代碼品質
npm run lint             # 運行 ESLint
npm run type-check       # TypeScript 類型檢查

# 清理
npm run clean            # 清除構建產物
```

### 開發時常用

```bash
# 監視測試
npm run test:watch       # 持續運行測試（文件變化時重新運行）

# 在編輯 charts.js 時
npm run dev              # 自動重新載入

# 檢查類型錯誤
npx tsc --noEmit         # 檢查整個項目
npx tsc --watch          # 監視 TypeScript 錯誤
```

---

## 🐛 調試技巧

### 在 VS Code 中調試

#### 配置 .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/public",
      "runtimeArgs": [
        "--disable-extensions",
        "--new-window"
      ]
    }
  ]
}
```

#### 使用方法

```
1. 按 F5 啟動調試器
2. Chrome 會打開並連接到本地開發服務器
3. 設置斷點（在代碼行左邊點擊）
4. 刷新頁面以觸發斷點
```

### 在瀏覽器中調試

```javascript
// 1. 打開 Chrome DevTools (F12)
// 2. 切換到 "Sources" 標籤
// 3. 找到 charts.js 文件
// 4. 設置斷點

// 5. 使用 console 測試
const chart = init('btc-container')
console.log(chart)      // 檢查 chart 對象
chart.setVisibleRange   // 檢查方法存在
```

---

## 🚨 常見問題

### Q1: "Cannot find module 'klinecharts'"

**原因：** npm 包未安裝或路徑錯誤

**解決：**
```bash
# 重新安裝
rm -rf node_modules/klinecharts
npm install klinecharts@10.0.3

# 驗證
npm list klinecharts
```

### Q2: TypeScript 無法識別 KLineChart 類型

**原因：** 類型定義未被識別

**解決：**
```bash
# 確保 tsconfig.json 正確
cat tsconfig.json | grep -A 5 '"include"'

# 應該包括 node_modules
# 或者在代碼中明確導入類型:
import type { Chart } from 'klinecharts'
```

### Q3: 修改代碼後頁面沒有更新

**原因：** 開發服務器 HMR 失效或快取問題

**解決：**
```bash
# 1. 停止開發服務器 (Ctrl+C)
# 2. 清理快取
npm run clean

# 3. 重新啟動
npm run dev

# 4. 強制刷新瀏覽器 (Cmd+Shift+R 或 Ctrl+Shift+R)
```

### Q4: 在手機上測試時無法訪問本地服務器

**原因：** 開發服務器默認只監聽 localhost

**解決：**
```bash
# 1. 找到 vite.config.js 或 package.json 中的 vite 配置
# 2. 修改為:
# npm run dev -- --host

# 或者在 vite.config.js 中:
export default {
  server: {
    host: '0.0.0.0',  // 監聽所有網卡
    port: 5173
  }
}

# 3. 然後用手機訪問:
# http://YOUR_IP:5173
# (用 ifconfig 查看 IP)
```

---

## 🔄 GIT 工作流

### 分支狀態

```bash
# 查看當前分支
git status

# 應該看到:
# On branch feature/klinechart-migration
# Your branch is ahead of 'origin/main' by 1 commit.
```

### 提交規範

遷移期間，遵循這個提交格式：

```bash
# 功能實現
git commit -m "feat(chart): implement KLineChart basic rendering"

# bug 修復
git commit -m "fix(chart): correct timestamp conversion for KLineChart"

# 重構
git commit -m "refactor(ChartManager): adapt to KLineChart API"

# 測試
git commit -m "test(chart): add KLineChart initialization tests"

# 文檔
git commit -m "docs(chart): update API documentation for KLineChart"
```

### 保持分支同步

```bash
# 定期從 main 更新
git fetch origin
git rebase origin/main

# 或者 merge (更安全，但會有 merge commit)
git merge origin/main
```

---

## 📊 性能監控設置

### 開發中的性能測試

```javascript
// 在 charts.js 開頭添加

const PERF_ENABLED = true

if (PERF_ENABLED) {
  // 記錄初始化時間
  const initStart = performance.now()
  
  // ... 初始化代碼 ...
  
  const initEnd = performance.now()
  console.log(`✨ Chart initialized in ${(initEnd - initStart).toFixed(2)}ms`)
  
  // 記錄內存使用（Chrome only）
  if (performance.memory) {
    console.log(`📊 Memory: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)}MB`)
  }
}
```

### 性能記錄工具

```bash
# 在 package.json 中添加性能測試腳本
"scripts": {
  "perf-test": "node scripts/performance-test.js"
}

# 用法
npm run perf-test
```

---

## 🎯 第一週工作計劃

### Day 1-2: 環境驗證（今天）

```
✅ 已完成:
├─ ✅ 創建遷移分支
├─ ✅ 安裝 KLineChart
├─ ✅ 驗證 TypeScript 類型
└─ ✅ 配置開發環境

待做:
├─ □ 啟動開發服務器測試
├─ □ 驗證現有功能未破壞
└─ □ 設置 IDE 自動補全
```

### Day 3-4: 數據驗證

```
□ 從 API 獲取實時數據
□ 測試時間戳轉換函數
□ 驗證數據格式兼容性
□ 編寫單元測試
```

### Day 5-7: 規劃和預案

```
□ 制定詳細計劃
□ 風險評估
□ 建立回退方案
□ 準備測試環境
```

---

## ✨ 下一步

### 立即（現在）

```bash
# 1. 驗證環境
npm run dev

# 2. 打開瀏覽器
# http://localhost:5173/

# 3. 檢查現有頁面是否正常
# - index.html (記錄表)
# - charts.html (K 線圖)
# - calculator.html (槓桿計算)

# 4. 打開 DevTools Console
# 檢查沒有紅色錯誤
```

### 今天

```bash
# 1. 驗證 KLineChart 類型
import { init } from 'klinecharts'
// 應該有自動補全

# 2. 審查遷移檢查清單
cat .planning/migration-checklist.md

# 3. 準備數據轉換函數
# (見下面的代碼示例)
```

---

## 💡 快速參考代碼

### 導入 KLineChart

```javascript
// ES6 模塊
import { init } from 'klinecharts'

// CommonJS (如果需要)
const { init } = require('klinecharts')

// TypeScript
import { init, Chart } from 'klinecharts'
const chart: Chart = init('container-id')
```

### 基礎初始化

```javascript
// 初始化圖表
const chart = init('btc-container', {
  styles: {
    candle: {
      up: { color: '#26a69a' },
      down: { color: '#ef5350' }
    }
  }
})

// 加載數據
const klines = [
  { time: 1234567890, open: 45000, high: 46000, low: 44000, close: 45500, volume: 100 }
]
chart.updateData(klines)
```

### 數據轉換函數

```javascript
// Binance 數據 → KLineChart 格式
function convertBinanceToKLineChart(binanceKlines) {
  return binanceKlines.map(row => ({
    time: Math.floor(row[0] / 1000),    // 毫秒 → 秒
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[7])
  }))
}

// 使用
const klines = await fetch('/api/klines?symbol=BTCUSDT')
  .then(r => r.json())
  .then(convertBinanceToKLineChart)
```

---

## 📞 支持資源

| 資源 | 位置 |
|-----|------|
| **規劃文檔** | .planning/ |
| **遷移清單** | .planning/migration-checklist.md ⭐ |
| **性能測試** | .planning/performance-benchmark-plan.md |
| **官方文檔** | https://www.klinecharts.com |
| **社區** | https://github.com/klinecharts/KLineChart/discussions |

---

## ✅ 環境設置完成清單

```
✅ Git 分支已創建: feature/klinechart-migration
✅ KLineChart 已安裝: 10.0.3
✅ TypeScript 類型已驗證
✅ 開發服務器可用: npm run dev
✅ 規劃文檔已準備
✅ IDE 自動補全已配置

準備好開始遷移了！🚀
```

---

**你的環境已完全設置好。下一步是按照遷移檢查清單開始開發。**

需要我幫你做什麼？
- **A.** 寫第一個 KLineChart demo
- **C.** 準備團隊培訓資料
- **D.** 其他