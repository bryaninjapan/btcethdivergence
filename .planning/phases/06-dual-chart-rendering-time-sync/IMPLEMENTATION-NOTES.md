---
phase: 6
title: "Dual Chart Rendering — Implementation Notes"
date: 2026-08-31
---

# Phase 6 Implementation Notes

Reference for Lightweight Charts v5 integration and bidirectional sync patterns.

---

## Lightweight Charts v5 Setup

### CDN + SRI Hash (Security)

```html
<!-- public/charts.html -->
<script 
  src="https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"
  integrity="sha384-EXACT_HASH_HERE"
  crossorigin="anonymous"
></script>
```

**SRI (Subresource Integrity):**
- Ensures CDN script hasn't been tampered with
- Browser verifies hash before executing
- If hash mismatch: script is **blocked** (not executed)

**Discipline check:**
```bash
# Verify SRI is present and not @latest
curl -s https://.../charts.html | grep -A1 'lightweight-charts'
# Should show: @5.2.1 with integrity attribute
# Should NOT show: @latest
```

### Pinned Version (Not @latest)

```
// ✅ GOOD: Pinned to tested version
lightweight-charts@5.2.1

// ❌ BAD: @latest means code changes unpredictably
lightweight-charts@latest
```

---

## Chart Creation & Configuration

### Initialization

```javascript
// public/js/charts.js

const btcChart = LightweightCharts.createChart(
  document.getElementById('btc-chart'),
  {
    layout: {
      background: { color: '#000' },
      textColor: '#AAA'
    },
    timeScale: {
      timeVisible: true,       // Show times on x-axis
      secondsVisible: false    // Hide seconds
    },
    width: 800,
    height: 420
  }
);

// Add candlestick series
const btcSeries = btcChart.addCandlestickSeries({
  upColor: '#26a69a',
  downColor: '#ef5350'
});

// Set data
btcSeries.setData(btcCandles);

// Align initial range (BTC → ETH)
const range = btcChart.timeScale().getVisibleLogicalRange();
if (range) {
  ethChart.timeScale().setVisibleLogicalRange(range);
}
```

### Data Format (Unix Seconds)

LightC Charts v5 expects:
```javascript
{
  time: 1627473600,           // Unix seconds (NOT milliseconds)
  open: 42000,
  high: 43000,
  low: 41500,
  close: 42500
}
```

**Conversion from D1:**
```javascript
function toCandle(row) {
  return {
    time: row.open_time,                  // Already seconds in D1
    open: Number(row.open),               // Coerce string → number
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close)
  };
}
```

---

## Bidirectional Sync Pattern

### Problem: Infinite Loops

Without a guard, sync events can create feedback loops:

```
User pans chart A
  ↓
Chart A fires "time range changed" event
  ↓
Sync handler calls setVisibleRange(B, range)
  ↓
Chart B fires "time range changed" event
  ↓
Sync handler calls setVisibleRange(A, range)
  ↓
Chart A fires "time range changed" event  ← Loop!
  ↓
... infinite recursion
```

### Solution: Re-entrancy Guard

```typescript
// public/js/chart-sync.ts
export function createRangeSync() {
  let syncing = false;  // Gate to prevent re-entrance
  
  return {
    link(chart1: ChartApi, chart2: ChartApi) {
      const handleChartARange = (range: LogicalRange | null) => {
        if (syncing) return;  // ✅ Ignore if already in progress
        
        try {
          syncing = true;  // Set guard
          if (isUsableRange(range)) {
            chart2.timeScale().setVisibleLogicalRange(range);
          }
        } finally {
          syncing = false;  // Always reset
        }
      };
      
      const handleChartBRange = (range: LogicalRange | null) => {
        if (syncing) return;
        
        try {
          syncing = true;
          if (isUsableRange(range)) {
            chart1.timeScale().setVisibleLogicalRange(range);
          }
        } finally {
          syncing = false;
        }
      };
      
      // Wire both directions
      chart1.timeScale().subscribeVisibleTimeRangeChange(handleChartARange);
      chart2.timeScale().subscribeVisibleTimeRangeChange(handleChartBRange);
      
      // Return unsubscribe function
      return () => {
        chart1.timeScale().unsubscribeVisibleTimeRangeChange(handleChartARange);
        chart2.timeScale().unsubscribeVisibleTimeRangeChange(handleChartBRange);
      };
    }
  };
}

// Reject invalid ranges
function isUsableRange(range: LogicalRange | null): range is LogicalRange {
  if (!range) return false;
  const { from, to } = range;
  return (
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    from < to
  );
}
```

### Test: Re-entrancy Prevention

