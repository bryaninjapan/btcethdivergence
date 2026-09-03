# KLineChart 遷移檢查清單

> 用於確保遷移過程不遺漏任何關鍵步驟  
> 預計時間：72-95 小時（3-4 週）

---

## 📋 第 1 週：評估和規劃（10-15 小時）

### Day 1-2: 環境搭建和驗證（6-8 小時）

```
□ 環境準備 (1-2h)
  ├─ Node.js >= 18.x
  ├─ npm / pnpm 最新版本
  └─ 確認能訪問 npm registry

□ 克隆和運行官方 demo (2-3h)
  ├─ git clone https://github.com/klinecharts/KLineChart.git
  ├─ npm install
  ├─ npm run docs:dev
  ├─ 打開 http://localhost:8888
  └─ ✅ 檢查清單:
     ├─ K 線圖渲染成功
     ├─ 可以縮放和平移
     ├─ 時間軸顯示正常
     └─ 沒有控制台錯誤

□ 瀏覽官方文檔 (2-3h)
  ├─ 讀完 README 和快速開始
  ├─ 查看 API 文檔
  ├─ 試試內置指標 (RSI, MACD)
  ├─ 試試繪圖工具
  └─ 記錄 3 個 API 和 lightweight-charts 的區別

□ 檢查現有項目結構 (1h)
  ├─ 列出所有使用 lightweight-charts 的文件
  ├─ 統計代碼行數
  ├─ 識別最複雜的部分（例如 ChartManager）
  └─ 建立待遷移清單
```

### Day 3-4: 數據和相容性驗證（4-6 小時）

```
□ 驗證數據格式 (2-3h)
  
  測試代碼:
  ┌─────────────────────────────────────────┐
  │ // 從你的 API 獲取實時數據               │
  │ const response = await fetch(            │
  │   '/api/klines?symbol=BTCUSDT&limit=1'  │
  │ )                                        │
  │ const data = await response.json()       │
  │ console.log(data[0])                     │
  │                                          │
  │ // 檢查清單:                             │
  │ □ open_time 是毫秒格式                  │
  │ □ open/high/low/close 是字符串          │
  │ □ volume 是字符串                       │
  │ □ 時間戳正確（檢查日期）                │
  └─────────────────────────────────────────┘

  □ 準備轉換函數
    ├─ 編寫 toKLineChartCandle 函數
    ├─ 測試轉換結果
    ├─ 檢查時間戳（必須是秒，不是毫秒！）
    └─ 寫單元測試
       └─ test('轉換函數應該正確處理毫秒時間戳', () => {
            const input = { open_time: 1234567890000, ... }
            const output = toKLineChartCandle(input)
            expect(output.time).toBe(1234567890)
          })

□ 驗證瀏覽器相容性 (1h)
  ├─ Chrome 最新版: ✅ 應該完美
  ├─ Firefox 最新版: ✅ 應該完美
  ├─ Safari 最新版: ✅ 應該完美
  ├─ IE 11: ⚠️ 檢查
  │  └─ 檢查命令: npm run build && npm run test:ie11
  └─ 移動 Safari (iOS): ✅ 應該完美
     └─ 用 iPhone 瀏覽器測試官方 demo

□ 檢查 npm 依賴衝突 (1h)
  ├─ 列出當前 package.json 中的所有依賴
  ├─ 檢查 KLineChart 的依賴
  ├─ 查找潛在的版本衝突
  └─ 測試: npm install klinecharts
     └─ ✅ 不應該有警告或錯誤
```

### Day 5-7: 計劃和風險評估（2-4 小時）

