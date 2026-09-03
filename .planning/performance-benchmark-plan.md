# 性能基準測試計劃

> 用於驗證遷移後性能是否達到預期  
> 預計時間：8-12 小時（分散在遷移週期）

---

## 📊 測試目標

### 主要指標

| 指標 | lightweight-charts | KLineChart | 目標 | 臨界值 |
|-----|------------------|-----------|------|--------|
| **初始化時間** | 200ms | 100ms | < 150ms | > 300ms ❌ |
| **加載 1000 K 線** | 400ms | 150ms | < 250ms | > 500ms ❌ |
| **內存占用** | 12MB | 6MB | < 10MB | > 50MB ❌ |
| **平移幀率** | 60fps | 60fps | 60fps 穩定 | < 30fps ❌ |
| **縮放幀率** | 55fps (偶爾卡) | 60fps | 60fps 穩定 | < 30fps ❌ |
| **切換日期範圍** | 300ms | 100ms | < 200ms | > 500ms ❌ |
| **包大小** | 50k | 28k | < 40k | > 60k ❌ |

### 成功標準

```
綠色 ✅: 達到目標值
黃色 ⚠️: 在目標值 50% 以內 (e.g., 初始化 150-300ms)
紅色 ❌: 超過臨界值
```

---

## 🔧 環境準備

### 測試環境配置

```bash
# 確保測試環境一致性
Node.js: 18.x or 20.x
npm: latest
OS: macOS / Windows / Linux (選擇一個，保持一致)

清理環境:
└─ rm -rf node_modules package-lock.json
└─ npm cache clean --force
└─ npm install
```

### 測試設備

```
主測試設備（推薦）:
├─ 桌面: MacBook Pro 2023 (8-core, 16GB)
│        或 Windows PC (8-core, 16GB)
│
└─ 移動: iPhone 14 / 15
         或 Google Pixel 6+

用於對比:
├─ 低端桌面: 2-core, 4GB RAM
│           (測試最差情況)
│
└─ 舊款手機: iPhone 11
            (測試兼容性)
```

---

## 🧪 Test 1: 初始化時間（1-2 小時）

### 目的
驗證 KLineChart 初始化是否比 lightweight-charts 快 50% 以上。

### 測試方法

#### 方法 A: Chrome DevTools 性能工具（簡單）

```javascript
// 1. 打開 Chrome DevTools
// 2. 切換到「Performance」標籤
// 3. 點擊「Record」
// 4. 刷新頁面
// 5. 等待圖表完全加載
// 6. 停止錄製

// 查看性能指標:
// - First Contentful Paint (FCP)
// - Largest Contentful Paint (LCP)
// - Time to Interactive (TTI)
// - Total Blocking Time (TBT)
```

#### 方法 B: 代碼級測試（精確）

```javascript
// 在 charts.js 中添加性能測試代碼

const performanceMarkers = {
  start: performance.now(),
  domReady: null,
  chartInit: null,
  dataLoaded: null,
  end: null
}

// 記錄初始化開始
performanceMarkers.start = performance.now()

// 初始化圖表
const chart = init('container-id')

// 記錄初始化完成
performanceMarkers.chartInit = performance.now()

// 加載數據
chart.updateData(data)

// 記錄數據加載完成
performanceMarkers.dataLoaded = performance.now()

performanceMarkers.end = performance.now()

// 計算時間
const metrics = {
  initTime: performanceMarkers.chartInit - performanceMarkers.start,
  dataTime: performanceMarkers.dataLoaded - performanceMarkers.chartInit,
  totalTime: performanceMarkers.end - performanceMarkers.start
}

console.log('=== 性能指標 ===')
console.log(`初始化時間: ${metrics.initTime.toFixed(2)}ms`)
console.log(`數據加載時間: ${metrics.dataTime.toFixed(2)}ms`)
console.log(`總時間: ${metrics.totalTime.toFixed(2)}ms`)

// 記錄到服務器（可選）
beacon('/api/perf-log', {
  event: 'chart-init',
  metrics,
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent
})
```

### 預期結果

```
lighweight-charts:
├─ 初始化時間: 200ms
├─ 數據加載時間: 150ms
└─ 總時間: 350ms

KLineChart 目標:
├─ 初始化時間: < 150ms ✅
├─ 數據加載時間: < 100ms ✅
└─ 總時間: < 250ms ✅
```

### 測試場景

