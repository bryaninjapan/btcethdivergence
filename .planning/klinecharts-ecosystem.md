# KLineCharts 生態系統研究

> 研究日期: 2026-09-03  
> 對象: BTC/ETH Divergence Tracker v2.0 升級方案

---

## 📋 三個倉庫概覽

| 倉庫 | 用途 | 狀態 | 相關度 |
|-----|------|------|-------|
| **data-aggregator** | 實時交易數據 → K線數據 | ✅ 可用 | ⭐⭐⭐⭐⭐ |
| **extension** | 高級繪圖工具和指標 | ✅ 可用 | ⭐⭐⭐⭐ |
| **pro** | 完整財務圖表產品 | ✅ v0.1.1 | ⭐⭐⭐ |

---

## 1️⃣ @klinecharts/data-aggregator

### 功能
**把實時交易 tick 數據聚合成蠟燭線(K線)**

```
Trade tick: { time, price, volume }
     ↓
Aggregator (聚合)
     ↓
Candle: { open, high, low, close, volume }
```

### 核心特性

#### ✅ 支持的時間周期
- `second` - 秒線
- `minute` - 分鐘線
- `hour` - 小時線
- `day` - 日線
- `week` - 週線
- `month` - 月線
- `year` - 年線

可自定義 span（如 5分鐘線、15分鐘線）

#### ✅ 時區支持
```javascript
const aggregator = new DataAggregator({
  utcOffsetMinutes: 480  // UTC+8 (台灣/香港時間)
})
```

#### ✅ 交易時段支持

**24/7 市場**（加密貨幣）
```javascript
const aggregator = new DataAggregator({
  utcOffsetMinutes: 0,
  mergeSecondAcrossTradingDay: true,
  mergeMinuteAcrossTradingDay: true,
  mergeHourAcrossTradingDay: true
})
```

**股市（有開盤時間）**
```javascript
const aggregator = new DataAggregator({
  sessions: [
    { start: '09:30', end: '11:30' },
    { start: '13:00', end: '15:00' }  // 午休
  ],
  mergeSecondAcrossTradingDay: false,  // 不跨日
  mergeMinuteAcrossTradingDay: false
})
```

#### ✅ 節假日支持
```javascript
const aggregator = new DataAggregator({
  tradingCalendar: {
    holidays: ['2026-01-01', '2026-02-16', '2026-02-17'],
    extraTradingDays: ['2026-02-15'],  // 補班日
    weekendDays: [6, 0]  // 週六日不交易
  }
})
```

### 使用流程

```javascript
import DataAggregator from '@klinecharts/data-aggregator'

// 1. 初始化聚合器
const aggregator = new DataAggregator({
  utcOffsetMinutes: 0
})

// 2. 設置時間周期
aggregator.setPeriod({
  type: 'minute',
  span: 1  // 1 分鐘線
})

// 3. 加載歷史數據（可選）
aggregator.setBaseData(lastUnclosedCandle)

// 4. 逐筆添加交易
const result = aggregator.add({
  timestamp: Date.now(),
  price: 45000,
  volume: 0.5,
  turnover: 22500  // 可選
})

// 5. 檢查是否產生新 K 線
if (result.closed) {
  // 上一個 K 線已關閉，保存到數據庫
  await saveKLine(result.closed)
}

// 6. 更新圖表（當前未關閉的 K 線）
chart.updateData(result.current)
```

### 對你的專案的意義

**目前的做法：**
- 從 Binance API 獲取已聚合好的 K 線
- 例如: `GET /fapi/v1/klines?symbol=BTCUSDT&interval=1h`

**data-aggregator 的用途：**
- 如果要從 websocket 接收 **實時 tick 數據** → 聚合成 K 線
- 例如: Binance websocket `btcusdt@aggTrade`
- 或自己的交易所 API 實時推送

**何時需要：**
1. ✅ 要做**實時交易**（看到最新未完成的 K 線更新）
2. ✅ 要支持**多個交易所**（自己聚合數據保證一致性）
3. ✅ 要做**分鐘/秒級**的超短線交易
4. ❌ 如果只是分析歷史數據 → 不需要

**估計工作量：**
- 集成: 2-4h
- 測試: 2-3h
- 總計: 4-7h

---

## 2️⃣ @klinecharts/extension

### 功能
**KLineChart 的高級繪圖工具和指標擴展包**

### 包含的工具

#### 基本形狀（7 個）
```
arrow          - 箭頭
circle         - 圓形
parallelogram  - 平行四邊形
rect           - 矩形
triangle       - 三角形
```

#### 價格模式（2 個）
```
abcd           - ABCD 形態 (價格預測工具)
xabcd          - XABCD 形態 (Harmonic Pattern)
```

#### 波浪工具（4 個）
```
anyWaves       - 任意波浪
threeWaves     - 三波浪
fiveWaves      - 五波浪 (艾略特波浪理論)
eightWaves     - 八波浪
```

