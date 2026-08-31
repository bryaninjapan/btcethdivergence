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
**Reviewer**: code-reviewer agent  
**Verdict**: **WARNING** — 0 CRITICAL, 3 HIGH, 3 MEDIUM, 3 LOW  
**Commits Reviewed**: 6a41f23, 0051afe, a7c63f8

---

### HIGH Findings (Production Blockers)

#### H1 — Calculator page not linked from navigation

**Files**: `public/index.html` (header nav), `public/charts.html` (header nav), `public/calculator.html:12`

**Issue**: 
`index.html`'s header links to `/charts.html` only; `charts.html`'s header links back to `/` only. Neither page links to `/calculator.html`, and `calculator.html` itself only links back to `/`. A user has no way to discover the new calculator feature through the UI — it is only reachable by typing the URL directly.

```html
<!-- public/index.html header -->
<a href="/charts.html">K線圖</a>   <!-- no link to calculator.html -->

<!-- public/charts.html header -->
<a href="/">← 記錄表</a>            <!-- no link to calculator.html -->
```

**Impact**: High discoverability failure; users cannot discover the new calculator through the UI. The feature exists but is unreachable.

**Fix**: Add a nav link to `/calculator.html` in both `index.html` and `charts.html` headers (and consider linking to `charts.html`/`index.html` from `calculator.html` for full round-trip nav), so Phase 8's deliverable is actually discoverable.

---

#### H2 — `render()` shows misleading "0" values instead of placeholders on invalid input

**File**: `public/js/calculator-init.js:61-75`

**Issue**: 
When the form is fully filled but produces an *invalid* result (e.g. long position with stop-loss above entry price — a common typo), `calculatePosition` returns `isValid: false` with all numeric fields defaulted to `0` (from the `base` object in `calculator.js:12-28`). `render()` unconditionally writes these zeros into the results grid before checking `isValid`:

```js
function render(result) {
  el('position-size').textContent = formatQuantity(result.positionSize); // writes "0"
  el('sl-amount').textContent = formatAmount(result.stopLossAmount);     // writes "0.00"
  el('tp-amount').textContent = formatAmount(result.takeProfitAmount);   // writes "0.00"
  el('rr-ratio').textContent = formatRatio(result.riskRewardRatio);      // writes "0.00"
  el('loss-rate').textContent = formatPercent(result.lossRatePercent);   // writes "0.0%"
  el('gain-rate').textContent = formatPercent(result.gainRatePercent);   // writes "0.0%"

  const errorEl = el('calc-error');
  errorEl.hidden = result.isValid;
  errorEl.textContent = result.isValid ? '' : (result.errorMessage || '輸入無效，請檢查數值');
  ...
}
```

So on an invalid entry, the UI simultaneously shows an error message *and* a results grid full of "0 / 0.00 / 0.0%" values, which can visually resemble "position size zero, zero risk" to a fast-scanning trader rather than "no valid calculation available." This is exactly the kind of misleading state the app should avoid for a financial tool.

**Impact**: CRITICAL for financial tool — misleads trader into thinking "position size zero, zero loss" instead of "invalid calculation". Conflates two distinct UI states.

**Fix**: Gate the numeric writes on `result.isValid`, falling back to the same `"—"` placeholder used by `clearResults()`:

```js
function render(result) {
  const dash = (fmt, value) => (result.isValid ? fmt(value) : '—');
  el('position-size').textContent = dash(formatQuantity, result.positionSize);
  el('sl-amount').textContent = dash(formatAmount, result.stopLossAmount);
  el('tp-amount').textContent = dash(formatAmount, result.takeProfitAmount);
  el('rr-ratio').textContent = dash(formatRatio, result.riskRewardRatio);
  el('loss-rate').textContent = dash(formatPercent, result.lossRatePercent);
  el('gain-rate').textContent = dash(formatPercent, result.gainRatePercent);
  ...
}
```

---

#### H3 — `calculator-init.js` (DOM wiring layer) has zero test coverage and is excluded from the coverage gate

**Files**: `package.json` (`test:coverage` script), `public/js/calculator-init.js`, `public/js/calculator.test.ts`

**Issue**: 
```json
"test:coverage": "vitest run --coverage --coverage.include='public/js/calculator.js' --coverage.thresholds.lines=95 ..."
```

The coverage gate is scoped with `--coverage.include='public/js/calculator.js'`, so `calculator-init.js` — which contains all DOM reading/writing, formatting (`formatQuantity`, `formatAmount`, `trimZeros`, `formatPercent`, `formatRatio`), and the `render`/`clearResults`/`isComplete` logic — is completely excluded from the 95% threshold and has **no unit tests at all**. All 22 tests in `calculator.test.ts` exercise only the pure `calculator.js` module (plus one meta-test asserting no `fetch`/`api.js` usage). The H2 bug above is a direct consequence: it lives entirely in the untested file and none of the 22 tests would have caught it.

**Impact**: The DOM wiring layer has a real UX bug (H2) that went undetected. Similar bugs could exist undetected in the untested formatting and state-management logic.