```
□ 場景 1: 基礎圖表（1 個圖表，100 根 K 線）
  預期: < 100ms
  
□ 場景 2: 雙圖表（2 個圖表，各 100 根 K 線）
  預期: < 200ms
  
□ 場景 3: 完整圖表（2 個圖表 + 5 個指標）
  預期: < 300ms
  
□ 場景 4: 大數據集（2 個圖表，各 5000 根 K 線）
  預期: < 1000ms
```

### 測試檢查清單

```
□ 開發環境
  ├─ 關閉所有浏览器擴展（可能影響性能）
  ├─ 關閉開發者工具（降低開銷）
  └─ 使用無痕模式（清潔環境）

□ 測試執行
  ├─ 每個場景測試 5 次，取平均值
  ├─ 測試前刷新頁面（清淨快取）
  ├─ 記錄所有結果到 CSV 文件
  └─ 生成對比圖表

□ 數據記錄
  ├─ 初始化時間
  ├─ 數據加載時間
  ├─ 總時間
  ├─ 最小/最大值
  └─ 標準差
```

### 失敗處理

```
如果初始化時間 > 300ms:
├─ Step 1: 檢查是否有性能分析工具運行
│          (DevTools, Sentry, etc.)
│
├─ Step 2: 檢查是否加載了太多數據
│          (減少初始 K 線數量)
│
├─ Step 3: 使用 Chrome Performance Profiler
│          └─ 找出最慢的函數
│
└─ Step 4: 優化（可能需要預留時間）
           ├─ 延遲加載組件
           ├─ 使用 Web Worker
           └─ 優化數據轉換
```

---

## 🧪 Test 2: 內存占用（1-2 小時）

### 目的
驗證 KLineChart 的內存占用顯著低於 lightweight-charts。

### 測試方法

#### Chrome DevTools Memory 工具

```javascript
// 1. 打開 Chrome DevTools
// 2. 切換到「Memory」標籤
// 3. 點擊「Heap snapshot」按鈕
// 4. 記錄初始內存 (baseline)

// 初始化圖表
const chart = init('container-id')

// 5. 再次點擊「Heap snapshot」
// 6. 比較兩個快照，計算差異

// 加載 K 線數據
chart.updateData(klines1000)

// 7. 第三次快照

// 加載更多數據
chart.updateData(klines5000)

// 8. 第四次快照

// 分析結果:
// ├─ 初始化內存增長
// ├─ 100 根 K 線內存
// ├─ 1000 根 K 線內存
// └─ 5000 根 K 線內存
```

### 預期結果

```
lightweight-charts:
├─ 初始化: +1MB
├─ +100 K 線: +1MB (總 2MB)
├─ +1000 K 線: +10MB (總 12MB)
└─ +5000 K 線: +45MB (總 57MB)

KLineChart 目標:
├─ 初始化: +0.5MB
├─ +100 K 線: +0.5MB (總 1MB)
├─ +1000 K 線: +5MB (總 6MB)
└─ +5000 K 線: +25MB (總 31MB)

線性增長應該是這樣:
┌─────────────────────────────┐
│ 內存 (MB)                    │
│   ↑                          │
│ 60│         LWC (偏高)      │
│   │        /                │
│ 40│       /                 │
│   │      /                  │
│ 20│  KLC (更低)            │
│   │  /                      │
│  0└─────────────────────────┴─→ K 線數量
│      0   1k   2k   3k   4k
└─────────────────────────────┘

圖表應該是線性的，沒有突跳 ⚠️
```

### 測試場景

```
□ 場景 1: 初始化（無數據）
  預期: < 2MB
  
□ 場景 2: 單圖表，100 根 K 線
  預期: < 3MB
  
□ 場景 3: 單圖表，1000 根 K 線
  預期: < 8MB
  
□ 場景 4: 雙圖表，各 1000 根 K 線
  預期: < 16MB
  
□ 場景 5: 雙圖表 + 5 個指標，各 1000 K 線
  預期: < 25MB
  
□ 場景 6: 壓力測試 (5000 K 線)
  預期: < 50MB
```

### 檢查清單

```
□ 內存測試執行
  ├─ 每個場景測試 3 次，取平均
  ├─ 測試前強制垃圾回收 (window.gc())
  ├─ 測試前清空快取
  └─ 記錄所有快照

□ 洩漏檢測
  ├─ 添加 1000 根 K 線
  ├─ 移除 1000 根 K 線
  ├─ 檢查內存是否回到原始水平
  └─ 如果不能完全回復 → 可能有洩漏

□ 數據記錄
  └─ 生成內存使用 vs K 線數量的圖表
     └─ 應該是線性增長
```

### 失敗處理