#### 斐波那契工具（6 個）
```
fibonacciCircle        - 斐波那契圓
fibonacciExtension     - 斐波那契延長
fibonacciSegment       - 斐波那契線段
fibonacciSpiral        - 斐波那契螺旋
... (更多)
```

#### 甘特工具（2 個）
```
gannBox        - 甘特方形
gannFan        - 甘特扇形
```

#### 其他（5+ 個）
```
measure        - 測量工具
... (見文檔)
```

### 使用方式

**方式 1: 全局註冊**（推薦簡單場景）
```javascript
import { init, registerOverlay } from 'klinecharts'
import { measure, fibonacciExtension } from '@klinecharts/extension'

// 註冊一次（應用啟動時）
registerOverlay(measure)
registerOverlay(fibonacciExtension)

// 之後可直接使用
const chart = init('chart')
chart.createOverlay('measure')
chart.createOverlay('fibonacciExtension')
```

**方式 2: 按需導入**（推薦大型應用）
```javascript
import { registerOverlay } from 'klinecharts'
import measure from '@klinecharts/extension/overlays/measure'

registerOverlay(measure)
```

**方式 3: 批量導入**（推薦快速原型）
```javascript
import { registerOverlay } from 'klinecharts'
import * as overlays from '@klinecharts/extension/overlays'

Object.values(overlays).forEach(registerOverlay)
```

### 對你的專案的意義

**目前的做法：**
- 只有基礎 K 線圖，無繪圖工具

**extension 提供：**
- ✅ 趨勢線、通道、矩形等 TradingView 級工具
- ✅ 斐波那契、甘特等高級分析工具
- ✅ 零依賴，開箱即用

**何時需要：**
1. ✅ 升級到 TradingView 級功能
2. ✅ 支持技術分析（波浪理論、斐波那契）
3. ✅ 要做交易標記和筆記

**估計工作量：**
- 集成: 1-2h
- UI 定製: 4-6h
- 文檔: 2-3h
- 總計: 7-11h

---

## 3️⃣ @klinecharts/pro

### 功能
**完整的財務圖表產品，開箱即用**

### 這是什麼
KLineChart Pro 是基於 KLineChart 開發的 **高級商業產品**

- **不是開源的**（開源的是 KLineChart 本身）
- **是一個完整的圖表解決方案**
- **集成了多個擴展和最佳實踐**

### 包含的功能

根據官方描述，Pro 包括：

```
✅ 所有 KLineChart 的基礎功能
✅ extension 中的所有高級工具
✅ 額外的指標和分析工具
✅ 專業的 UI/UX
✅ 移動端完全優化
✅ 企業級穩定性
✅ 官方技術支持
```

### 版本和價格

| 版本 | 發布日期 | 狀態 |
|-----|---------|------|
| 0.1.1 | 最近 | Latest |
| 0.1.0 | 早期 | Archived |

**注意：** 目前還在 0.x 版本，可能 API 還在變化中

### 使用方式

**npm 安裝**
```bash
npm install @klinecharts/pro --save
```

**CDN**
```html
<script src="https://unpkg.com/@klinecharts/pro/dist/klinecharts-pro.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@klinecharts/pro/dist/klinecharts-pro.umd.js"></script>
```

### 對你的專案的意義

**Pro 是什麼級別的解決方案：**

```
你的現在         KLineChart         extension      KLineChart Pro
┌──────────┐    ┌──────────┐      ┌──────────┐    ┌──────────┐
│ 基礎 K線 │    │ 完整功能 │      │ 高級工具 │    │ 企業級  │
│ 雙圖對比 │    │ 指標系統 │      │ 繪圖工具 │    │ 完整產品│
│ 100%功能│    │ 模塊化  │      │ 斐波那契 │    │ 開箱即用│
│ 簡單 UI  │    │ 開源    │      │ 甘特等   │    │ 商業支持│
└──────────┘    └──────────┘      └──────────┘    └──────────┘
   v1.0          開源基礎           最好的開源      企業解決方案
```

**何時考慮 Pro：**
1. ✅ 要求快速上線完整功能
2. ✅ 想要官方技術支持
3. ✅ 預算充足
4. ❌ 想完全掌控代碼
5. ❌ 有特殊定製需求

**估計成本：**
- 研究和評估: 2-3h
- 集成: 4-8h
- 定製: 需具體談（可能商業授權）
- 許可費用: 需詢問官方

---

## 🎯 推薦方案對比

### 場景 A: 基本升級（推薦）

```
目標: 從 lightweight-charts 升級到 KLineChart
      支持高級繪圖和指標

方案:
1. 遷移到 KLineChart
   ├─ 工作量: 60-80h
   └─ 預計: 2-3 週

2. 集成 extension
   ├─ 工作量: 7-11h
   └─ 預計: 1 週

3. （可選）集成 data-aggregator
   ├─ 工作量: 4-7h
   └─ 預計: 1-2 天
   └─ 用途: 支持實時 tick 聚合

總投入: 71-98h（3-4 週）
成本: 完全開源，零許可費
適用: 中小型交易工具
```

### 場景 B: 快速上線

