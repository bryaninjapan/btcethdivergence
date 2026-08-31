---
phase: 7
title: "Chart Navigation & Deep Links — Implementation Notes"
date: 2026-08-31
---

# Phase 7 Implementation Notes

Reference for deep-link routing, log-scale toggling, and range parameterization.

---

## Deep-Link Architecture

### Flow: Record → Charts

```
1. User clicks "查看K線" button on record row
   ↓
2. Button handler computes padded range: recordToRange(record)
   ↓
3. Navigate to /charts.html?start=X&end=Y
   ↓
4. Charts page loads, parses URL: parseRangeParams(window.location.search)
   ↓
5. Load klines for [start, end] range
   ↓
6. Render both charts + sync
```

### URL Format

```
/charts.html?start=1705238400000&end=1705497600000
              ↑ milliseconds since epoch ↑
```

**Why milliseconds?** Matches `Date.getTime()` output; easier for frontend date handling.

---

## Padding Strategy: ±24 Hours

### Rationale

A divergence record spans `[start_time, end_time]`. To give context:
- **Before:** Show 24 hours before the divergence started
- **After:** Show 24 hours after it ended

```javascript
// Record: 2024-01-15 12:00 → 2024-01-16 04:00 (16 hours)
// With padding:
//   Start: 2024-01-14 12:00 (24h before)
//   End:   2024-01-17 04:00 (24h after)
// Total window: 64 hours (enough context to see surrounding market movement)

export function recordToRange(record) {
  const PADDING_SECONDS = 24 * 3600;
  
  const startSec = record.start_time - PADDING_SECONDS;  // 24h before
  const endSec = record.end_time + PADDING_SECONDS;      // 24h after
  
  return {
    startMs: startSec * 1000,
    endMs: endSec * 1000
  };
}
```

---

## Parameter Parsing & Validation

### Safe Parsing (Reject Invalid Input)

```javascript
export function parseRangeParams(searchString) {
  // Step 1: Extract start/end from URL
  const params = new URLSearchParams(searchString);
  const startStr = params.get('start');
  const endStr = params.get('end');
  
  // Step 2: Both must exist
  if (!startStr || !endStr) {
    return null;  // Missing params
  }
  
  // Step 3: Parse to numbers
  const startMs = parseInt(startStr, 10);
  const endMs = parseInt(endStr, 10);
  
  // Step 4: Validate
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;  // Not valid numbers (includes NaN, Infinity)
  }
  
  if (startMs >= endMs) {
    return null;  // Invalid range (start not before end)
  }
  
  if (endMs - startMs > 365 * 24 * 3600 * 1000) {
    return null;  // Too large (>1 year; probably accidental)
  }
  
  // Step 5: Return validated range
  return { startMs, endMs };
}
```

### Usage (Graceful Fallback)

```javascript
// On charts page load
const customRange = parseRangeParams(window.location.search);
const range = customRange || nowRange();  // Fallback to 30 days

loadRange(range.startMs, range.endMs);
```

**Result:** Bad URLs = graceful fallback, not errors.

---

## Log-Scale Toggle

### Lightweight Charts v5 API

```typescript
// Before: Normal (linear) scale
btcSeries.priceScale().applyOptions({
  mode: PriceScaleMode.Normal  // 0
});

// After: Logarithmic scale
btcSeries.priceScale().applyOptions({
  mode: PriceScaleMode.Logarithmic  // 1
});
```

### Both Charts Toggle

```javascript
function setLogScale(enabled) {
  const mode = enabled ? LightweightCharts.PriceScaleMode.Logarithmic
                       : LightweightCharts.PriceScaleMode.Normal;
  
  // Apply to BTC
  btcSeries.priceScale().applyOptions({ mode });
  
  // Apply to ETH
  ethSeries.priceScale().applyOptions({ mode });
}

// Wire checkbox
document.getElementById('log-scale').addEventListener('change', (e) => {
  setLogScale(e.target.checked);
});
```

### Why Both?

For ratio analysis (BTC vs ETH), log scale on both allows direct visual comparison:
- Linear: large numbers dominate visually (BTC ~40K vs ETH ~2K)
- Log: both get equal visual space regardless of absolute price

---

## Dynamic Day Options (UTC Pickers)

### The Problem

If user selects 2024-02-30 (Feb has 29 days in 2024), it rolls over to March 1.

### Solution: Rebuild Days on Year/Month Change