```
如果內存占用超過目標 2 倍:

Step 1: 確認是否是瀏覽器緩存
  └─ 清空快取後重新測試

Step 2: 檢查是否有內存洩漏
  └─ 添加/移除數據多次，觀察內存趨勢

Step 3: 分析堆快照
  ├─ 找出佔用最多內存的對象
  ├─ 查看是否有 detached DOM 節點
  └─ 檢查事件監聽器是否正確清理

Step 4: 如有必要
  ├─ 減少初始 K 線數量
  ├─ 實現虛擬滾動（大數據集）
  └─ 優化數據結構
```

---

## 🧪 Test 3: 幀率和流暢度（1-2 小時）

### 目的
驗證 KLineChart 在縮放和平移時保持 60fps。

### 測試方法

#### Chrome Performance Recording

```javascript
// 1. 打開 Chrome DevTools → Performance
// 2. 點擊 Record
// 3. 執行以下操作（計時 10 秒）

// 操作 A: 快速平移
for (let i = 0; i < 5; i++) {
  chart.scrollByPixels(100)  // 左右平移
  await sleep(100)
}

// 操作 B: 快速縮放
for (let i = 0; i < 5; i++) {
  chart.zoomAtCoordinate(400, 1.1)  // 放大
  await sleep(100)
}

// 操作 C: 切換時間範圍
chart.setVisibleRange({ startIdx: 0, endIdx: 100 })
await sleep(500)
chart.setVisibleRange({ startIdx: 100, endIdx: 200 })
await sleep(500)

// 4. 停止錄製
// 5. 分析幀率圖表
```

#### 代碼級測試

```javascript
// 測量 requestAnimationFrame 的幀率
let frameCount = 0
let lastTime = performance.now()
let fps = 0

function measureFPS() {
  frameCount++
  const currentTime = performance.now()
  if (currentTime - lastTime >= 1000) {
    fps = frameCount
    console.log(`FPS: ${fps}`)
    frameCount = 0
    lastTime = currentTime
    
    // 記錄到服務器
    beacon('/api/perf-log', {
      event: 'fps-measurement',
      fps,
      timestamp: new Date().toISOString()
    })
  }
  requestAnimationFrame(measureFPS)
}

// 開始測量
measureFPS()

// 執行用戶操作，觀察 FPS 輸出
```

### 預期結果

```
標準測試 (MacBook Pro 2023):
├─ 靜止狀態: 60fps ✅
├─ 平移 (每秒 5 次): 60fps ✅
├─ 縮放 (每秒 3 次): 58-60fps ✅
└─ 日期切換: 60fps ✅

低端設備 (iPhone 11):
├─ 平移: 45-50fps ⚠️ (可接受)
├─ 縮放: 40-45fps ⚠️ (可接受)
└─ 日期切換: 50-55fps ⚠️ (可接受)
```

### 測試場景

```
□ 場景 1: 靜止觀看
  預期: 60fps (當無動畫時)
  
□ 場景 2: 平移 (人工拖拽)
  └─ 左右平移 20 次，測量平均 FPS
  預期: 55-60fps ✅
  
□ 場景 3: 縮放 (鼠標滾輪)
  └─ 快速縮放 10 次，測量平均 FPS
  預期: 55-60fps ✅
  
□ 場景 4: 拖拽繪圖
  └─ 繪製 5 條趨勢線，測量 FPS
  預期: 50-60fps ✅
  
□ 場景 5: 移動端觸摸
  └─ 用手機測試單指拖拽和雙指 pinch
  預期: 45-60fps (根據設備)
```

### 檢查清單

```
□ 測試執行
  ├─ 在開發模式測試
  ├─ 在生產模式測試
  │  └─ npm run build && npm run dev:prod
  ├─ 測試最少 3 次
  └─ 記錄所有 FPS 值

□ 平台覆蓋
  ├─ □ macOS
  ├─ □ Windows
  ├─ □ Linux
  ├─ □ iOS
  └─ □ Android

□ 異常檢測
  ├─ 是否有 FPS 突跳 ⚠️
  ├─ 是否有卡頓感 ⚠️
  ├─ 是否有掉幀 ⚠️
  └─ 如有，記錄時刻和操作
```

### 失敗處理

```
如果 FPS < 30:
├─ Step 1: 關閉 DevTools (降低開銷)
├─ Step 2: 檢查是否有性能分析工具
├─ Step 3: 減少 K 線數量（可能是數據量問題）
└─ Step 4: 檢查是否有性能瓶頸
           └─ 使用 Profiler 找出最慢的函數

如果特定操作慢：
├─ 平移慢 → 優化事件監聽器
├─ 縮放慢 → 優化 Canvas 重繪
├─ 繪圖慢 → 優化路徑渲染
└─ 指標慢 → 優化計算邏輯
```

