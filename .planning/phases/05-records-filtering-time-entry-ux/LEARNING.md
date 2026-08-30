# Phase 5 Learnings — Records Filtering & Time-Entry UX

**Date**: 2026-08-31  
**Source**: Code Review findings  
**Status**: Issues identified; fixes pending

## Critical Issues Found

### 🔴 HIGH-01: Unhandled Promise Rejections in Filter Bar
**File**: `public/js/records.js:227`  
**Issue**: Filter operations (type/tag search) don't handle fetch failures.

**Current Code Problem**:
```javascript
// WRONG - no error handler
api(`/api/records?type=${type}&tags=${searchTags}`).then(rows => {
  recordsCache = rows;
  renderTable(rows);
});
```

**Impact**:
- Network failures silently fail
- User sees no error message or feedback
- Table remains stale with old data
- No indication that the filter failed

**Fix Required**:
```javascript
api(`/api/records?type=${type}&tags=${searchTags}`)
  .then(rows => {
    recordsCache = rows;
    renderTable(rows);
  })
  .catch(error => {
    const filterError = document.getElementById('filter-error');
    if (filterError) {
      filterError.textContent = `篩選失敗：${error.message}`;
      filterError.hidden = false;
    }
  });
```

**Learning**: Every async operation that touches the DOM must have a `.catch()` or try/catch, especially user-facing actions like filtering.

---

### 🔴 HIGH-02: Hardcoded Year Range Blocks 2027+
**File**: `public/js/datetime.js:1`  
**Issue**: Year options hardcoded as 2021-2026.

**Current Code**:
```javascript
export function yearOptions() {
  return [2021, 2022, 2023, 2024, 2025, 2026];  // HARDCODED!
}
```

**Impact**:
- **In 4 months** (2026-12-31 → 2027-01-01), users cannot select 2027
- Cannot record divergences with 2027+ dates
- Time picker will break for any date picker after December 2026
- Phase 5 requirement REC-08 ("time inputs explicitly labeled UTC") fails when the year picker is incomplete

**Fix Required**:
```javascript
export function yearOptions() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const start = 2021;
  const years = [];
  for (let y = start; y <= currentYear + 1; y++) {
    years.push(y);
  }
  return years;
}
```

Or simpler:
```javascript
export function yearOptions() {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: currentYear - 2021 + 2 }, (_, i) => 2021 + i);
}
```

**Learning**: Never hardcode dates, ranges, or year windows. Always compute relative to the current date. This is especially critical for time-picker UX in long-lived applications.

---

### 🟡 MEDIUM-01: LIKE Wildcards Not Escaped in Tag Filter
**File**: `src/lib/db.ts:17`  
**Issue**: Tag filter searches use SQL LIKE without escaping special characters.

**Current Code Problem**:
```typescript
// WRONG - wildcards not escaped
const tags = tagSearchInput.value;  // e.g., "50%"
db.prepare(`SELECT * FROM records WHERE tags LIKE ?`).all(tags);
// SQL sees: SELECT * FROM records WHERE tags LIKE '50%'
// Matches '500', '50x', '5050' — everything ending in 0!
```

**Impact**:
- User searches for `"50%"` → finds all tags ending in `0` (wrong matches)
- User searches for `"v1_beta"` → finds all tags matching `v1Xbeta` (X = any char)
- No actual security risk (parameterized query prevents injection), but results are silently wrong
- Users blame the app ("search is broken"), not realizing the wildcard interpretation

**LIKE Wildcard Rules**:
- `%` matches any sequence of characters
- `_` matches exactly one character
- Must escape with `\` before using literal

**Fix Required**:
```typescript
export function escapeWildcards(str: string): string {
  return str.replace(/[%_]/g, '\\$&');  // Escape % and _
}

// In query:
const escapedTags = escapeWildcards(tagSearchInput.value);
db.prepare(`SELECT * FROM records WHERE tags LIKE ? ESCAPE '\\'`).all(`%${escapedTags}%`);
// Now "50%" searches literally for "50%" substring, not "ending in 0"
```

**Learning**: LIKE queries are not SQL injection risks (parameterized), but wildcard characters are still user input that affects the query logic. Always escape user input before using it in LIKE patterns.

---

### 🟡 MEDIUM-02: Out-of-Order Filter Responses (Race Condition)
**File**: `public/js/records.js:72`  
**Issue**: Multiple filter requests can resolve in different order than they were sent.

**Scenario**:
```
User keystroke 1 (fast): api() → slow response, resolves at t=200ms
User keystroke 2 (slow): api() → fast response, resolves at t=50ms
             ↓
Render keystroke 2 result at t=50ms (correct)
Render keystroke 1 result at t=200ms (overwrites with STALE data!) ❌
```

**Current Code Problem**:
```javascript
// WRONG - no ordering guarantee
input.addEventListener('input', debounce(() => {
  api(`/api/records?tags=${input.value}`).then(rows => {
    recordsCache = rows;
    renderTable(rows);  // Could be stale!
  });
}, 300));
```

**Impact**:
- User types fast: `"A"` → `"AB"` → `"ABC"`
- If the request for `"AB"` is slower than `"ABC"`, user sees results for `"AB"` after seeing `"ABC"` (flickering or wrong data)
- Silent data corruption; user may not notice they're looking at old results
- Hard to reproduce and debug

**Fix Required** (AbortController pattern):
```javascript
let abortController = null;

input.addEventListener('input', debounce(() => {
  if (abortController) abortController.abort();  // Cancel prior request
  abortController = new AbortController();

  api(`/api/records?tags=${input.value}`, { signal: abortController.signal })
    .then(rows => {
      recordsCache = rows;
      renderTable(rows);
    })
    .catch(error => {
      if (error.name === 'AbortError') return;  // Ignore cancellations
      // Handle real errors
    });
}, 300));
```

Or use a **request counter**:
```javascript
let requestId = 0;

input.addEventListener('input', debounce(() => {
  const currentId = ++requestId;
  api(`/api/records?tags=${input.value}`).then(rows => {
    if (currentId === requestId) {  // Only update if this is the latest request
      recordsCache = rows;
      renderTable(rows);
    }
  });
}, 300));
```

**Learning**: Debouncing prevents too many requests, but doesn't prevent out-of-order responses. Always use either AbortController or a request ID to ensure only the latest response is rendered.

---

## Summary

| Severity | Count | Pattern |
|----------|-------|---------|
| 🔴 HIGH | 2 | Missing error handling, hardcoded time windows |
| 🟡 MEDIUM | 2 | SQL wildcard escaping, race conditions |
| 🟢 LOW | 0 | — |

**No security issues**: SQL injection, XSS, and secret leaks all clear.

## Recommendations for Phase 6+

1. **Add error boundaries**: Every `api()` call in public-facing code must have a `.catch()` block with user-facing error UI.
2. **Make time pickers dynamic**: Never hardcode year ranges. Always generate relative to `Date.now()`.
3. **Escape special chars in searches**: Document that LIKE queries need wildcard escaping; provide a reusable `escapeWildcards(str)` utility.
4. **Prevent filter race conditions**: Use AbortController or request IDs in all debounced filter operations.

## Session Notes

- Phase 5 met all success criteria (REC-05/06/07/08)
- All requirements were delivered
- Code review found 4 issues that don't block Phase 6 but should be fixed before shipping
- No regressions from Phase 4