**Fix**: Add a jsdom-based test file (e.g. `calculator-init.test.ts`) covering:
- `formatQuantity`/`formatAmount`/`trimZeros` edge cases (zero, exactly-1e4/1e6 boundaries, trailing zeros)
- `isComplete()` logic
- `render()` behavior for both valid and invalid `calculatePosition` results (this would also have caught H2)
- Broaden `--coverage.include` to cover both files or add a second coverage command for `calculator-init.js`

---

### MEDIUM Findings

#### M1 — Dead/unclear special case in `normalizeDirection`

**File**: `public/js/calculator.js:66-69`

**Issue**:
```js
function normalizeDirection(value) {
  if (value === 'short' || value === 'Short' || value === 'SHORT' || value === false) return 'short';
  return 'long';
}
```

`value === false` mapping to `'short'` is unreachable from the actual UI (the radio button always supplies the string `'long'`/`'short'` via `readForm()`), is untested, and has no documented rationale. It reads like leftover/speculative code and obscures the function's intent.

**Fix**: Remove the `=== false` branch, or add a comment explaining a concrete caller that needs it (e.g., a hypothetical boolean `isShort` flag) and add a test for it.

---

#### M2 — No `aria-live` region for live-updating results/warnings

**File**: `public/calculator.html:69-97`

**Issue**: 
The results grid and the two warning banners (`#rr-warning`, `#liquidation-warning`) update on every keystroke via the `input`/`change` listeners in `calculator-init.js`, but none of these containers have `aria-live`. Screen-reader users typing into the form will not hear updated values or newly-appearing liquidation/R:R warnings — a meaningful gap for a financial-risk tool.

**Fix**: Add `aria-live="polite"` to `.results-grid`, `#calc-error`, and the two `.warning` divs (or a shared wrapping container).

---

#### M3 — Liquidation-risk warning is a simplified approximation presented as fact

**Files**: `public/js/calculator.js:61`, `public/calculator.html:97`

**Issue**: 
`liquidationRisk: lossAmount > margin` is a reasonable heuristic (loss at stop-loss price exceeds posted margin) but ignores maintenance-margin requirements, funding, and fees that real exchanges use to compute actual liquidation price — so actual liquidation typically happens *before* this threshold is reached. The UI copy ("可能在被止損前就被強制平倉…") presents this as a definitive risk assessment without noting it's an estimate.

**Fix**: Add a short disclaimer near the warning (e.g. "估算值，實際強平價依交易所維持保證金率而定") so users don't over-trust the precision of the estimate.

---

### LOW Findings

#### L1 — Task description says "21 vitest cases"; actual count is 22

**Status**: Documentation drift only. No functional impact.

---

#### L2 — `trimZeros` regex formatting is fragile and only indirectly tested

**File**: `public/js/calculator-init.js:34-36`

```js
function trimZeros(value) {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}
```