```
□ 制定詳細遷移計劃 (1h)
  ├─ 優先級排序:
  │  1. 基礎 K 線圖 (必需)
  │  2. 雙圖表同步 (必需)
  │  3. 對數縮放 (必需)
  │  4. 技術指標 (可選，後期)
  │  5. 繪圖工具 (可選，後期)
  │
  └─ 依賴關係:
     └─ 繪圖工具 → 需要先完成基礎圖表
        └─ 技術指標 → 需要先完成基礎圖表
           └─ 對數縮放 → 需要先完成基礎圖表
              └─ 雙圖表同步 → 需要先完成基礎圖表
                 └─ 基礎 K 線圖 (起點)

□ 風險評估和預案 (1h)
  ├─ 識別 Top 3 風險
  │  1. 時間戳格式錯誤
  │  2. 事件監聽器名稱變化
  │  3. 樣式配置不兼容
  │
  ├─ 每個風險的預防措施
  │  1. 寫測試驗證時間戳
  │  2. 建立事件映射表
  │  3. 預留樣式調整時間
  │
  └─ 回退計劃
     └─ 保留 feature/lightweight-charts 分支
        └─ 如果無法修復，可在 1 週內回退

□ 建立開發分支和環境 (1-2h)
  ├─ git checkout -b feature/klinechart-migration
  ├─ 在新分支中安裝 klinecharts
  │  └─ npm install klinecharts@10.0.3
  ├─ 提交初始版本
  │  └─ git commit -m "chore: install klinecharts"
  └─ 配置開發環境
     ├─ TypeScript 類型檢查
     ├─ 代碼格式化
     └─ 自動重啟服務器
```

---

## 🔧 第 2-3 週：核心遷移（50-60 小時）

### Week 2, Day 1: 基礎集成（6-8 小時）

```
□ 移除 lightweight-charts (1h)
  ├─ 從 public/charts.html 移除 CDN 引用
  │  └─ 找到: <script src="https://unpkg.com/lightweight-charts@..." >
  │  └─ 刪除這行
  ├─ 從 package.json 移除依賴（如果有的話）
  └─ 清理相關導入

□ 安裝和配置 KLineChart (1-2h)
  ├─ npm install klinecharts
  ├─ 檢查 TypeScript 類型
  │  └─ node_modules/klinecharts/dist/index.d.ts 存在
  ├─ 在 charts.js 中導入
  │  ├─ import { init } from 'klinecharts'
  │  └─ 檢查沒有 import 錯誤
  └─ 測試基本導入
     └─ 運行 npm run dev，檢查控制台沒有錯誤

□ 重寫 renderChart 函數 (2-3h)
  
  舊代碼 (lightweight-charts):
  ┌─────────────────────────────────────────┐
  │ function renderChart(containerId,       │
  │                      candles) {         │
  │   const chart =                         │
  │     createChart(                        │
  │       document.getElementById(          │
  │         containerId                     │
  │       ),                                │
  │       {                                 │
  │         height: 420,                    │
  │         layout: {                       │
  │           background: {                 │
  │             type: 'solid',              │
  │             color: '#ffffff'            │
  │           },                            │
  │           textColor: '#1f2328'          │
  │         }                               │
  │       }                                 │
  │     )                                   │
  │   const series =                        │
  │     chart.addSeries(                    │
  │       CandlestickSeries,                │
  │       {                                 │
  │         upColor: '#26a69a',             │
  │         downColor: '#ef5350'            │
  │       }                                 │
  │     )                                   │
  │   series.setData(candles)               │
  │   return { chart, series }              │
  │ }                                       │
  └─────────────────────────────────────────┘

  新代碼 (KLineChart):
  ┌─────────────────────────────────────────┐
  │ function renderChart(containerId,       │
  │                      candles) {         │
  │   const chart = init(containerId, {     │
  │     styles: {                           │
  │       candle: {                         │
  │         up: {                           │
  │           color: '#26a69a',             │
  │           borderColor: '#26a69a',       │
  │           wickColor: '#26a69a'          │
  │         },                              │
  │         down: {                         │
  │           color: '#ef5350',             │
  │           borderColor: '#ef5350',       │
  │           wickColor: '#ef5350'          │
  │         }                               │
  │       }                                 │
  │     }                                   │
  │   })                                    │
  │   chart.updateData(candles)             │
  │   return chart                          │
  │ }                                       │
  └─────────────────────────────────────────┘

  檢查清單:
  ├─ □ 圖表初始化成功
  ├─ □ 沒有控制台錯誤
  ├─ □ 顏色設置正確
  ├─ □ K 線渲染成功
  └─ □ 能縮放和平移

□ 驗證基礎功能 (1-2h)
  ├─ □ BTCUSDT 圖表顯示 100+ 根 K 線
  ├─ □ 可以左右平移
  ├─ □ 可以上下縮放
  ├─ □ 時間軸正確顯示
  └─ □ 運行 npm run test:unit，確保沒有破壞現有測試
```

