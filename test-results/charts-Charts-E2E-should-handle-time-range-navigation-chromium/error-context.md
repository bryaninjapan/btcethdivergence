# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: charts.spec.ts >> Charts E2E >> should handle time range navigation
- Location: e2e/charts.spec.ts:103:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Matcher error: received value must be a number or bigint

Received has value: undefined
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - heading "BTC/ETH Divergence Tracker" [level=1] [ref=e3]
    - generic [ref=e4]:
      - link "記錄表" [ref=e5] [cursor=pointer]:
        - /url: /
      - link "K線圖" [ref=e6] [cursor=pointer]:
        - /url: /charts.html
      - link "槓桿計算" [ref=e7] [cursor=pointer]:
        - /url: /calculator.html
  - banner [ref=e8]
  - main [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]:
        - checkbox "對數縮放" [ref=e12]
        - text: 對數縮放
      - generic [ref=e13]:
        - text: 開始時間 (UTC)
        - generic [ref=e14]:
          - combobox "開始時間 (UTC) 年 月 2 日 時" [ref=e15]
          - text: 年
          - combobox [ref=e16]
          - text: 月
          - combobox [ref=e17]:
            - option "1"
            - option "2" [selected]
            - option "3"
            - option "4"
            - option "5"
            - option "6"
            - option "7"
            - option "8"
            - option "9"
            - option "10"
            - option "11"
            - option "12"
            - option "13"
            - option "14"
            - option "15"
            - option "16"
            - option "17"
            - option "18"
            - option "19"
            - option "20"
            - option "21"
            - option "22"
            - option "23"
            - option "24"
            - option "25"
            - option "26"
            - option "27"
            - option "28"
            - option "29"
            - option "30"
            - option "31"
          - text: 日
          - combobox [ref=e18]
          - text: 時
      - generic [ref=e19]:
        - text: 結束時間 (UTC)
        - generic [ref=e20]:
          - combobox "結束時間 (UTC) 年 月 1 日 時" [ref=e21]
          - text: 年
          - combobox [ref=e22]
          - text: 月
          - combobox [ref=e23]:
            - option "1" [selected]
            - option "2"
            - option "3"
            - option "4"
            - option "5"
            - option "6"
            - option "7"
            - option "8"
            - option "9"
            - option "10"
            - option "11"
            - option "12"
            - option "13"
            - option "14"
            - option "15"
            - option "16"
            - option "17"
            - option "18"
            - option "19"
            - option "20"
            - option "21"
            - option "22"
            - option "23"
            - option "24"
            - option "25"
            - option "26"
            - option "27"
            - option "28"
            - option "29"
            - option "30"
            - option "31"
          - text: 日
          - combobox [ref=e24]
          - text: 時
      - button "載入範圍" [ref=e25] [cursor=pointer]
      - paragraph [ref=e26]: 2026-08-02T14:42:08.665Z ~ 2026-09-01T14:42:08.665Z (UTC)
    - generic [ref=e27]:
      - heading "BTCUSDT 1h" [level=3] [ref=e28]
      - table [ref=e31]:
        - row [ref=e32]:
          - cell [ref=e33]
          - cell [ref=e34]:
            - link "Charting by TradingView" [ref=e38] [cursor=pointer]:
              - /url: https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart&utm_source=localhost/charts
          - cell [ref=e43]
        - row [ref=e47]:
          - cell [ref=e48]
          - cell [ref=e49]
          - cell [ref=e53]
    - generic [ref=e56]:
      - heading "ETHUSDT 1h" [level=3] [ref=e57]
      - table [ref=e60]:
        - row [ref=e61]:
          - cell [ref=e62]
          - cell [ref=e63]:
            - link "Charting by TradingView" [ref=e67] [cursor=pointer]:
              - /url: https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart&utm_source=localhost/charts
          - cell [ref=e72]
        - row [ref=e76]:
          - cell [ref=e77]
          - cell [ref=e78]
          - cell [ref=e82]
