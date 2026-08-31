# Phase 8 Code Review — Leverage Calculator

**Reviewer:** code-reviewer agent
**Date:** 2026-08-31
**Commits reviewed:** 6a41f23, 0051afe, a7c63f8

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 3     | warn   |
| MEDIUM   | 3     | info   |
| LOW      | 3     | note   |

**Verdict: WARNING** — no CRITICAL security/breakage issues, but 3 HIGH findings (one real UX/correctness bug, one navigation gap that makes the feature unreachable, one test-coverage gap) should be resolved before calling Phase 8 production-ready.

Test suite verified: `npx vitest run public/js/calculator.test.ts` → **22 passed** (task description says 21; harmless drift, not a defect).

---

## HIGH

### H1 — Calculator page is not linked from any navigation, effectively unreachable
**Files:** `public/index.html` (header nav), `public/charts.html` (header nav), `public/calculator.html:12`

`index.html`'s header links to `/charts.html` only; `charts.html`'s header links back to `/` only. Neither page links to `/calculator.html`, and `calculator.html` itself only links back to `/`. A user has no way to discover the new calculator feature through the UI — it is only reachable by typing the URL directly.

```html
<!-- public/index.html header -->
<a href="/charts.html">K線圖</a>   <!-- no link to calculator.html -->

<!-- public/charts.html header -->
<a href="/">← 記錄表</a>            <!-- no link to calculator.html -->
```

**Fix:** Add a nav link to `/calculator.html` in both `index.html` and `charts.html` headers (and consider linking to `charts.html`/`index.html` from `calculator.html` for full round-trip nav), so Phase 8's deliverable is actually discoverable.

### H2 — `render()` shows misleading "0" values instead of placeholders on invalid input
**File:** `public/js/calculator-init.js:61-75`

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

**Fix:** Gate the numeric writes on `result.isValid`, falling back to the same `"—"` placeholder used by `clearResults()`:

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

### H3 — `calculator-init.js` (DOM wiring layer) has zero test coverage and is excluded from the coverage gate
**Files:** `package.json` (`test:coverage` script), `public/js/calculator-init.js`, `public/js/calculator.test.ts`

```json
"test:coverage": "vitest run --coverage --coverage.include='public/js/calculator.js' --coverage.thresholds.lines=95 ..."
```

The coverage gate is scoped with `--coverage.include='public/js/calculator.js'`, so `calculator-init.js` — which contains all DOM reading/writing, formatting (`formatQuantity`, `formatAmount`, `trimZeros`, `formatPercent`, `formatRatio`), and the `render`/`clearResults`/`isComplete` logic — is completely excluded from the 95% threshold and has **no unit tests at all**. All 22 tests in `calculator.test.ts` exercise only the pure `calculator.js` module (plus one meta-test asserting no `fetch`/`api.js` usage). The H2 bug above is a direct consequence: it lives entirely in the untested file and none of the 22 tests would have caught it.

**Fix:** Add a jsdom-based test file (e.g. `calculator-init.test.ts`) covering: `formatQuantity`/`formatAmount`/`trimZeros` edge cases (zero, exactly-1e4/1e6 boundaries, trailing zeros), `isComplete()`, and `render()` behavior for both valid and invalid `calculatePosition` results (this would also have caught H2). Either broaden `--coverage.include` to cover both files or add a second coverage command for `calculator-init.js`.

---

## MEDIUM

### M1 — Dead/unclear special case in `normalizeDirection`
**File:** `public/js/calculator.js:66-69`

```js
function normalizeDirection(value) {
  if (value === 'short' || value === 'Short' || value === 'SHORT' || value === false) return 'short';
  return 'long';
}
```

`value === false` mapping to `'short'` is unreachable from the actual UI (the radio button always supplies the string `'long'`/`'short'` via `readForm()`), is untested, and has no documented rationale. It reads like leftover/speculative code and obscures the function's intent.

**Fix:** Remove the `=== false` branch, or add a comment explaining a concrete caller that needs it (e.g., a hypothetical boolean `isShort` flag) and add a test for it.

### M2 — No `aria-live` region for live-updating results/warnings
**File:** `public/calculator.html:69-97`

The results grid and the two warning banners (`#rr-warning`, `#liquidation-warning`) update on every keystroke via the `input`/`change` listeners in `calculator-init.js`, but none of these containers have `aria-live`. Screen-reader users typing into the form will not hear updated values or newly-appearing liquidation/R:R warnings — a meaningful gap for a financial-risk tool.