### Week 2, Day 2-3: 雙圖表同步（8-10 小時）

```
□ 遷移 ChartManager 事件邏輯 (4-5h)
  
  時間軸同步對比:
  
  舊代碼 (lightweight-charts):
  ┌──────────────────────────────────────────┐
  │ initCharts(configs) {                    │
  │   this.charts = new Map()                │
  │   for (const config of configs) {        │
  │     const chart = createChart(...)       │
  │     const series = chart.addSeries(...)  │
  │     series.setData(config.rows)          │
  │                                          │
  │     // 時間軸同步                        │
  │     chart                                │
  │       .timeScale()                       │
  │       .onVisibleLogicalRangeChange(      │
  │         (range) => {                     │
  │           this.syncChartsOnRange(range)  │
  │         }                                │
  │       )                                  │
  │     this.charts.set(config.id, {         │
  │       chart,                             │
  │       series                             │
  │     })                                   │
  │   }                                      │
  │ }                                        │
  │                                          │
  │ syncChartsOnRange(range) {               │
  │   for (const {chart} of this.charts) {   │
  │     chart                                │
  │       .timeScale()                       │
  │       .setVisibleLogicalRange(range)     │
  │   }                                      │
  │ }                                        │
  └──────────────────────────────────────────┘

  新代碼 (KLineChart):
  ┌──────────────────────────────────────────┐
  │ initCharts(configs) {                    │
  │   this.charts = new Map()                │
  │   for (const config of configs) {        │
  │     const chart = init(config.id)        │
  │     chart.updateData(config.rows)        │
  │                                          │
  │     // 時間軸同步                        │
  │     chart.registerHandler(               │
  │       'onDataZoom',                      │
  │       ({ startIdx, endIdx }) => {        │
  │         this.syncChartsOnRange({         │
  │           startIdx,                      │
  │           endIdx                         │
  │         })                               │
  │       }                                  │
  │     )                                    │
  │     this.charts.set(config.id, chart)    │
  │   }                                      │
  │ }                                        │
  │                                          │
  │ syncChartsOnRange({ startIdx, endIdx }) {│
  │   for (const chart of this.charts) {     │
  │     chart.setVisibleRange({              │
  │       startIdx,                          │
  │       endIdx                             │
  │     })                                   │
  │   }                                      │
  │ }                                        │
  └──────────────────────────────────────────┘

  檢查清單:
  ├─ □ BTC 圖表和 ETH 圖表都顯示
  ├─ □ 在一個圖表上縮放，另一個同步
  ├─ □ 沒有無限迴圈或事件風暴
  └─ □ 性能可接受（縮放流暢）

□ 處理價格軸同步 (2-3h)
  
  檢查是否需要:
  ├─ 如果用戶需要價格軸同步 → 實現
  │  ├─ 聽 'onVisibleRangeChange' 事件
  │  └─ 同步其他圖表的 priceScale
  │
  └─ 如果不需要 → 跳過 (當前版本不需要)

□ 測試同步邏輯 (1h)
  ├─ 手動測試
  │  ├─ □ 在 BTC 圖表上左右平移
  │  ├─ □ 檢查 ETH 圖表是否同步移動
  │  ├─ □ 在 BTC 圖表上縮放
  │  └─ □ 檢查 ETH 圖表是否同步縮放
  │
  └─ 自動化測試
     ├─ test('應該同步雙圖表的時間軸', () => {
     │   // 測試代碼
     │ })
     └─ npm run test:unit
```

