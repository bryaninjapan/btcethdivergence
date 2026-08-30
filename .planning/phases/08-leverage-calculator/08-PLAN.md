# Phase 8 Plan — Leverage Calculator

**Version**: 1.0  
**Last Updated**: 2026-08-31  
**Status**: Planning  

---

## Phase Goal & Success Criteria

### Goal
The owner can independently size a leveraged position and see its risk/reward without touching the backend. A single-page calculator provides real-time position-sizing math, displays results as the form inputs change, and warns when risk metrics are unsafe.

### Success Criteria (what must be TRUE)

1. **User can toggle between Long and Short** and fill in a form with:
   - Margin amount
   - Entry price
   - Stop-loss price
   - Take-profit price
   - Leverage multiplier (1x–125x dropdown)

2. **Calculator displays these values as inputs change**:
   - Position size (margin × leverage ÷ entry price)
   - Stop-loss amount in $ (position size × (entry − stop_loss) for long, or stop_loss − entry for short)
   - Take-profit amount in $ (position size × (take_profit − entry) for long, or entry − take_profit for short)
   - R:R ratio (take_profit_amount ÷ stop_loss_amount)
   - Loss rate % (stop_loss_amount ÷ margin × 100)
   - Gain rate % (take_profit_amount ÷ margin × 100)

3. **A warning appears when R:R < 1.0**
   - R:R ratio is displayed prominently
   - When ratio is below 1.0, a clear warning is shown

4. **A liquidation warning appears when stop_loss_amount > margin**
   - The SL amount exceeds available margin → liquidation risk
   - Clear warning displayed

5. **All results are client-side (no network requests)**
   - Pure JavaScript calculations
   - No fetch() calls to backend
   - No external API dependencies for calculations
   - Runs entirely in the browser

---

## Architecture & Design

### Page Structure

**Single static HTML file**: `public/calculator.html`
- Header with app title and navigation link to records/charts
- Single-page layout (no routing)
- No build step, no framework (pure HTML/CSS/JS)

### Form Layout

**Long/Short Toggle**
- Radio buttons or toggle button: "Long" / "Short"
- Default: Long
- Changes position size calculation direction

**Input Fields**
```
Margin:         [input: number] USDT
Entry Price:    [input: number] (decimal, e.g., 42000.50)
Stop-Loss:      [input: number] (decimal)
Take-Profit:    [input: number] (decimal)
Leverage:       [dropdown: 1x, 2x, 3x, 5x, 10x, 20x, 25x, 50x, 75x, 100x, 125x]
```

**Real-Time Display (read-only output)**
```
Position Size:        [display] (position_size) USDT or coins
Stop-Loss Amount:     [display] ($) [warning if > margin]
Take-Profit Amount:   [display] ($)
R:R Ratio:            [display] [warning if < 1.0]
Loss Rate %:          [display]
Gain Rate %:          [display]
```

### Calculation Engine

**Pure Module**: `public/js/calculator.js`
- No DOM dependencies
- No `window` or `location` references (testable in vitest)
- Export single function: `calculatePosition(params) → result`
- Input: `{ longShort, margin, entryPrice, stopLoss, takeProfitPrice, leverage }`
- Output:
  ```javascript
  {
    isValid: boolean,
    positionSize: number,        // (margin * leverage) / entryPrice
    stopLossAmount: number,      // position_size * abs(entryPrice - stopLoss)
    takeProfitAmount: number,    // position_size * abs(takeProfitPrice - entryPrice)
    riskRewardRatio: number,     // takeProfitAmount / stopLossAmount
    lossRatePercent: number,     // (stopLossAmount / margin) * 100
    gainRatePercent: number,     // (takeProfitAmount / margin) * 100
    warnings: {
      riskRewardTooLow: boolean, // riskRewardRatio < 1.0
      liquidationRisk: boolean   // stopLossAmount > margin
    }
  }
  ```

