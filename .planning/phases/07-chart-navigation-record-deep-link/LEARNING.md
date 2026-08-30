# Phase 7 Code Review Learnings

## Overview
Phase 7 delivered chart navigation with record deep-linking. Code review identified 4 issues (1 HIGH, 1 MEDIUM, 2 LOW). All fixed via TDD approach.

## Issues & Fixes

### HIGH: Chart-Sync Unsubscribe Broken
**Problem**: `subscribeVisibleLogicalRangeChange` in real LWC API returns `undefined`, not an unsubscribe function. Test mock was wrong, masking the issue. Handlers accumulated on each `loadRange()` call, causing memory leak and jank.

**Root Cause**: Mock returned unsubscribe function; real API returns void. Unsubscribe is a separate method call.

**Fix** (commit 0ed343e):
```javascript
// FakeTimeScale now matches real LWC API
subscribeVisibleLogicalRangeChange(fn) {
  this.handlers.push(fn);
  return undefined;  // Real API returns void
}
unsubscribeVisibleLogicalRangeChange(fn) {
  this.handlers = this.handlers.filter(h => h !== fn);
}

// chart-sync.js now uses separate unsubscribe method
return () => from.unsubscribeVisibleLogicalRangeChange(handler);
```

### MEDIUM: Race Condition on Rapid loadRange()
**Problem**: Calling `loadRange()` rapidly without waiting for previous request to finish could cause race condition where older request completes after newer one, overwriting data with stale candles.

**Fix** (commit 2bea97d):
```javascript
let activeController = null;

async function loadRange(startMs, endMs) {
  if (activeController) activeController.abort();  // Cancel prior request
  const controller = new AbortController();
  activeController = controller;  // Track current request
  // ... rest of function
  finally {
    activeController = null;  // Clean up on completion
  }
}
```

**Consequence**: Each new `loadRange()` call immediately cancels in-flight requests, preventing data collision.

### LOW-1: timeoutId Not Cleared on Error
**Problem**: If `Promise.all()` throws (e.g., network error), `clearTimeout(timeoutId)` was in try block and never executed.

**Fix** (commit 2bea97d):
Moved `clearTimeout(timeoutId)` to `finally` block so it always runs.

### LOW-2: init() Missing Error Handler
**Problem**: Top-level `init()` call on page load had no `.catch()`. If `loadRange()` fails during init, error displays in UI but no console error for debugging.

**Fix** (commit 2bea97d):
```javascript
init().catch((error) => {
  console.error('Charts initialization failed:', error);
  const errorEl = document.getElementById('chart-error');
  if (errorEl) {
    errorEl.textContent = `圖表初始化失敗：${error.message}`;
    errorEl.hidden = false;
  }
});
```

## Test Coverage
All 87 vitest tests passing:
- chart-sync: 9 tests (unsubscribe, re-entrancy, rapid-fire, exception-safety)
- chart-range: 10 tests (record→range padding, URL parsing)
- Full test suite: `npm test`

## Key Learnings

1. **Mock Correctness**: Test mocks must match real API signatures exactly. LWC returns `void` from subscribe, not an unsubscribe function.

2. **Finally Block Discipline**: Resource cleanup (timers, abort controllers) must go in `finally` blocks, not try blocks.

3. **Request Cancellation**: High-frequency operations (user interactions) need AbortController tracking to prevent race conditions on fast successive calls.

4. **Top-Level Error Handling**: Page-level async initialization should always have `.catch()` for debugging and user feedback.

## Warnings Resolved

### W1: Date Picker Reset to Day 1
**Problem**: `setPickerFromEpoch` set day value before `rebuildDays` was called, so day options were still empty. Deep links would show day 1 instead of actual date.

**Fix** (commit 801af00):
Reorder operations to populate day options via `rebuildDays()` before setting day value.

**Before**:
```javascript
setPickerFromEpoch(...) {
  fillSelect(year); fillSelect(month); fillSelect(hour);
  set year.value, month.value, day.value, hour.value;  // ← day select empty yet
  rebuildDays(pickerEl);  // ← options populated too late
}
```

**After**:
```javascript
setPickerFromEpoch(...) {
  fillSelect(year); fillSelect(month); fillSelect(hour);
  set year.value, month.value, hour.value;
  rebuildDays(pickerEl);  // ← options populated first
  set day.value;  // ← now day select has options
}
```

### W2: Sync Links Permanently Broken on Load Failure
**Verified as non-blocking**: Finally block (lines 142-149 in charts.js) always re-subscribes sync links regardless of success/error. Load failures properly restore sync state.

**Design rationale**: Unsubscribe old links first (lines 111-112) to prevent handler accumulation. Then finally block re-subscribes unconditionally.

### Unaddressed Warnings
1. **SC2 full-history test coverage** (~48K candles) — No explicit browser test. Tests exist but not documented as covering this scale.
2. **parseRangeParams description inconsistency** — Text vs code alignment (non-functional).

## Commits
- 0ed343e: HIGH fix — chart-sync unsubscribe
- 2bea97d: MEDIUM + LOW fixes — race condition, timeout cleanup, init error handling
- 801af00: W1 fix — date picker day value order

## Verification
```bash
npm test                    # All 87 tests ✓
npm run typecheck          # Type check ✓
npm run build              # Build succeeds ✓
```