### Week 2, Day 4-5: 對數縮放（4-6 小時）

```
□ 遷移對數縮放邏輯 (2-3h)

  舊代碼 (lightweight-charts):
  ┌──────────────────────────────────┐
  │ const { Normal, Logarithmic }    │
  │   = LightweightCharts            │
  │   .PriceScaleMode                │
  │                                  │
  │ chart.priceScale('right')        │
  │   .applyOptions({                │
  │     mode: scaleMode === 'log'    │
  │       ? Logarithmic              │
  │       : Normal                   │
  │   })                             │
  └──────────────────────────────────┘

  新代碼 (KLineChart):
  ┌──────────────────────────────────┐
  │ chart.setPriceScale({            │
  │   mode: scaleMode === 'log'      │
  │     ? 'logarithmic'              │
  │     : 'normal'                   │
  │ })                               │
  └──────────────────────────────────┘

  檢查清單:
  ├─ □ 選中「對數縮放」復選框
  ├─ □ 圖表轉換為對數坐標
  ├─ □ Y 軸標籤更新（指數增長）
  ├─ □ 選中「線性縮放」復選框
  ├─ □ 圖表轉換回線性坐標
  └─ □ 切換多次，沒有錯誤或性能問題

□ 驗證價格顯示 (1h)
  ├─ 對數模式下
  │  ├─ □ 45000 BTC 應該顯示在正確位置
  │  ├─ □ 1 ETH 和 1000 ETH 距離相等（對數）
  │  └─ □ Y 軸標籤是指數形式
  │
  └─ 線性模式下
     ├─ □ 45000 BTC 應該顯示在正確位置
     ├─ □ 1 ETH 和 1000 ETH 距離按線性
     └─ □ Y 軸標籤是線性形式

□ 性能測試 (1-2h)
  ├─ 快速切換對數和線性 100 次
  │  └─ □ 應該平滑，沒有卡頓或內存洩漏
  └─ 在大數據集上測試（10000+ K 線）
     └─ □ 對數縮放應該快速響應
```

### Week 2, Day 6-7: 測試和修復（4-6 小時）

```
□ 單元測試更新 (2-3h)
  ├─ 找出所有現有的圖表相關測試
  │  └─ src/public/chart-manager.test.ts
  │
  ├─ 更新 mock 圖表對象
  │  ├─ 舊: mockChart.timeScale().onVisibleLogicalRangeChange()
  │  └─ 新: mockChart.registerHandler('onDataZoom', ...)
  │
  └─ 運行測試: npm run test:unit
     └─ □ 所有測試應該通過

□ 集成測試 (1-2h)
  ├─ 啟動開發服務器: npm run dev
  ├─ 手動測試完整流程
  │  ├─ □ 打開 charts.html
  │  ├─ □ BTCUSDT 和 ETHUSDT 都正確顯示
  │  ├─ □ 時間範圍選擇器工作
  │  ├─ □ 縮放同步正常
  │  ├─ □ 對數縮放切換正常
  │  ├─ □ 移動到邊界日期（時間戳邊界）
  │  └─ □ 加載空數據集
  │
  └─ 檢查控制台日誌
     └─ □ 沒有紅色錯誤，沒有黃色警告

□ 回歸測試 (1h)
  ├─ 測試 index.html（記錄表）
  │  └─ □ 點擊「K線圖」導航，應該顯示新的圖表
  │
  ├─ 測試 calculator.html（槓桿計算）
  │  └─ □ 應該不受影響
  │
  └─ 測試整個網站
     └─ □ 沒有關鍵功能被破壞
```

---

### Week 3, Day 1-3: 時間範圍和性能（12-16 小時）