---

## 🧪 Test 4: 包大小（0.5-1 小時）

### 目的
驗證最終產物大小是否 < 40k gzip。

### 測試方法

```bash
# 構建生產版本
npm run build

# 檢查文件大小
ls -lh dist/

# 查看 gzip 大小
npm install -g gzip-size-cli
gzip-size dist/index.esm.js
gzip-size dist/index.cjs
gzip-size dist/umd/klinecharts.min.js

# 使用 Rollup 插件報告大小
# package.json 中應該有 rollup-plugin-filesize
# 構建時會自動顯示大小
```

### 預期結果

```
File sizes and gzip sizes:

dist/index.esm.js
  │ gzip: 28 kB
  └─ ✅ < 40kB

dist/index.cjs
  │ gzip: 28 kB
  └─ ✅ < 40kB

dist/umd/klinecharts.min.js
  │ gzip: 28 kB
  └─ ✅ < 40kB

vs lightweight-charts:
├─ UMD gzip: ~50kB
└─ KLineChart: ~28kB (44% 減少) ✅
```

### 檢查清單

```
□ 構建檢查
  ├─ npm run build 成功（0 錯誤）
  ├─ 所有文件都生成
  └─ 沒有警告

□ 包大小分析
  ├─ 記錄每個文件的大小
  ├─ 記錄 gzip 大小
  ├─ 比較 lightweight-charts
  └─ 如果超出預期，分析原因

□ 依賴檢查
  ├─ npm ls (確認沒有隱藏依賴)
  ├─ grep "dependencies" package.json
  └─ 應該是空的 (除了 devDependencies)
```

---

## 🧪 Test 5: 相容性測試（1-2 小時）

### 目的
驗證 KLineChart 在所有目標瀏覽器上正常工作。

### 測試方法

```javascript
// 每個瀏覽器上運行:

□ Chrome 最新版 (v120+)
  ├─ npm run dev
  ├─ 打開 http://localhost:5173/charts.html
  ├─ 檢查控制台無紅色錯誤
  ├─ 測試所有功能
  └─ 記錄結果: ✅ 通過

□ Firefox 最新版 (v121+)
  ├─ (同上)
  └─ 記錄結果: ✅ / ⚠️ / ❌

□ Safari 最新版 (v17+)
  ├─ (同上)
  └─ 記錄結果: ✅ / ⚠️ / ❌

□ Edge 最新版 (v121+)
  ├─ (同上)
  └─ 記錄結果: ✅ / ⚠️ / ❌

□ iOS Safari (最新 iOS 版本)
  ├─ 用真實 iPhone 或模擬器
  ├─ 測試縮放、平移、觸摸
  └─ 記錄結果: ✅ / ⚠️ / ❌

□ Android Chrome (最新)
  ├─ 用真實 Android 或模擬器
  ├─ 測試相同功能
  └─ 記錄結果: ✅ / ⚠️ / ❌

□ IE 11 (如果需要支持)
  ├─ 測試基本功能
  ├─ 預期可能有性能問題
  └─ 記錄結果: ⚠️ / ❌
```

### 預期結果

```
綠色 ✅: 完全支持，所有功能正常
黃色 ⚠️: 基本支持，但有輕微問題或性能下降
紅色 ❌: 不支持或有嚴重問題

預期:
├─ Chrome: ✅
├─ Firefox: ✅
├─ Safari: ✅
├─ Edge: ✅
├─ iOS Safari: ✅
├─ Android Chrome: ✅
└─ IE 11: ⚠️ (或跳過)
```

### 檢查清單

```
□ 功能檢查（每個瀏覽器）
  ├─ □ 圖表載入
  ├─ □ 數據顯示
  ├─ □ 平移功能
  ├─ □ 縮放功能
  ├─ □ 對數縮放
  ├─ □ 繪圖工具
  ├─ □ 指標顯示
  └─ □ 沒有 console 錯誤

□ 性能檢查（桌面）
  ├─ □ 初始化 < 1s
  ├─ □ 操作流暢 (60fps)
  └─ □ 無明顯卡頓

□ 性能檢查（移動）
  ├─ □ 初始化 < 2s
  ├─ □ 操作流暢 (45+ fps)
  └─ □ 觸摸響應及時
```

---