```javascript
function rebuildDays(prefix) {
  const year = parseInt(document.getElementById(`${prefix}-year`).value);
  const month = parseInt(document.getElementById(`${prefix}-month`).value);
  
  const daySelect = document.getElementById(`${prefix}-day`);
  const currentDay = parseInt(daySelect.value);
  
  // Clear old options
  daySelect.innerHTML = '';
  
  // Generate valid days for this month
  const maxDays = daysInMonth(year, month);
  for (let d = 1; d <= maxDays; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = String(d).padStart(2, '0');
    daySelect.appendChild(opt);
  }
  
  // Restore previous day if valid; otherwise use 1
  if (currentDay <= maxDays) {
    daySelect.value = currentDay;
  } else {
    daySelect.value = 1;
  }
}

// Wire listeners
document.getElementById('start-year').addEventListener('change', () => rebuildDays('start'));
document.getElementById('start-month').addEventListener('change', () => rebuildDays('start'));
```

---

## Testing Deep Links

### Unit Test: Round-Trip

```typescript
// chart-range.test.ts
it('record → range → URL → parse → back to range', () => {
  // Original record
  const record = {
    id: 1,
    start_time: 1705324800,   // 2024-01-15 12:00 UTC
    end_time: 1705411200      // 2024-01-16 12:00 UTC
  };
  
  // Step 1: Record → Range (with ±24h padding)
  const range = recordToRange(record);
  expect(range.startMs).toBe((1705324800 - 86400) * 1000);  // 24h before
  expect(range.endMs).toBe((1705411200 + 86400) * 1000);    // 24h after
  
  // Step 2: Range → URL
  const url = `?start=${range.startMs}&end=${range.endMs}`;
  
  // Step 3: URL → Parse
  const parsed = parseRangeParams(url);
  
  // Step 4: Verify round-trip
  expect(parsed).toEqual(range);
});
```

### E2E Test: Deep Link Navigation

```typescript
// e2e/deep-link.spec.ts (Playwright)
test('record deep link loads correct chart range', async ({ page }) => {
  // Navigate to records page
  await page.goto('https://localhost/');
  
  // Find a record row
  const record = await page.locator('tr[data-id="8"]').first();
  
  // Get start/end times from row
  const startText = await record.locator('td').nth(0).textContent();
  const endText = await record.locator('td').nth(1).textContent();
  
  // Click "查看K線" button
  const viewChartBtn = record.locator('button[data-action="view-chart"]');
  await Promise.all([
    page.waitForNavigation(),
    viewChartBtn.click()
  ]);
  
  // Verify we're on charts page
  expect(page.url()).toContain('/charts.html?start=');
  
  // Verify range summary reflects the padded window
  const summary = await page.locator('#range-summary').textContent();
  const expectedStart = new Date(new Date(startText).getTime() - 24*3600*1000).toISOString();
  const expectedEnd = new Date(new Date(endText).getTime() + 24*3600*1000).toISOString();
  
  expect(summary).toContain(expectedStart.split('T')[0]);  // Date part
  expect(summary).toContain(expectedEnd.split('T')[0]);
  
  // Verify sync works on deep-linked range
  const btcRange = await page.evaluate(() => 
    window.btcChart.timeScale().getVisibleLogicalRange()
  );
  const ethRange = await page.evaluate(() =>
    window.ethChart.timeScale().getVisibleLogicalRange()
  );
  
  expect(btcRange.from).toBe(ethRange.from);
  expect(btcRange.to).toBe(ethRange.to);
});
```

---

## Error Handling

### Invalid Deep Link

```javascript
// charts.js on page load
const customRange = parseRangeParams(window.location.search);
if (!customRange) {
  console.warn('Invalid URL params; using default 30-day window');
  // No error banner (graceful fallback)
}

const range = customRange || nowRange();
loadRange(range.startMs, range.endMs);
```

**Example:**
- URL: `/charts.html?start=invalid&end=123`
- Parse result: `null`
- Behavior: Load 30-day default (silent, no error)

### Out-of-Range Navigation

```javascript
// Load range beyond available data
// E.g., deep link to 1970 (no klines from then)

const response = await api(`/api/klines?start=0&end=3600`);
// API returns: [] (no rows)

// Charts render with empty data
btcSeries.setData([]);  // Empty series
// Sync still works (no errors)
```

---

**Last Updated:** 2026-08-31