```
□ 遷移時間範圍選擇邏輯 (4-6h)
  ├─ 查找所有的時間戳轉換代碼
  ├─ 確保所有轉換都正確（毫秒 → 秒）
  ├─ 驗證邊界情況
  │  ├─ □ 最早可能的時間 (1970-01-01)
  │  ├─ □ 未來時間
  │  └─ □ 時區邊界 (午夜)
  └─ 測試: npm run test:unit

□ 優化初始化時間 (4-6h)
  ├─ 測試當前初始化時間
  │  ├─ 打開 DevTools Performance 標籤
  │  ├─ 記錄打開 charts.html 時的時間
  │  ├─ 應該看到
  │  │  ├─ FCP (First Contentful Paint) < 1s
  │  │  ├─ LCP (Largest Contentful Paint) < 2s
  │  │  └─ 圖表可交互 < 2.5s
  │  └─ 記錄基準數值
  │
  ├─ 如果太慢，優化
  │  ├─ 延遲加載非關鍵組件
  │  ├─ 使用 Web Worker 進行數據轉換
  │  └─ 減少初始 K 線數量（後期加載）
  │
  └─ 驗證優化效果
     └─ □ 初始化時間 < 1.5s

□ 內存使用監測 (2-4h)
  ├─ 打開 DevTools Memory 標籤
  ├─ 記錄基準內存使用 (初始化後)
  ├─ 加載 1000 根 K 線，記錄內存
  ├─ 加載 5000 根 K 線，記錄內存
  │  └─ 預期: 線性增長，沒有洩漏
  │
  └─ 對比 lightweight-charts
     └─ □ KLineChart 應該使用更少內存
```

### Week 3, Day 4-7: 最終 QA（12-16 小時）

```
□ 完整功能測試 (6-8h)

  測試場景:
  
  1. 基礎場景
     ├─ □ 打開 charts.html
     ├─ □ 看到 BTCUSDT 和 ETHUSDT 圖表
     └─ □ 兩個圖表都可以縮放/平移

  2. 時間範圍選擇
     ├─ □ 選擇「開始時間」和「結束時間」
     ├─ □ 點擊「載入範圍」
     ├─ □ 圖表更新為新數據
     └─ □ 時間範圍摘要顯示正確

  3. 對數縮放
     ├─ □ 線性模式: K 線間距按價格線性
     ├─ □ 對數模式: K 線間距按百分比
     └─ □ 切換模式應該平滑

  4. 邊界情況
     ├─ □ 只有 1 根 K 線
     ├─ □ 0 根 K 線（API 返回空）
     ├─ □ 非常舊的時間 (1 年前)
     ├─ □ 未來時間
     └─ □ 時區邊界 (UTC 轉換)

  5. 性能測試
     ├─ □ 快速切換日期範圍 10 次，應該流暢
     ├─ □ 快速縮放 20 次，應該流暢
     ├─ □ 一秒內平移圖表 5 次，應該流暢
     └─ □ 沒有明顯的性能下降

  6. 移動端測試
     ├─ □ 用 iPhone 或 Android 瀏覽器打開
     ├─ □ 單指拖拽應該流暢
     ├─ □ 雙指 pinch 應該縮放
     ├─ □ 長按應該不會選中文本
     └─ □ 沒有 console 錯誤

□ 瀏覽器相容性測試 (2-3h)
  ├─ Chrome (最新)
  │  └─ □ 通過所有測試
  ├─ Firefox (最新)
  │  └─ □ 通過所有測試
  ├─ Safari (最新)
  │  └─ □ 通過所有測試
  └─ IE 11 (如果支持)
     └─ ⚠️ 如果失敗，記錄 issue

□ 代碼品質檢查 (2-3h)
  ├─ TypeScript 類型檢查
  │  └─ npx tsc --noEmit
  │     └─ □ 0 個錯誤
  │
  ├─ 代碼風格檢查
  │  └─ npm run lint
  │     └─ □ 0 個警告
  │
  ├─ 單元測試覆蓋率
  │  └─ npm run test:coverage
  │     └─ □ > 90% 覆蓋率
  │
  └─ 沒有 console.log 遺留
     └─ grep -r "console.log" src/
        └─ □ 只有必要的日誌

□ 文檔更新 (1-2h)
  ├─ 更新 API 文檔
  │  └─ 如果有 docs/API.md
  │
  ├─ 更新遷移筆記
  │  └─ 記錄主要變化和陷阱
  │
  └─ 更新開發人員指南
     └─ 如何添加新功能（用 KLineChart）
```

