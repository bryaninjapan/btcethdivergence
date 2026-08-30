---
status: complete
phase: 07-chart-navigation-record-deep-link
source: [7-SUMMARY.md]
started: 2026-08-31T08:20:00Z
updated: 2026-08-31T08:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Log Scale Toggle
expected: |
  - No params → linear scale on both charts
  - Click "對數縮放" → both go logarithmic
  - Uncheck → both revert to linear
result: pass

### 2. Custom Date Range Load
expected: |
  - Click "載入範圍" button after setting date pickers to 2023-01-01 → 2023-02-01 UTC
  - Both charts load 745 hourly candles for the range
  - Range summary displays "2023-01-01T00:00:00Z ~ 2023-02-01T00:00:00Z (UTC)"
  - Charts are synced (pan one, other pans together)
result: pass

### 3. Record → Chart Deep Link
expected: |
  - On the records page (/), click a row's "查看K線" button
  - Navigate to /charts.html with ?start=XXX&end=YYY parameters
  - Charts load data centered on the record's time (±24 hours padding)
  - Date pickers show correct start/end dates (not reset to day 1)
  - After loading, sync works (pan/zoom both charts together)
result: pass

### 4. No-Parameters Fallback
expected: |
  - Open /charts.html directly without ?start/end parameters
  - Charts load with the default 30-day window (from today backwards)
  - No console errors or loading failures
result: pass

### 5. Malformed Parameters Fallback
expected: |
  - Open /charts.html?start=abc&end=xyz (invalid parameters)
  - Charts fall back to default 30-day window (not undefined or error state)
  - No console errors
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