**Direction-Aware Logic**
- **Long**: 
  - SL below entry; TP above entry
  - Profit = posSize × (TP − entry)
  - Loss = posSize × (entry − SL)
- **Short**:
  - SL above entry; TP below entry
  - Profit = posSize × (entry − TP)
  - Loss = posSize × (SL − entry)

**Edge Cases & Validation**
- Margin ≤ 0 → invalid
- Entry price ≤ 0 → invalid
- Leverage < 1 or > 125 → invalid
- Long: SL must be below entry; TP must be above entry
- Short: SL must be above entry; TP must be below entry
- Division by zero guards (entry price, leverage)

### Form Behavior

**Real-Time Updates**
- On every input change (`input` event), recalculate and redisplay
- Debounce not needed (pure math is instant)
- Use `addEventListener('input', ...)` on all form fields

**Formatting**
- Position size: 2 decimal places (or display as coins if more sensible)
- Prices: 2 decimal places (match entry price precision if possible)
- Percentages: 1 decimal place
- Amounts ($): 2 decimal places
- R:R ratio: 2 decimal places

### Styling

**Minimal, focused CSS**
- Mobile-responsive (Phase 9 nav will unify styling across pages)
- Clear visual hierarchy: inputs on left, results on right (or stacked on mobile)
- Warning states: red or yellow highlight for R:R < 1.0 and liquidation risk
- Read-only fields styled differently from inputs (gray background, no border)

---

## Task Breakdown

**3 Sequential Tasks** (tracer-first vertical slicing, ~60 min total)

### Task 08-01: HTML Page + Form Scaffolding + Basic UI Layout

**Objective**: Build the static page shell and form structure. Establish the foundation that 08-02 will wire up with calculations.

**Files Modified**:
- `public/calculator.html` (new)
- `public/css/style.css` (updated for calculator section)

**Deliverables**:

1. **public/calculator.html**
   - DOCTYPE, lang="zh-Hant" (matching index.html (served at /)/charts.html)
   - Meta charset, viewport (mobile-responsive)
   - Title: "BTC/ETH Divergence Tracker — 槓桿計算機"
   - Header with app title and back link to records page
   - Form container with:
     - Long/Short toggle (radio buttons or toggle UI)
     - Margin input (type="number", placeholder="margin in USDT")
     - Entry Price input (type="number", step="0.01")
     - Stop-Loss input (type="number", step="0.01")
     - Take-Profit input (type="number", step="0.01")
     - Leverage dropdown (`<select>` with options 1–125 standard values)
   - Results display section:
     - Position Size (read-only, `<output>` or `<p>`)
     - Stop-Loss Amount (read-only, with `id="sl-warning"` for liquidation alert)
     - Take-Profit Amount (read-only)
     - R:R Ratio (read-only, with `id="rr-warning"` for < 1.0 alert)
     - Loss Rate % (read-only)
     - Gain Rate % (read-only)
   - Warning sections:
     - `<div id="rr-warning" hidden>` → "Risk/Reward < 1.0 — consider adjusting SL or TP"
     - `<div id="liquidation-warning" hidden>` → "Stop-Loss amount exceeds margin — liquidation risk"
   - No script tags in 08-01 (pure HTML structure)

2. **public/css/style.css** (additions)
   - `.calculator-form` → flex container, gap between inputs and results
   - `.form-group` → label + input styling (consistent with index.html (served at /))
   - `.results` → display grid/flex, read-only field styling (gray bg, no border, indicates output)
   - `.warning` → red/yellow border or highlight, visible when unhidden
   - Mobile breakpoint → stack form and results vertically

**Checkpoints**:
- Page serves from deployed Worker (curl checks the HTML is served)
- No JavaScript errors on load
- All form inputs and output elements are present in the DOM

---

### Task 08-02: Core Calculation Engine + Real-Time Updates

**Objective**: Implement the pure calculation logic and wire it to the form so results update as inputs change.