```

# Test source

```ts
  11  |     // Wait for charts to render
  12  |     await page.waitForSelector('canvas', { timeout: 5000 });
  13  |   });
  14  | 
  15  |   test('should render both BTC and ETH K-line charts', async ({ page }) => {
  16  |     const canvases = page.locator('canvas');
  17  |     const count = await canvases.count();
  18  | 
  19  |     // Should have at least 2 canvases (BTC + ETH)
  20  |     expect(count).toBeGreaterThanOrEqual(2);
  21  | 
  22  |     // Both should be visible
  23  |     for (let i = 0; i < Math.min(count, 2); i++) {
  24  |       await expect(canvases.nth(i)).toBeVisible();
  25  |     }
  26  |   });
  27  | 
  28  |   test('should sync time range across BTC/ETH charts', async ({ page }) => {
  29  |     // Get initial visible range from both charts
  30  |     const btcRangeStart = await page.evaluate(() => {
  31  |       const timeScale = (window as any).__test_charts?.btcChart?.timeScale();
  32  |       return timeScale?.getVisibleRange()?.from;
  33  |     });
  34  | 
  35  |     const ethRangeStart = await page.evaluate(() => {
  36  |       const timeScale = (window as any).__test_charts?.ethChart?.timeScale();
  37  |       return timeScale?.getVisibleRange()?.from;
  38  |     });
  39  | 
  40  |     // Ranges should be the same (synchronized)
  41  |     expect(btcRangeStart).toBe(ethRangeStart);
  42  |   });
  43  | 
  44  |   test('should sync zoom level across charts', async ({ page }) => {
  45  |     // Get initial zoom level from BTC chart
  46  |     const initialZoom = await page.evaluate(() => {
  47  |       const timeScale = (window as any).__test_charts?.btcChart?.timeScale();
  48  |       return timeScale?.getVisibleRange()?.to;
  49  |     });
  50  | 
  51  |     // Simulate scroll/zoom on BTC chart
  52  |     await page.evaluate(() => {
  53  |       const timeScale = (window as any).__test_charts?.btcChart?.timeScale();
  54  |       if (timeScale && timeScale.getVisibleRange) {
  55  |         const range = timeScale.getVisibleRange();
  56  |         // Narrow the time range (zoom in)
  57  |         timeScale.setVisibleRange({
  58  |           from: Math.ceil(range.from + (range.to - range.from) * 0.1),
  59  |           to: Math.floor(range.to - (range.to - range.from) * 0.1),
  60  |         });
  61  |       }
  62  |     });
  63  | 
  64  |     // Wait for sync to happen
  65  |     await page.waitForTimeout(100);
  66  | 
  67  |     // Check that ETH chart has same zoom level
  68  |     const ethRangeAfter = await page.evaluate(() => {
  69  |       const timeScale = (window as any).__test_charts?.ethChart?.timeScale();
  70  |       return timeScale?.getVisibleRange()?.to;
  71  |     });
  72  | 
  73  |     expect(ethRangeAfter).toBeGreaterThan(0);
  74  |   });
  75  | 
  76  |   test('should support log scale toggle', async ({ page }) => {
  77  |     // Find log scale toggle checkbox
  78  |     const logScaleCheckbox = page.locator('#log-scale');
  79  | 
  80  |     if (await logScaleCheckbox.isVisible()) {
  81  |       await logScaleCheckbox.check();
  82  | 
  83  |       // Verify checkbox state changed
  84  |       await page.waitForTimeout(100);
  85  | 
  86  |       const isLogScaleChecked = await logScaleCheckbox.isChecked();
  87  | 
  88  |       expect(isLogScaleChecked).toBe(true);
  89  |     }
  90  |   });
  91  | 
  92  |   test('should load K-line data from API', async ({ page }) => {
  93  |     // Check if klines were loaded
  94  |     const klineCount = await page.evaluate(() => {
  95  |       const series = (window as any).__test_charts?.btcSeries;
  96  |       // Try to get data from series (implementation-dependent)
  97  |       return series ? 1 : 0; // Simplified check
  98  |     });
  99  | 
  100 |     expect(klineCount).toBeGreaterThan(0);
  101 |   });
  102 | 
  103 |   test('should handle time range navigation', async ({ page }) => {
  104 |     // Get current visible time range
  105 |     const initialRange = await page.evaluate(() => {
  106 |       const timeScale = (window as any).__test_charts?.btcChart?.timeScale();
  107 |       return timeScale?.getVisibleRange();
  108 |     });
  109 | 
  110 |     expect(initialRange).toBeDefined();
> 111 |     expect(initialRange?.from).toBeGreaterThan(0);
      |                                ^ Error: expect(received).toBeGreaterThan(expected)
  112 |     expect(initialRange?.to).toBeGreaterThan(initialRange?.from);
  113 |   });
  114 | });
  115 | 
```