---

## 🛠️ 第 4 週：高級功能（15-20 小時）

### Day 1-2: Extension 集成（6-8 小時）

```
□ 安裝 extension (1h)
  ├─ npm install @klinecharts/extension
  └─ import { measure, trendLine } from '@klinecharts/extension'

□ 註冊基礎工具 (2-3h)
  ├─ 導入 8 個必需工具:
  │  ├─ measure (測量工具)
  │  ├─ trendLine (趨勢線)
  │  ├─ parallelChannel (通道)
  │  ├─ rect (矩形)
  │  ├─ circle (圓形)
  │  ├─ horizontalLine (水平線)
  │  ├─ verticalLine (垂直線)
  │  └─ text (文字)
  │
  ├─ 為每個工具註冊
  │  └─ chart.registerOverlay(measure)
  │
  └─ 檢查清單:
     └─ □ 導入沒有錯誤

□ 建立工具菜單 UI (2-3h)
  ├─ 設計工具欄/菜單
  │  ├─ 工具按鈕列表
  │  ├─ 工具屬性編輯面板
  │  └─ 繪圖清除/撤銷按鈕
  │
  ├─ 實現工具選擇邏輯
  │  └─ 用戶點擊「趨勢線」→ 啟用繪圖模式
  │
  └─ 檢查清單:
     ├─ □ 工具菜單顯示
     ├─ □ 可以選擇工具
     └─ □ 選中的工具高亮

□ 實現繪圖邏輯 (1-2h)
  ├─ 監聽繪圖事件
  │  └─ chart.registerHandler('onDrawEnd', (data) => {})
  │
  ├─ 提供清除繪圖的方法
  │  └─ chart.removeOverlay(overlayName)
  │
  └─ 檢查清單:
     ├─ □ 可以在圖表上繪製
     ├─ □ 繪圖外觀正確
     └─ □ 可以清除繪圖
```

### Day 3-4: 高級工具和指標（6-8 小時）

```
□ 添加高級工具 (2-3h)
  ├─ 額外的 extension 工具:
  │  ├─ fibonacciExtension (斐波那契延長)
  │  ├─ gannBox (甘特方形)
  │  └─ anyWaves (波浪分析)
  │
  ├─ 為每個工具添加 UI
  │  └─ 工具參數編輯器
  │
  └─ 檢查清單:
     └─ □ 所有工具都可以使用

□ 集成內置指標 (2-3h)
  ├─ 選擇 3-4 個常用指標:
  │  ├─ RSI (相對強度指數)
  │  ├─ MACD (移動平均收斂發散)
  │  ├─ KDJ (隨機指數)
  │  └─ MA (移動平均線)
  │
  ├─ 為每個指標添加 UI
  │  ├─ 選擇框 (啟用/禁用)
  │  ├─ 參數調整 (周期、平滑)
  │  └─ 顏色設置
  │
  └─ 檢查清單:
     ├─ □ 指標計算正確
     ├─ □ 指標顯示在圖表上
     └─ □ 可以調整參數

□ 測試所有工具 (1-2h)
  ├─ □ 每個工具都能繪製
  ├─ □ 指標值看起來合理
  └─ □ 性能可接受（不明顯變慢）
```

### Day 5-7: 打磨和優化（6-8 小時）