**Fix:** Add `aria-live="polite"` to `.results-grid`, `#calc-error`, and the two `.warning` divs (or a shared wrapping container).

### M3 — Liquidation-risk warning is a simplified approximation presented as fact
**File:** `public/js/calculator.js:61`, `public/calculator.html:97`

`liquidationRisk: lossAmount > margin` is a reasonable heuristic (loss at stop-loss price exceeds posted margin) but ignores maintenance-margin requirements, funding, and fees that real exchanges use to compute actual liquidation price — so actual liquidation typically happens *before* this threshold is reached. The UI copy ("可能在被止損前就被強制平倉…") presents this as a definitive risk assessment without noting it's an estimate.

**Fix:** Add a short disclaimer near the warning (e.g. "估算值，實際強平價依交易所維持保證金率而定") so users don't over-trust the precision of the estimate.

---

## LOW

### L1 — Task description says "21 vitest cases"; actual count is 22
No functional impact — just documentation drift between the phase description and `calculator.test.ts`.

### L2 — `trimZeros` regex formatting is fragile and only indirectly tested
**File:** `public/js/calculator-init.js:34-36`

```js
function trimZeros(value) {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}
```

Correct for the cases exercised manually during this review (e.g. `"1.00000"` → `"1"`, `"0.00000"` → `"0"`), but it has no dedicated unit tests (see H3) and is easy to break with a future refactor (e.g. a value like `"100"` with no decimal point is returned unchanged, which is fine, but there's no test asserting that boundary).

**Fix:** Covered by the H3 fix (add `calculator-init.test.ts`); no separate action needed beyond that.

### L3 — All validation/UI copy is hardcoded Traditional Chinese with no i18n layer
**File:** `public/js/calculator.js` (all error strings), `public/calculator.html`

Consistent with the rest of the app's current single-locale approach, so this is a note rather than a defect — flagging only in case the project later needs multi-locale support.

---

## Security Review

- No hardcoded secrets, no `fetch`/network calls (enforced by test `CALC-07`), no `innerHTML`/`insertAdjacentHTML` usage — all DOM writes use `textContent`, so there is no XSS vector.
- All numeric inputs are coerced via `Number()` and validated with `Number.isFinite` + range/sign checks in `calculator.js:71-86` before use; no injection surface exists since there is no server round-trip.
- `novalidate` on the form is intentional (custom JS validation replaces native browser validation) and does not weaken security since there's no submission endpoint.

No CRITICAL or security-specific HIGH issues found.

## Correctness Review (formulas)

Verified by re-deriving the math and cross-checking against the 22 passing test cases:
- `positionSize = margin * leverage / entryPrice` — correct.
- Long: `lossAmount = positionSize * (entryPrice - stopLoss)`, `profitAmount = positionSize * (takeProfitPrice - entryPrice)` — correct, and validation enforces `stopLoss < entryPrice < takeProfitPrice` so both are always positive when `isValid`.
- Short: signs correctly flipped (`lossAmount = positionSize * (stopLoss - entryPrice)`, `profitAmount = positionSize * (entryPrice - takeProfitPrice)`), validation enforces `takeProfitPrice < entryPrice < stopLoss`.
- `riskRewardRatio = profitAmount / lossAmount` cannot divide by zero given the strict inequality validation.
- Leverage bounds (1x–125x) match the `<select>` options in `calculator.html:51-61`, so the "leverage out of range" validation path, while correctly implemented, is currently unreachable through the UI (only reachable via direct API calls / tests) — not a defect, just a note that it's defensive code for future use (e.g. a free-text leverage input).

No formula bugs found.

## Overall Assessment

**Not yet production-ready as "fully hardened."** The pure calculation engine (`calculator.js`) is correct, well-validated, and well-tested (22/22 passing, formulas verified by hand). However:
1. The feature is currently unreachable from the app's navigation (H1) — this alone blocks calling Phase 8 "done" from a product standpoint.
2. The DOM wiring layer has a real UX bug that misrepresents invalid calculations as zero-value results (H2), and this layer has no test coverage at all (H3), meaning similar bugs could exist undetected.

Recommend resolving H1–H3 before merge/release; M1–M3 are good follow-ups but not blockers.
