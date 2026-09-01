# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: charts.spec.ts >> Charts E2E >> should sync zoom level across charts
- Location: e2e/charts.spec.ts:44:3

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of null (reading 'from')
    at eval (eval at evaluate (:311:30), <anonymous>:8:33)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
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
      - paragraph [ref=e26]: 2026-08-02T14:42:08.545Z ~ 2026-09-01T14:42:08.545Z (UTC)
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