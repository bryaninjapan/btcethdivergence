# Phase 8 Learning — Leverage Calculator

**Phase**: 8 — Leverage Calculator
**Date**: 2026-08-31
**Status**: Execution Complete, Code Review Findings Documented

---

## Overview

Phase 8 delivered a fully client-side leverage calculator with real-time position-sizing math and risk warnings. The core calculation engine is production-ready. Code review identified navigation gaps and a DOM-layer bug that require fixes before shipping.

---

## Planning Cycle: Warnings & Info

### Round 1 Plan Check (08:39)

**4 Warnings (all addressed inline)**

| Warning | Issue | Resolution |
|---------|-------|------------|
| **W-1** | `records.html` references should be `index.html (served at /)` | ✅ Changed in plan |
| **W-2** | Leverage dropdown omits 20x (required by CALC-04) | ✅ Added to list (line 69) |
| **W-3** | Module loader wiring location ambiguous | ✅ Pinned to `calculator-init.js` |
| **W-4** | Task count contradiction (08-04 in remaining tasks) | ✅ Merged into verification track |

**4 Info (optional improvements)**
- I-1: No typecheck step for new `.test.ts` file
- I-2: Position-size unit ambiguity (USDT vs coins)
- I-3: SC5 "no api.js" guarantee implied, not stated
- I-4: Stylesheet link and dropdown-listener type unspecified

### Round 2 Plan Check (08:41)

**2 Warnings**

| Warning | Issue | Fix Applied |
|---------|-------|-------------|
| **W-1** | Browser module import `public/js/calculator.js` → 404 | ✅ Changed to `./calculator.js` |
| **W-2** | Task count + coverage target conflicts | ✅ Unified to ≥95%, removed 08-04 refs |

**6 Info**
- I-1: No typecheck (matches repo pattern; optional)
- I-2: Position-size unit/precision ambiguity
- I-3: SC5 manual-only verification (DevTools Network)
- I-4: No stylesheet `<link>` listed in HTML deliverable
- I-5: Coverage target not wired to command (fixed in execution)
- I-6: 08-03 "Files Modified" omits test files

### Round 3 Plan Check (08:45)

**1 Warning**

| Warning | Issue | Action |
|---------|-------|--------|
| **W-1** | E2E checkpoint 4 expected profit values wrong | ✅ Executor fixed during implementation |

**Detail**: Checkpoint 4 claimed profit ~11.9 at TP 42100, but actual = 2.38. Fixed to use TP 42500 (profit 11.9, R:R=1.0) → TP 42400 (profit 9.5, R:R=0.8) to demonstrate R:R < 1.0 transition.

**6 Info**
- I-1: New `calculator.test.ts` not tracked by typecheck
- I-2: Position-size unit ambiguity (coin vs USDT)
- I-3: SC5 guarantee structurally enforced but manually verified
- I-4: Dropdown contents and stylesheet link implicit
- I-5: Coverage target ≥95% (not wired to command) — **FIXED in execution** via `test:coverage` script
- I-6: 08-03 files list omission — **FIXED in execution**

---

## Execution Phase: Code Review Findings

**Review Date**: 2026-08-31  
**Verdict**: **WARNING** — 0 CRITICAL, 3 HIGH, 3 MEDIUM, 3 LOW

### HIGH Findings (Production Blockers)

**H1 — Calculator page not linked from navigation**
- **Files**: `public/index.html` (header nav), `public/charts.html` (header nav)
- **Issue**: Neither the records page nor the charts page link to `/calculator.html`. Feature is unreachable except by typing the URL directly.
- **Impact**: High discoverability failure; users cannot discover the new calculator through the UI.
- **Fix**: Add navigation links to `/calculator.html` in both `index.html` and `charts.html` headers (and vice versa for full round-trip navigation).

**H2 — Misleading "0" values on invalid input** ⚠️ **Real Bug**
- **File**: `public/js/calculator-init.js:61-75` (render function)
- **Issue**: When input is invalid (e.g., long position with stop-loss above entry), `calculatePosition` returns `isValid: false` and numeric fields default to 0. The `render()` function writes these zeros to the DOM *before* checking `isValid`, showing "0 / 0.00 / 0.0%" alongside the error message.
- **Impact**: CRITICAL for financial tool — misleads trader into thinking "position size zero" instead of "invalid calculation". Conflates two distinct UI states.
- **Fix**: Gate numeric writes on `result.isValid`, falling back to `"—"` placeholders:
  ```javascript
  function render(result) {
    const dash = (fmt, value) => (result.isValid ? fmt(value) : '—');
    el('position-size').textContent = dash(formatQuantity, result.positionSize);
    // ... apply to all numeric fields
    el('calc-error').hidden = result.isValid;
    errorEl.textContent = result.isValid ? '' : (result.errorMessage || '輸入無效...');
  }
  ```