**Files Modified**:
- `public/js/calculator.js` (new)
- `public/js/calculator-init.js` (new, pure module loader)
- `public/js/calculator.test.ts` (new, vitest suite)
- `public/calculator.html` (updated to include init script)

**Deliverables**:

1. **public/js/calculator.js**
   - Export `calculatePosition(params) → result` function
   - Pure, no DOM/window dependencies
   - Validates input (returns `{ isValid: false, ...}` on error)
   - Calculates:
     ```
     positionSize = (margin * leverage) / entryPrice
     
     For Long (SL < entry, TP > entry):
       lossAmount = positionSize * (entryPrice - stopLoss)
       profitAmount = positionSize * (takeProfitPrice - entryPrice)
     
     For Short (SL > entry, TP < entry):
       lossAmount = positionSize * (stopLoss - entryPrice)
       profitAmount = positionSize * (entryPrice - takeProfitPrice)
     
     riskRewardRatio = profitAmount / lossAmount
     lossRatePercent = (lossAmount / margin) * 100
     gainRatePercent = (profitAmount / margin) * 100
     
     warnings.riskRewardTooLow = riskRewardRatio < 1.0
     warnings.liquidationRisk = lossAmount > margin
     ```
   - Handle edge cases: division by zero, invalid ranges (SL/TP on wrong side for direction)
   - Return complete result object ready for display

2. **public/js/calculator.test.ts** (vitest suite)
   - Test 1: Long position — calculate position size, SL amount, TP amount, R:R
   - Test 2: Short position — same as Test 1, verify signs are flipped correctly
   - Test 3: Liquidation risk — SL amount > margin → warning = true
   - Test 4: R:R < 1.0 → warning = true
   - Test 5: Edge case — entry price zero → invalid
   - Test 6: Edge case — margin zero → invalid
   - Test 7: Leverage boundary (1x, 125x) → calculations work at extremes
   - Test 8: Long with SL above entry → isValid = false (invalid input)
   - Test 9: Short with SL below entry → isValid = false (invalid input)
   - All tests use `vitest` assertions (e.g., `expect(result.positionSize).toBeCloseTo(...)`)
   - Coverage target: ≥95% of calculator.js logic

3. **Wire Form to Calculations** — create `public/js/calculator-init.js`
   - On every `input` event on margin/entryPrice/stopLoss/takeProfitPrice/leverage/longShort:
     - Read all form values
     - Call `calculatePosition(params)`
     - Update display fields with formatted results
     - Show/hide warnings based on `warnings` object

4. **Module Loader** — `public/js/calculator-init.js`
   - `<script type="module" src="/js/calculator-init.js"></script>` at the end of calculator.html body
   - Imports `calculatePosition` from `./calculator.js` (relative to `/js/`, resolves to static asset `/js/calculator.js`)
   - Caches DOM references (form inputs, output elements)
   - Attaches event listeners
   - Calls `calculatePosition` and updates display on form changes

**Checkpoints**:
- `npm run test` passes all 9 vitest tests
- Calculator page loaded in browser, changing Margin updates Position Size immediately
- Changing Leverage updates Position Size immediately
- Toggling Long/Short recalculates correctly
- All results are formatted and readable

---

### Task 08-03: R:R Ratio Warnings + Liquidation Checks + Edge-Case Validation

**Objective**: Surface risk warnings prominently and handle all edge cases gracefully.

**Files Modified**:
- `public/js/calculator.js` (updated with comprehensive validation)
- `public/calculator.html` (updated to display warnings)
- `public/css/style.css` (warning styling)

**Deliverables**:

1. **Comprehensive Input Validation** (in calculator.js)
   - Margin: must be > 0
   - Entry Price: must be > 0 (guards division)
   - Stop-Loss: 
     - Long: must be < entry (stop below entry)
     - Short: must be > entry (stop above entry)
   - Take-Profit:
     - Long: must be > entry (profit above entry)
     - Short: must be < entry (profit below entry)
   - Leverage: must be 1–125
   - Return `{ isValid: false, errorMessage: "..." }` if any check fails

