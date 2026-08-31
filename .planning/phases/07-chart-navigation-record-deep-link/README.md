---
phase: 7
status: ✅ COMPLETE
---

# Phase 7: Chart Navigation & Record Deep Link

**Completed:** 2026-08-31 | **Duration:** 1 day | **Commits:** 8

## Quick Summary

Implemented log-scale toggle (both charts), custom date-range pickers for charts, and record→chart deep link with ±24h padding. Clicking "查看K線" on a record navigates to `/charts.html?start=X&end=Y` with automatic padding. Deep links maintain sync and render correctly.

### Before Phase 7
```
Charts are fixed 30-day window
No deep-link navigation from records
```

### After Phase 7
```
✅ Log-scale toggle applies to both charts
✅ Custom range pickers (start/end UTC dates)
✅ Record → chart deep link with ±24h padding
✅ Deep-link ranges validate (fallback to default on bad input)
✅ Sync maintained across custom ranges and deep links
```

---

## What Changed

### Charts Page
| Component | Status | Purpose |
|-----------|--------|---------|
| **chart-range.js** | ✅ NEW | Pure module: `recordToRange()`, `parseRangeParams()`, `nowRange()` |
| **chart-range.test.ts** | ✅ NEW | 10 vitest tests (padding, param parsing, deep-link round-trip) |
| **charts.html controls** | ✅ NEW | Log-scale checkbox, UTC date-range pickers, load-range button |
| **charts.js** | ✅ EXTENDED | `loadRange()`, `setLogScale()`, param-init from `?start/end` |

### Records Page
| Component | Status | Purpose |
|-----------|--------|---------|
| **records.js** | ✅ EXTENDED | `view-chart` button per row, deep-link navigation |

---

## Success Criteria

### All Met ✅

| SC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| SC1 | Log-scale toggle both charts | ✅ | Playwright: checkbox → both price axes become logarithmic |
| SC2 | Custom range loads both charts | ✅ | 2023-01-01 → 2023-02-01 loads 745 candles, pickers reflect range |
| SC3 | Record → chart deep link ±24h | ✅ | Clicking 查看K線 navigates with padded window, both charts loaded |

---

## Chart Range Module (Pure Logic)

### Why Pure Module?

```javascript
// ✅ GOOD: Test logic without DOM
export function recordToRange(record) {
  const startMs = record.start_time * 1000 - (24 * 3600 * 1000);
  const endMs = record.end_time * 1000 + (24 * 3600 * 1000);
  return { startMs, endMs };
}

const range = recordToRange({ start_time: 1705324800, end_time: 1705411200 });
expect(range.startMs).toBe(1705238400000);

// ❌ HARD: DOM-dependent logic
function recordToRangeAndNavigate(recordId) {
  const startField = document.getElementById('start');
  // ... mixes logic with DOM
}
```

**Benefits:**
- Testable in vitest (no jsdom)
- Reusable (can be called from any context)
- Easy to reason about

### Core Functions

```javascript
// public/js/chart-range.js

const PADDING_SECONDS = 24 * 3600;  // 24 hours
const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;  // 30 days

export function recordToRange(record) {
  const startMs = (record.start_time - PADDING_SECONDS) * 1000;
  const endMs = (record.end_time + PADDING_SECONDS) * 1000;
  return { startMs, endMs };
}

export function parseRangeParams(searchString) {
  const params = new URLSearchParams(searchString);
  const start = params.get('start');
  const end = params.get('end');
  
  if (!start || !end) return null;
  
  const startMs = parseInt(start, 10);
  const endMs = parseInt(end, 10);
  
  // Validate
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null;  // Invalid → use default
  }
  
  return { startMs, endMs };
}

export function nowRange() {
  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - DEFAULT_WINDOW_SECONDS;
  return {
    startMs: startSec * 1000,
    endMs: endSec * 1000
  };
}
```

### Deep-Link Test

```typescript
// chart-range.test.ts
it('deep-link round-trip: record → URL → parse → load', () => {
  // Create a record
  const record = { start_time: 1705324800, end_time: 1705411200 };
  
  // Convert to range (with padding)
  const range = recordToRange(record);
  // → { startMs: 1705238400000, endMs: 1705497600000 }
  
  // Build URL
  const url = `/charts.html?start=${range.startMs}&end=${range.endMs}`;
  
  // Parse on page load
  const parsed = parseRangeParams(`?start=${range.startMs}&end=${range.endMs}`);
  
  // Verify round-trip
  expect(parsed.startMs).toBe(range.startMs);
  expect(parsed.endMs).toBe(range.endMs);
});
```

---

## Log-Scale Toggle

### HTML

```html
<label>
  <input type="checkbox" id="log-scale"> 對數縮放
</label>
```

### JavaScript

```javascript
document.getElementById('log-scale').addEventListener('change', (e) => {
  const isLogScale = e.target.checked;
  
  // Apply to both charts
  btcSeries.priceScale().applyOptions({
    mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal
  });
  
  ethSeries.priceScale().applyOptions({
    mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal
  });
});
```

**Why both charts:** User expects a global toggle for comparison purposes.

---

## Deep-Link Button on Records Table

### HTML Button

```html
<button data-action="view-chart">查看K線</button>
```

### Event Handler

```javascript
document.querySelector('#records-table tbody').addEventListener('click', (e) => {
  if (e.target.dataset.action === 'view-chart') {
    const row = e.target.closest('tr');
    const recordId = row.dataset.id;
    const record = findRecordById(recordId);
    
    // Compute padded range
    const range = recordToRange(record);
    
    // Navigate to charts with query params
    window.location.href = `/charts.html?start=${range.startMs}&end=${range.endMs}`;
  }
});
```

---

## Parameter Validation & Fallback

### Safe Parsing

```javascript
// charts.js
const params = parseRangeParams(window.location.search);
const range = params || nowRange();  // Fallback to 30-day default

loadRange(range.startMs, range.endMs);
```

**Scenarios:**
- Valid `?start=X&end=Y` → Load custom range
- Invalid params (missing, non-numeric, inverted) → Load default 30 days
- No params → Load default 30 days
- **No errors:** Graceful degradation

---

## Troubleshooting

### Deep Link Doesn't Load
1. Check URL has `?start=X&end=Y` (exact params)
2. Verify values are numbers (not `undefined`)
3. Verify `start < end`
4. If invalid: fallback to 30-day default (no error banner)

### Log-Scale Not Toggling Both Charts
1. Verify both `btcSeries` and `ethSeries` exist
2. Check `PriceScaleMode.Logarithmic` is available (LWC v5+)
3. Verify checkbox `change` listener is wired

### Pickers Don't Update on Year/Month Change
1. Ensure `rebuildDays()` is called
2. Verify listener is wired to year/month selects
3. Check current day value doesn't exceed max days (e.g., Feb 31)

---

**Status:** ✅ COMPLETE | **Verdict:** Deep links work end-to-end. All SC met.

Last Updated: 2026-08-31