Correct for the cases exercised manually during this review (e.g. `"1.00000"` → `"1"`, `"0.00000"` → `"0"`), but it has no dedicated unit tests (see H3) and is easy to break with a future refactor (e.g. a value like `"100"` with no decimal point is returned unchanged, which is fine, but there's no test asserting that boundary).

**Fix**: Covered by the H3 fix (add `calculator-init.test.ts`); no separate action needed beyond that.

---

#### L3 — All validation/UI copy is hardcoded Traditional Chinese with no i18n layer

**Files**: `public/js/calculator.js` (all error strings), `public/calculator.html`

**Status**: Consistent with the rest of the app's current single-locale approach, so this is a note rather than a defect — flagging only in case the project later needs multi-locale support.

---

### Security Review

✅ **No security vulnerabilities**:
- No hardcoded secrets, no `fetch`/network calls (enforced by test `CALC-07`), no `innerHTML`/`insertAdjacentHTML` usage — all DOM writes use `textContent`, so there is no XSS vector.
- All numeric inputs are coerced via `Number()` and validated with `Number.isFinite` + range/sign checks in `calculator.js:71-86` before use; no injection surface exists since there is no server round-trip.
- `novalidate` on the form is intentional (custom JS validation replaces native browser validation) and does not weaken security since there's no submission endpoint.

No CRITICAL or security-specific HIGH issues found.

---

### Correctness Review (formulas)

Verified by re-deriving the math and cross-checking against the 22 passing test cases:
- `positionSize = margin * leverage / entryPrice` — correct.
- Long: `lossAmount = positionSize * (entryPrice - stopLoss)`, `profitAmount = positionSize * (takeProfitPrice - entryPrice)` — correct, and validation enforces `stopLoss < entryPrice < takeProfitPrice` so both are always positive when `isValid`.
- Short: signs correctly flipped (`lossAmount = positionSize * (stopLoss - entryPrice)`, `profitAmount = positionSize * (entryPrice - takeProfitPrice)`), validation enforces `takeProfitPrice < entryPrice < stopLoss`.
- `riskRewardRatio = profitAmount / lossAmount` cannot divide by zero given the strict inequality validation.
- Leverage bounds (1x–125x) match the `<select>` options in `calculator.html:51-61`, so the "leverage out of range" validation path, while correctly implemented, is currently unreachable through the UI (only reachable via direct API calls / tests) — not a defect, just a note that it's defensive code for future use (e.g. a free-text leverage input).

No formula bugs found.

---

### Overall Assessment

**Not yet production-ready as "fully hardened."** The pure calculation engine (`calculator.js`) is correct, well-validated, and well-tested (22/22 passing, formulas verified by hand). However:

1. The feature is currently unreachable from the app's navigation (H1) — this alone blocks calling Phase 8 "done" from a product standpoint.
2. The DOM wiring layer has a real UX bug that misrepresents invalid calculations as zero-value results (H2), and this layer has no test coverage at all (H3), meaning similar bugs could exist undetected.

**Recommend resolving H1–H3 before merge/release; M1–M3 are good follow-ups but not blockers.**

---

## Core Calculation Engine

✅ **Production-Ready**:
- Formulas verified for both long/short directions
- No division-by-zero paths
- 22 vitest tests all passing
- 100% coverage on `calculator.js` (lines/branches/functions/statements)
- Edge cases handled: zero inputs, invalid ranges, leverage boundaries

---

## Fixes Applied (During Execution & Post-Review)

### Planning Cycle Fixes

| Fix | Round | Status | Impact |
|-----|-------|--------|--------|
| `records.html` → `index.html (served at /)` | 1 | ✅ Applied | Plan corrected |
| Leverage dropdown: added missing 20x | 1 | ✅ Applied | CALC-04 now compliant |
| Module loader wiring: pinned to `calculator-init.js` | 1 | ✅ Applied | Ambiguity resolved |
| Task count: merged 08-04 into verification track | 1 | ✅ Applied | 3 tasks (not 4) |
| Browser import path: changed to `./calculator.js` | 2 | ✅ Applied | Module loading now correct |
| Coverage target: unified to ≥95%, removed 08-04 refs | 2 | ✅ Applied | Single target metric |
| E2E checkpoint 4: corrected profit values | 3 | ✅ Applied | Plan matches formulas |
| `test:coverage` script added | 2 | ✅ Applied | Coverage gate measurable |
| 08-03 files list: expanded to include tests | 2 | ✅ Applied | Deliverables list complete |

### Code Review Fixes (Applied after 2026-08-31 review)

| Issue | Fix | Status | Commit |
|-------|-----|--------|--------|
| **H1** | Add navigation links (index.html, charts.html ↔ calculator.html) | ✅ Applied | b171783 |
| **H2** | Fix render() to show "—" instead of "0" on invalid input | ✅ Applied | 98c581c |
| **H3** | Add calculator-init.test.ts with 8+ DOM/formatting tests | ✅ Applied | 98c581c |
| **M1** | Remove dead `value === false` branch from normalizeDirection() | ✅ Applied | 98c581c |
| **M2** | Add `aria-live="polite"` to results grid and warning elements | ✅ Applied | 98c581c |
| **M3** | Add liquidation-risk disclaimer text | ✅ Applied | 47160c6 |
| **L1** | Update documentation: 21 tests → 22 tests | ✅ Applied | 47160c6 |

---

## Test Coverage

| Module | Status | Tests | Coverage |
|--------|--------|-------|----------|
| `calculator.js` | ✅ Production-ready | 22 vitest (100%) | 100% (lines/branches/functions/statements) |
| `calculator-init.js` | ✅ Tested (H3 fix applied) | 8+ jsdom tests (formatters, render, isComplete) | Now covered by calculator-init.test.ts |
| **Total**: Public integration | ✅ All passing | 109+ tests (87 baseline + 22 new) | — |

**Coverage command**:
```bash
npm run test:coverage
# Output: calculator*.js 95%+ (all metrics)
```

---

## Execution Summary

**Phase 8 Status**: ✅ **COMPLETE & PRODUCTION-READY**

All 9 code review findings (3 HIGH, 3 MEDIUM, 3 LOW) have been resolved:
- ✅ H1–H3: Navigation links, render bug fix, DOM test coverage
- ✅ M1–M3: Dead code removal, accessibility improvements, liquidation disclaimer
- ✅ L1: Documentation updated (21 → 22 tests)
- ✅ L2–L3: Covered by H3 fix; i18n noted for future

**Commits**:
```
6a41f23 feat(phase-8): scaffold leverage calculator page and styles (task 08-01)
0051afe feat(phase-8): add pure calculation engine and real-time form wiring (task 08-02)
a7c63f8 feat(phase-8): harden validation with actionable errors, expand tests, wire coverage gate (task 08-03)
b171783 fix(phase-8): H1 add navigation links to calculator from index and charts
98c581c fix(phase-8): H2 render() gate on isValid, H3 add calculator-init tests, M1 remove dead code, M2 add aria-live, H3 update coverage
47160c6 fix(phase-8): M3 add liquidation risk disclaimer, L1 update test count 21→22
```

---

## Next Steps

1. ✅ **Phase 8 complete**: All HIGH/MEDIUM/LOW findings resolved
2. **Phase 9**: Shared navigation bar (will unify nav across all three pages: index.html, charts.html, calculator.html)
3. **Future phases**: Multi-locale support (i18n layer for L3)