2. **Risk Warnings** (in result object)
   - `warnings.riskRewardTooLow`: R:R < 1.0
     - Logic: if `riskRewardRatio < 1.0` → warn
     - Message: "Risk/Reward is below 1:1 — your potential loss exceeds your potential gain. Consider widening TP or tightening SL."
   - `warnings.liquidationRisk`: Loss > Margin
     - Logic: if `lossAmount > margin` → warn
     - Message: "Stop-Loss amount exceeds your margin. You'll be liquidated before reaching SL. Widen SL or reduce leverage."

3. **Display Warnings**
   - In the form UI, show two warning blocks:
     - `#rr-warning`: displays R:R message when `warnings.riskRewardTooLow` is true
     - `#liquidation-warning`: displays liquidation message when `warnings.liquidationRisk` is true
   - Style warnings with red border/highlight
   - Only show when condition is met; hide otherwise

4. **Edge-Case Handling**
   - Blank/missing inputs: treat as 0 or invalid, don't display NaN/Infinity
   - When input is incomplete (e.g., user hasn't filled all fields yet): show placeholder results (e.g., "—" or "0.00") instead of errors
   - Decimal precision: round to 2 decimal places for display
   - Very large/small numbers: use readable formatting (e.g., "1.23M" for millions, "0.00001" for tiny)

5. **Vitest Tests** (Task 08-02, but expanded)
   - Test 10: R:R warning triggers when ratio < 1.0
   - Test 11: Liquidation warning triggers when SL $ > margin
   - Test 12: Both warnings can be true simultaneously
   - Test 13: Long with invalid range (SL ≥ entry) → isValid = false
   - Test 14: Short with invalid range (SL ≤ entry) → isValid = false
   - Test 15: Very large margin + small leverage → calculations don't overflow
   - Test 16: Empty inputs handled gracefully (return invalid or zero)

**Checkpoints**:
- `npm run test` passes all tests (9 + 7 new)
- Calculator page: set R:R < 1.0 → warning appears; adjust TP → warning disappears
- Calculator page: set SL amount > margin → liquidation warning appears
- Error messages are clear and actionable (not technical jargon)
- No NaN or Infinity displayed to the user

## Verification Track (Part of 08-02 and 08-03)

**Objective**: Verify calculation accuracy, edge-case handling, and end-to-end user flows through automated and manual testing.

**Files Modified** (by 08-02/08-03 tasks):
- `public/js/calculator.test.ts` (written in 08-02/08-03)
- No additional source code changes in verification phase

### Verification Tests

**Unit Tests (vitest)** — run after 08-02/08-03 complete
- 16+ test cases covering:
  - Position size calculation (long, short)
  - SL/TP amounts
  - R:R ratio math
  - Liquidation and R:R warnings
  - Input validation (edge ranges, zero, negative)
  - Long/Short directional logic
  - Decimal precision and rounding
- Target: ≥95% coverage of `calculator.js`
- Run: `npm run test`

**Manual E2E Checkpoints** (browser, deployed calculator.html)
1. **Fresh load**: Page renders without errors. Warnings are hidden. Default values (or empty) in form.
2. **Long position setup**:
   - Toggle: "Long"
   - Margin: 1000
   - Entry: 42000
   - SL: 41000
   - TP: 43000
   - Leverage: 1x
   - **Expected**: Position size = 1000/42000 ≈ 0.024, Loss = 0.024 × 1000 = 24, Profit = 0.024 × 1000 = 24, R:R = 1.0, warnings off
3. **Liquidation risk**:
   - Same as above, but SL: 40000
   - **Expected**: Loss = 0.024 × 2000 = 48 > 1000 margin (false; 48 < 1000), so liquidation warning off. But if we reduce margin to 50:
   - Margin: 50, Entry: 42000, SL: 40000, TP: 43000, Leverage: 2x
   - **Expected**: Position size = (50 × 2)/42000 ≈ 0.0024, Loss = 0.0024 × 2000 = 4.8 < 50, still safe. (Update to leverage 10x for risk:) Position size = (50 × 10)/42000 ≈ 0.012, Loss = 0.012 × 2000 = 24 < 50, still safe. (Try 50x leverage:) Position size = (50 × 50)/42000 ≈ 0.06, Loss = 0.06 × 2000 = 120 > 50, **liquidation warning on**.
4. **R:R < 1.0 warning**:
   - Margin: 1000, Entry: 42000, SL: 41500 (loss = ~11.90), TP: 42500 (profit = 0.0238 × 500 = ~11.90, R:R = 1.0), Leverage: 1x
   - **Expected**: warning off at TP 42500 (R:R = 1.0)
   - Adjust TP to 42400 (profit = 0.0238 × 400 = ~9.52, loss still ~11.90, R:R ≈ 0.80)
   - **Expected**: R:R < 1.0 warning on
5. **Short position**:
   - Toggle: "Short"
   - Margin: 1000, Entry: 42000, SL: 43000, TP: 41000, Leverage: 1x
   - **Expected**: Position size ≈ 0.024, Loss = 0.024 × 1000 = 24, Profit = 0.024 × 1000 = 24, R:R = 1.0, warnings off
6. **Real-time updates**:
   - Load page, set all inputs
   - Change margin slowly (drag slider or type) → results update instantly
   - Toggle Long/Short → results flip (SL and TP logic inverts)
   - Change leverage → position size scales proportionally
7. **Mobile responsiveness**:
   - Open calculator on mobile (375px viewport)
   - Form and results stack vertically, readable, no overflow
   - All inputs accessible, results visible without horizontal scroll

**Verification Checkpoints** (run after 08-03 completes)
- `npm run test` → "16+ tests passed"
- Browser checkpoint (deployed calculator.html): All 7 E2E flows execute correctly, no console errors
- Warnings appear/disappear correctly as inputs change (R:R < 1.0, liquidation risk)
- No NaN, Infinity, or undefined in displayed results
- Mobile responsive: form/results stack vertically on 375px viewport, all inputs accessible

---

## Risk & Mitigation

### Risk 1: Calculation Accuracy

**Risk**: Floating-point arithmetic errors (e.g., 0.1 + 0.2 ≠ 0.3 in JS) lead to incorrect position sizes or warnings.

**Mitigation**:
- Use libraries if needed, or implement careful rounding (e.g., `Math.round(x * 100) / 100`)
- Test with known, simple cases first (e.g., 1000 margin, 10x leverage, 100 entry price = 100 coins)
- Vitest suite includes precision checks (`toBeCloseTo` instead of exact equality)
- Round to 2 decimals for display; internal math uses higher precision

### Risk 2: Invalid Input Edge Cases

**Risk**: User enters zero, negative, or mismatched values (e.g., SL above entry for long) → NaN, Infinity, or incorrect warnings.

**Mitigation**:
- Validate all inputs before calculation
- Return `{ isValid: false }` if any input is out of range
- Display "Invalid input" instead of NaN
- Test edge cases in vitest (zero, negative, extreme leverage)

### Risk 3: Performance

**Risk**: Page sluggish on old devices, or calculations stall when user types quickly.

**Mitigation**:
- Calculation is pure math, runs in <1ms (no network or DOM thrashing)
- No debounce needed; event listeners are lightweight
- Re-render only display fields that changed (not the whole form)
- CSS animations (if any) are GPU-accelerated

### Risk 4: Scope Creep

**Risk**: Phase 8 limited to *one* calculator page; not navigable from main records/charts nav yet (Phase 9 will add shared nav).

**Mitigation**:
- Calculator is independent, lives at `/calculator.html` with a back link to records
- No backend changes required (pure client-side)
- No shared navbar yet; each page has its own back link
- This keeps Phase 8 focused and deployable independently

### Risk 5: Cross-Browser Compatibility

**Risk**: Certain browsers don't support `<dialog>`, `<output>`, or modern CSS.

**Mitigation**:
- Use widely supported elements: `<input>`, `<select>`, `<button>`, `<div>`, `<p>`
- Avoid CSS Grid/Flexbox features older than ES2015
- Test in Chrome, Firefox, Safari desktop (CI can't test mobile, but manual checkpoint covers it)
- Fallback: use `<div>` instead of `<output>` if needed

---

## Success Criteria Verification

After Phase 8 is complete, verify each success criterion:

| SC | Requirement | Verification | Status |
|---|---|---|---|
| SC1 | User can toggle Long/Short and fill form (margin, entry, SL, TP, leverage dropdown) | Deploy `/calculator.html`, load in browser, fill all fields without errors | [ ] |
| SC2 | Display position size, SL $, TP $, R:R, loss %, gain % as inputs change | Change each input; verify display updates immediately, no stale values | [ ] |
| SC3 | Warning when R:R < 1.0 | Set up scenario with R:R < 1.0; confirm warning message appears; adjust TP to improve ratio; confirm warning disappears | [ ] |
| SC4 | Warning when SL $ > margin (liquidation risk) | Set up scenario with loss > margin; confirm warning appears; adjust margin/leverage to reduce loss; confirm warning disappears | [ ] |
| SC5 | All results are client-side, no network requests | Open DevTools Network tab, change inputs, verify no fetch/XHR calls; all calculations run locally | [ ] |

### Manual Checklist (before marking Phase 8 "done")

- [ ] `public/calculator.html` is served from deployed Worker (curl + inspect)
- [ ] Calculator form renders without errors on desktop and mobile
- [ ] All vitest tests pass (16+ tests, ≥95% coverage)
- [ ] Long and Short toggles work and flip calculation logic
- [ ] Leverage dropdown (1–125x) populates correctly
- [ ] Position size updates when any input changes
- [ ] R:R ratio and warnings display correctly
- [ ] Liquidation warning triggers when loss > margin
- [ ] No NaN, Infinity, or undefined in results
- [ ] Mobile checkpoint: page is usable on 375px viewport
- [ ] Browser console has no errors or warnings
- [ ] No network requests appear in DevTools when using calculator

---

## Remaining Tasks (Breakdown into 08-01 through 08-03)

1. **08-01**: HTML scaffolding and UI layout (`public/calculator.html`, CSS)
2. **08-02**: Core calculation engine and real-time wiring (`public/js/calculator.js`, `public/js/calculator-init.js`, vitest basics)
3. **08-03**: Risk warnings, edge-case validation, extended tests, verification (calculator.js + HTML display, vitest expanded, manual E2E checkpoints)

Each task is independently testable and can be deployed and verified before moving to the next task. Verification track (vitest + browser E2E) is part of 08-03.

---

## Timeline Estimate

Based on Phase 1–7 velocity (~15–25 min per task):
- **08-01** (HTML + CSS): 10 min
- **08-02** (Calculation engine + wiring): 20 min
- **08-03** (Warnings + validation + tests + verification): 20 min
- **Total Phase 8**: ~50 min (1 execution session)

---

## Dependencies

- **Depends on**: Phase 1 (Worker + static assets infrastructure)
- **Depended on by**: Phase 9 (shared navigation bar, Cloudflare Access)
- **No API changes needed** — calculator is purely client-side
- **No new D1 tables or fields** — no data persistence

---

## Notes

- **No shared navbar yet**: Phase 8 calculator has its own back link; Phase 9 will unify navigation.
- **No dark-theme polish**: Phase 5/9 scope; keep styling minimal and readable for now.
- **Pure JS, no framework**: Aligns with project constraint (Google AI Studio friendly, no build step).
- **Tracer-first approach**: Task 08-01 is the minimal page; 08-02 adds live calculations; 08-03 hardens validation and verification.