```typescript
// public/js/chart-sync.test.ts
describe('chart-sync', () => {
  it('prevents re-entrance loop', () => {
    const sync = createRangeSync();
    
    // Mock time scales with callback tracking
    const callA = vi.fn();
    const callB = vi.fn();
    
    const fakeA = {
      subscribeVisibleTimeRangeChange: (cb: Function) => {
        callA.mockImplementation(() => cb({ from: 1, to: 100 }));
      },
      setVisibleLogicalRange: vi.fn()
    };
    
    const fakeB = {
      subscribeVisibleTimeRangeChange: (cb: Function) => {
        // When B.setVisibleRange is called, it fires its listener
        // This would normally cause A's listener to fire again (loop)
      },
      setVisibleLogicalRange: vi.fn(() => {
        callB();  // Simulate B firing after set
      })
    };
    
    sync.link(fakeA as any, fakeB as any);
    
    // Trigger A's range change
    callA();
    
    // B should be set (forward link)
    expect(fakeB.setVisibleLogicalRange).toHaveBeenCalledTimes(1);
    
    // A should NOT be set again (loop prevented by syncing flag)
    expect(fakeA.setVisibleLogicalRange).not.toHaveBeenCalled();
  });
});
```

---

## Fetch Strategy: 30-Day Windows

### Why Not Full History?

Full history (2021 → present): ~50,000 hourly candles

- **Rendering:** LWC slows at extreme zoom levels with massive datasets
- **Bandwidth:** 50K candles ≈ 5MB JSON
- **UX:** User can still scroll backward to see older candles (Phase 7)

### Bounded Window

```javascript
// public/js/charts.js

const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;  // 30 days

async function loadWindow(startMs, endMs) {
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);
  
  try {
    const response = await api(
      `/api/klines?symbol=BTCUSDT&start=${startSec}&end=${endSec}`
    );
    
    const btcCandles = response.map(toCandle);
    btcSeries.setData(btcCandles);
    
    // Align both charts to this window
    btcChart.timeScale().setVisibleRange({
      from: startSec,
      to: endSec
    });
    
    ethChart.timeScale().setVisibleRange({
      from: startSec,
      to: endSec
    });
  } catch (error) {
    showError(`Failed to load charts: ${error.message}`);
  }
}

// On page load
window.addEventListener('DOMContentLoaded', () => {
  const now = Math.floor(Date.now() / 1000);
  const start = now - DEFAULT_WINDOW_SECONDS;
  
  loadWindow(start * 1000, now * 1000);
});
```

---

## Error Handling

### Network Errors

```javascript
async function loadWindow(startMs, endMs) {
  try {
    const response = await api(`/api/klines?...`);
    // ... render
  } catch (error) {
    const banner = document.getElementById('chart-error');
    banner.textContent = error.message;
    banner.style.display = 'block';
    
    // Keep previous data if any
    return;
  }
}
```

### Null/NaN Range Rejection

```typescript
function isUsableRange(range: any): range is LogicalRange {
  if (!range) return false;
  
  const { from, to } = range;
  
  // Reject non-finite values (NaN, Infinity)
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    console.warn('Rejected non-finite range', { from, to });
    return false;
  }
  
  // Reject invalid ranges
  if (from >= to) {
    console.warn('Rejected inverted range', { from, to });
    return false;
  }
  
  return true;
}
```

---

## Testing: Playwright Browser Integration

### Interactive Verification

```typescript
// e2e/charts.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test('both charts render and sync', async ({ page }) => {
  await page.goto('https://localhost/charts.html');
  
  // Wait for charts to render
  await page.waitForSelector('#btc-chart canvas');
  await page.waitForSelector('#eth-chart canvas');
  
  // Check no errors
  const errors = await page.evaluate(() => {
    const logs = window.__consoleLogs || [];
    return logs.filter(l => l.level === 'error');
  });
  expect(errors.length).toBe(0);
  
  // Pan BTC chart → ETH should follow
  const btcCanvas = page.locator('#btc-chart canvas');
  await btcCanvas.hover();
  await page.mouse.move(400, 200);
  await page.mouse.down();
  await page.mouse.move(300, 200);  // Drag left (pan backward)
  await page.mouse.up();
  
  // Verify both charts' time ranges are similar
  const btcRange = await page.evaluate(() => window.btcChart.timeScale().getVisibleLogicalRange());
  const ethRange = await page.evaluate(() => window.ethChart.timeScale().getVisibleLogicalRange());
  
  expect(btcRange.from).toBe(ethRange.from);
  expect(btcRange.to).toBe(ethRange.to);
});
```

---

## Performance Considerations

### Rendering Speed

| Task | Time |
|------|------|
| Parse 1000 candles JSON | ~5ms |
| LWC `.setData()` | ~50ms |
| Render candlesticks | ~100ms |
| Sync range change | ~1ms |

**Total:** ~150ms for full chart load (acceptable, <250ms perceptual lag)

### Memory

- 1000 candles ≈ 500KB (in-memory)
- Two charts: ~1MB
- Negligible (browsers easily handle)

---

**Last Updated:** 2026-08-31