**H3 — calculator-init.js has zero test coverage**
- **File**: `public/js/calculator-init.js`, `package.json` (`test:coverage` script)
- **Issue**: Coverage gate scoped to `calculator.js` only via `--coverage.include='public/js/calculator.js'`. All DOM wiring, formatting (`formatQuantity`, `trimZeros`, `formatPercent`), and `render()`/`clearResults()` logic in `calculator-init.js` is completely untested.
- **Impact**: H2 bug above went undetected because the buggy file has no unit tests. 22 tests in `calculator.test.ts` cover only the pure module.
- **Fix**: Add `calculator-init.test.ts` with jsdom tests covering:
  - `formatQuantity`/`formatAmount`/`trimZeros` edge cases (zero, 1e4/1e6 boundaries, trailing zeros)
  - `isComplete()` logic
  - `render()` for both valid and invalid results (catches H2)
  - Broaden `--coverage.include` to cover both files, or add second coverage command for `calculator-init.js`

### MEDIUM Findings

**M1 — Dead code in normalizeDirection**
- **File**: `public/js/calculator.js:66-69`
- **Issue**: `value === false` branch is unreachable (UI always supplies string `'long'`/`'short'`), untested, and undocumented.
- **Fix**: Remove the `=== false` check or add comment + test explaining the use case.

**M2 — Missing aria-live for accessibility**
- **File**: `public/calculator.html:69-97` (results grid, warning banners)
- **Issue**: Screen-reader users won't hear live-updated values or new warnings as they type.
- **Fix**: Add `aria-live="polite"` to `.results-grid`, `#calc-error`, and warning divs.

**M3 — Liquidation warning is approximation, not definitive**
- **File**: `public/js/calculator.js:61`, `public/calculator.html:97`
- **Issue**: `liquidationRisk = lossAmount > margin` is a heuristic; real liquidation depends on maintenance margin, funding, fees. UI copy doesn't note this is an estimate.
- **Fix**: Add disclaimer (e.g., "估算值，實際強平價依交易所維持保證金率而定").

### LOW Findings

**L1 — Task description says "21 vitest cases"; actual is 22**
- Non-functional; documentation drift.

**L2 — `trimZeros` regex untested**
- Covered by H3 fix (add `calculator-init.test.ts`).

**L3 — All copy is Traditional Chinese, no i18n layer**
- Consistent with rest of app; noted for future if multi-locale support needed.

---

## Security Review

✅ **No security vulnerabilities**:
- No hardcoded secrets
- No `fetch` calls (enforced by test CALC-07)
- No `innerHTML` or `insertAdjacentHTML` — all DOM writes via `textContent` (XSS-safe)
- All numeric inputs validated via `Number.isFinite()` + range/sign checks before use
- No injection surface (no server round-trip)

---

## Core Calculation Engine

✅ **Production-Ready**:
- Formulas verified for both long/short directions
- No division-by-zero paths
- 22 vitest tests all passing
- 100% coverage on `calculator.js` (lines/branches/functions/statements)
- Edge cases handled: zero inputs, invalid ranges, leverage boundaries

---

## Summary of Fixes Applied During Execution

| Fix | Status | Impact |
|-----|--------|--------|
| E2E checkpoint 4 values corrected (W-1 Round 3) | ✅ Applied | Plan now matches actual formulas |
| `test:coverage` script added (I-5 Round 2) | ✅ Applied | Coverage gate now measurable |
| 08-03 files list expanded (I-6 Round 2) | ✅ Applied | Plan now complete |

---

## Remaining Fixes (Post-Execution Code Review)

**Must fix before shipping**:
1. **H1** — Add navigation links from index.html and charts.html to calculator
2. **H2** — Fix render() to show "—" instead of "0" on invalid input
3. **H3** — Add calculator-init.test.ts with DOM/formatting tests

**Should fix**:
- M1: Remove or document dead `=== false` branch
- M2: Add `aria-live` regions for accessibility
- M3: Add liquidation-risk disclaimer

**Optional**:
- L1: Update task description (21→22)
- L2/L3: Covered by H3; i18n is future work

---

## Test Coverage

- **calculator.js**: 22 vitest tests, 100% coverage (lines/branches/functions/statements)
- **calculator-init.js**: 0 tests (H3 blocker — add jsdom-based tests)
- **Public integration**: 109 total tests passing (87 baseline + 22 new)

**Coverage command**:
```bash
npm run test:coverage
# Output: calculator.js 100% (all metrics)
```

---

## Commits

```
6a41f23 feat(phase-8): scaffold leverage calculator page and styles (task 08-01)
0051afe feat(phase-8): add pure calculation engine and real-time form wiring (task 08-02)
a7c63f8 feat(phase-8): harden validation with actionable errors, expand tests, wire coverage gate (task 08-03)
```

---

## Next Steps

1. **Fix H1, H2, H3** (navigation, render bug, DOM tests) before marking Phase 8 complete
2. Run UAT (`/gsd-verify-work 8`) to validate fixes
3. Consider M1–M3 improvements for robustness
4. Phase 9: Shared navigation bar will address H1 at app level