```
□ 性能最終調整 (2-3h)
  ├─ 移除未使用的工具（如果有）
  ├─ 優化繪圖渲染（如果卡頓）
  ├─ 檢查內存使用（10000+ K 線 + 多個指標）
  └─ 記錄最終性能指標

□ UI/UX 完善 (2-3h)
  ├─ 工具菜單是否易用
  ├─ 顏色搭配是否美觀
  ├─ 響應式設計（桌面/移動）
  └─ 無障礙性 (鍵盤導航)

□ 最終 QA (1-2h)
  ├─ □ 所有功能都能工作
  ├─ □ 沒有控制台錯誤
  ├─ □ 測試通過 > 95%
  └─ □ 準備合並到主分支

□ 準備發布 (1h)
  ├─ 更新版本號: v2.0.0
  ├─ 撰寫 CHANGELOG
  ├─ 準備發布說明
  └─ 建立 git tag
```

---

## ✅ 最終檢查清單

### 上線前（Day 最後一天）

```
功能清單:
├─ □ BTCUSDT 和 ETHUSDT 圖表都工作
├─ □ 雙圖表時間軸同步
├─ □ 對數/線性縮放切換
├─ □ 時間範圍選擇和加載
├─ □ 繪圖工具 (至少 5 個)
├─ □ 技術指標 (至少 3 個)
└─ □ 移動端響應

代碼品質:
├─ □ TypeScript 編譯通過 (0 錯誤)
├─ □ ESLint 檢查通過 (0 警告)
├─ □ 單元測試 > 90% 覆蓋率
├─ □ 沒有 console.log 遺留
└─ □ 代碼審查通過

性能:
├─ □ FCP < 1000ms
├─ □ LCP < 1500ms
├─ □ TTI < 2500ms
├─ □ 平移/縮放流暢 (60fps)
└─ □ 內存合理 (< 100MB)

相容性:
├─ □ Chrome 最新版 ✅
├─ □ Firefox 最新版 ✅
├─ □ Safari 最新版 ✅
├─ □ iOS Safari ✅
├─ □ Android Chrome ✅
└─ □ IE 11 (如支持) ⚠️

文檔:
├─ □ 遷移筆記完成
├─ □ API 文檔更新
├─ □ 用戶教程完成
└─ □ 開發指南更新
```

---

## 🚨 危機處理

### 如果遇到無法解決的問題

```
步驟 1: 確認問題 (30min)
  ├─ 能否重現？
  ├─ 是 KLineChart bug 還是我們的問題？
  └─ 搜索 GitHub issues

步驟 2: 尋求幫助 (1-2h)
  ├─ 查看官方文檔和 API 文檔
  ├─ 在 GitHub Discussions 提問
  └─ 查看開源社區回答

步驟 3: 臨時解決方案 (2-4h)
  ├─ Monkey-patch 繞過問題
  ├─ 使用舊版本 (回退 1-2 個版本)
  └─ 暫時禁用該功能

步驟 4: 決策 (1h)
  ├─ 如果能解決 → 繼續
  ├─ 如果 2 天內無法解決 → 回退到 lightweight-charts
  └─ 如果回退 → 預期 3 天時間
```

---

## 📊 進度追蹤

使用這個表格追蹤每週進度：

```
第 1 週 評估和規劃
├─ Day 1-2: 環境搭建   [████████░░] 80% (實際: __)
├─ Day 3-4: 數據驗證   [░░░░░░░░░░] 0%  (實際: __)
├─ Day 5-7: 計劃和預案 [░░░░░░░░░░] 0%  (實際: __)
└─ 總計:               [░░░░░░░░░░] 0%  (實際: __)

第 2 週 核心遷移
├─ Day 1:   基礎集成   [░░░░░░░░░░] 0%  (實際: __)
├─ Day 2-3: 雙圖同步   [░░░░░░░░░░] 0%  (實際: __)
├─ Day 4-5: 對數縮放   [░░░░░░░░░░] 0%  (實際: __)
├─ Day 6-7: 測試和修復 [░░░░░░░░░░] 0%  (實際: __)
└─ 總計:               [░░░░░░░░░░] 0%  (實際: __)

(依此類推...)
```

---

每完成一項，就在對應的 □ 打✅