## 📈 測試報告模板

### 最終性能報告

```markdown
# KLineChart 遷移性能報告

測試日期: 2026-09-10
測試者: [名字]
環境: MacBook Pro 2023, Chrome 120

## 初始化時間
- lightweight-charts: 200ms
- KLineChart: 95ms
- 改善: 52.5% ✅

## 內存占用 (1000 K 線)
- lightweight-charts: 12MB
- KLineChart: 6MB
- 改善: 50% ✅

## 幀率
- 平移: 60fps ✅
- 縮放: 60fps ✅
- 繪圖: 58fps ✅

## 包大小
- lightweight-charts (gzip): 50kB
- KLineChart (gzip): 28kB
- 改善: 44% ✅

## 相容性
- Chrome ✅
- Firefox ✅
- Safari ✅
- iOS Safari ✅
- Android Chrome ✅

## 總體評分
- 性能: ⭐⭐⭐⭐⭐
- 相容性: ⭐⭐⭐⭐⭐
- 穩定性: ⭐⭐⭐⭐⭐

## 結論
KLineChart 在所有指標上都超過了 lightweight-charts。
已達到上線標準。✅
```

---

## 🔍 實時監控

### 部署後持續監控

```javascript
// 在生產環境添加性能監控代碼

// 1. 收集真實用戶性能數據
window.addEventListener('load', () => {
  const perfData = performance.getEntriesByType('navigation')[0]
  
  beacon('/api/perf-log', {
    event: 'page-load',
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    lcp: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
    tti: perfData.domInteractive - perfData.fetchStart,
    memory: performance.memory?.usedJSHeapSize,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  })
})

// 2. 監控長任務（> 50ms）
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      beacon('/api/perf-log', {
        event: 'long-task',
        duration: entry.duration,
        name: entry.name,
        timestamp: new Date().toISOString()
      })
    }
  }
})

observer.observe({ entryTypes: ['longtask'] })

// 3. 監控錯誤
window.addEventListener('error', (event) => {
  beacon('/api/error-log', {
    message: event.message,
    stack: event.error?.stack,
    timestamp: new Date().toISOString()
  })
})
```

### 警告閾值

```
如果任何指標超過這些值，發出警報：

1. 初始化時間 > 2s
   └─ 可能有問題，調查

2. 頁面崩潰率 > 1%
   └─ 立即檢查 console 錯誤

3. 平均 FPS < 30
   └─ 檢查是否是 CPU 密集操作

4. 平均內存 > 100MB
   └─ 檢查是否有內存洩漏

5. 錯誤率 > 0.5%
   └─ 立即调查並修復
```

---

## ✅ 最終檢查清單

在上線前，確認所有測試都通過：

```
□ Test 1: 初始化時間
  ├─ □ < 150ms (目標)
  ├─ □ 平均值記錄
  └─ □ 沒有異常值

□ Test 2: 內存占用
  ├─ □ < 10MB (1000 K 線)
  ├─ □ 線性增長（沒有洩漏）
  └─ □ 內存回復正常

□ Test 3: 幀率
  ├─ □ 平移: 60fps
  ├─ □ 縮放: 60fps
  └─ □ 沒有明顯卡頓

□ Test 4: 包大小
  ├─ □ gzip < 40kB
  ├─ □ 沒有隱藏依賴
  └─ □ 構建成功

□ Test 5: 相容性
  ├─ □ Chrome ✅
  ├─ □ Firefox ✅
  ├─ □ Safari ✅
  ├─ □ iOS Safari ✅
  ├─ □ Android Chrome ✅
  └─ □ 沒有 console 錯誤

□ 文檔
  ├─ □ 性能報告完成
  ├─ □ 基準值記錄
  └─ □ 監控代碼部署

✅ 所有測試通過，準備上線
```

---

## 📊 測試時間表

| 任務 | Day | 時間 | 狀態 |
|-----|-----|------|------|
| Test 1: 初始化時間 | Week 2 Day 7 | 1-2h | ⏳ |
| Test 2: 內存占用 | Week 3 Day 1 | 1-2h | ⏳ |
| Test 3: 幀率 | Week 3 Day 2 | 1-2h | ⏳ |
| Test 4: 包大小 | Week 3 Day 3 | 0.5-1h | ⏳ |
| Test 5: 相容性 | Week 3 Day 4-5 | 1-2h | ⏳ |
| 報告和分析 | Week 3 Day 6-7 | 1-2h | ⏳ |

**總計: 8-12 小時**

分散在整個遷移期間，不會成為瓶頸。