```
目標: 快速推出 TradingView 級交易工具

方案:
1. 評估 KLineChart Pro
   ├─ 工作量: 2-3h
   └─ 預計: 1 天

2. 集成 Pro + extension
   ├─ 工作量: 8-16h
   └─ 預計: 1-2 週
   └─ 需要商業授權

3. 集成 data-aggregator（可選）
   ├─ 工作量: 4-7h
   └─ 預計: 1-2 天

總投入: 14-26h（1-2 週）
成本: Pro 許可費 (需詢問官方)
適用: 快速商業推出
```

### 場景 C: 完整生態集成

```
目標: 打造完整的加密交易平台

方案:
1. KLineChart 作為基礎
2. extension 作為工具擴展
3. data-aggregator 作為實時聚合
4. 自己的 API 層

架構:
┌─────────────────────┐
│   KLineChart Pro    │
├─────────────────────┤
│ extension | data... │
├─────────────────────┤
│   你的 API 層       │
├─────────────────────┤
│  Binance/其他交易所 │
└─────────────────────┘

總投入: 80-120h（4-6 週）
成本: 開源 + Pro 許可費（可選）
適用: 企業級平台
```

---

## 📊 決策矩陣

### 使用 extension 的理由

| 理由 | 重要度 | 你的情況 |
|-----|-------|--------|
| 支持高級分析工具 | ⭐⭐⭐⭐⭐ | ✅ 用戶需要 |
| 減少自己開發 | ⭐⭐⭐⭐⭐ | ✅ 節省時間 |
| TradingView 功能對標 | ⭐⭐⭐⭐ | ✅ 競爭需要 |
| 零依賴可靠性 | ⭐⭐⭐ | ✅ 優勢 |
| 開源自由度 | ⭐⭐⭐ | ✅ 優勢 |

### 使用 data-aggregator 的理由

| 理由 | 重要度 | 你的情況 |
|-----|-------|--------|
| 支持實時交易 | ⭐⭐⭐⭐ | ❓ 根據產品方向 |
| 秒級/分級數據 | ⭐⭐⭐⭐ | ❓ 根據交易類型 |
| 多交易所統一 | ⭐⭐⭐ | ❓ 未來可能需要 |
| 時區/節假日管理 | ⭐⭐⭐ | ✅ 有需求 |

### 使用 Pro 的理由

| 理由 | 重要度 | 你的情況 |
|-----|-------|--------|
| 快速上線 | ⭐⭐⭐⭐ | ⭓ 可能 |
| 官方支持 | ⭐⭐⭐ | ⭓ 可能 |
| 企業穩定性 | ⭐⭐⭐ | ❌ 開源足夠 |
| 商業授權 | ⭐ | ❌ 成本考量 |

---

## 🔗 生態系統圖

```
             KLineChart (核心)
            /      |      \
           /       |       \
    extension    data-      \
    (工具集)    aggregator   \
                (實時聚合)   Pro
    ├─ 繪圖工具           (商業產品)
    ├─ 高級指標          ├─ 開箱即用
    ├─ 技術分析          ├─ 企業支持
    └─ 完全開源          └─ 許可費

你的專案的集成路徑:
Lightweight-Charts → KLineChart → extension + data-aggregator
                                        ↓
                                   (可選) Pro
```

---

## 📝 下一步建議

### 立即行動（本週）
```
[ ] 1. 決定是否遷移到 KLineChart (vs 繼續 lightweight-charts)
[ ] 2. 瞭解用戶對高級工具的需求程度
[ ] 3. 評估實時 tick 聚合是否需要
```

### 短期計劃（1-2 週）
```
[ ] 1. KLineChart 基礎評估 POC（可選）
[ ] 2. extension 功能清單審查
[ ] 3. Pro 功能和定價諮詢（可選）
```

### 中期計劃（1 個月）
```
[ ] 1. 決定最終技術棧
[ ] 2. 制定詳細的遷移/開發計畫
[ ] 3. 開始實施開發
```

---

## 📚 參考資料

| 倉庫 | GitHub | 文檔 | Stars |
|-----|--------|------|-------|
| KLineChart | https://github.com/klinecharts/KLineChart | https://www.klinecharts.com | 4.1k |
| data-aggregator | https://github.com/klinecharts/data-aggregator | README | 9 |
| extension | https://github.com/klinecharts/extension | README | ? |
| pro | https://github.com/klinecharts/pro | https://pro.klinecharts.com | ? |

---

## 總結

| 名稱 | 用途 | 採用難度 | 優先級 |
|-----|-----|---------|--------|
| **data-aggregator** | 實時 tick → K 線 | ⭐⭐ 簡單 | ⭓ 根據需求 |
| **extension** | 高級繪圖工具 | ⭐⭐ 簡單 | ⭐⭐⭐ 高 |
| **pro** | 完整商業產品 | ⭐⭐⭐ 中等 | ⭓ 備選方案 |

**最佳路徑：** 
1. KLineChart （基礎升級）
2. extension （功能完善）
3. data-aggregator （可選，實時功能）
4. Pro （可選，快速商業上線）
