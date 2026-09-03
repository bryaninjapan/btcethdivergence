# Phase 17 Verification Report
**Date**: 2026-09-03
**Verifier**: gsd-verifier (goal-backward, read-only)

## Summary
5 of 6 ROADMAP criteria PASS; 1 criterion FAILS (SC3). At HEAD (`7beac28`, working tree clean) the shipped contract tests contradict the shipped stub code, so the phase's own verification gate (`npm test -- calculator.test`, `npm test`, `npm run test:coverage`) is red.

## Criterion-by-Criterion Verification

### SC1: New `src/domains/calculator-rules.ts` exports Zod schemas: `CalculatorInputs`, `CalculatorOutputs` for validation and type safety.
- Evidence: File read — `CalculatorInputs` at `calculator-rules.ts:80` (6 fields: margin, entryPrice, stopLoss, takeProfitPrice, leverage, longShort; direction-dependent `superRefine`; `longShort` z.transform normalization), `CalculatorOutputs` at `calculator-rules.ts:154` (8 computed fields + `warnings` subobject), types `CalculatorInput`/`CalculatorOutput` exported.
  - `npm run typecheck` → `tsc --noEmit` exits 0, no output (clean).
  - `npm test -- calculator-rules` → `Test Files 1 passed (1); Tests 42 passed (42)`.
- Verdict: PASS

### SC2: Client-side calculator logic unchanged (still runs in browser).
- Evidence: `git diff --stat public/js/calculator.js` → empty output (no changes). `npm test -- public/js/calculator` → `2 passed (2); Tests 33 passed (33)` (frozen regression suite green).
- Verdict: PASS

### SC3: Server-side calculator API ready for Phase 17+: `/api/calculator/validate` and `/api/calculator/compute` endpoints (stubs created, tests written, ready for implementation).
- Evidence: Stubs exist and are registered — `src/routes/calculator.ts:45-53` (`POST /api/calculator/validate` and `/api/calculator/compute`, both 501 + sanitized 400 on invalid input), registered in `src/index.ts:53` (`app.route('/', calculator)`).
- **However the contract tests contradict the shipped code at HEAD**:
  - Commit `017109e` (L3 review fix) changed the stub response from `ErrorCode.INTERNAL_ERROR` to `ErrorCode.NOT_IMPLEMENTED` (`src/routes/calculator.ts:29`) but did NOT update `src/routes/calculator.test.ts`, which still asserts `error.code === 'INTERNAL_ERROR'` at lines 55 and 153.
  - `npm test -- calculator.test` → `Test Files 1 failed | 1 passed (2); Tests 2 failed | 36 passed (38)`. Actual failures:
    ```
    - Expected
    + Received
      { "error": { "code": "INTERNAL_ERROR" ...
      { "error": { "code": "NOT_IMPLEMENTED" ...
    ```
  - Full suite `npm test` → `Test Files 2 failed | 41 passed (43); Tests 3 failed | 650 passed (653)`. The second failing file is the planning artifact `.planning/phases/phase-17/L2-TDD-Schema-Comparison.test.ts` (committed `9979008`) whose test "includes error message if calculation fails" feeds `leverage: 0` through `CalculatorOutputsC.parse`, which throws on `Infinity` instead of yielding `isValid:false`.
  - `npm run test:coverage` exits non-zero (tests fail before the 85% gate can be assessed).
- Verdict: FAIL — stubs are created and registered (13/15 contract tests pass, including the CORS boundary proving 501-not-404), but the "tests written" are not green against the delivered code and the phase's own verification commands (`npm test -- calculator.test`, `npm test`) are red. "Ready for implementation" is not true right now.

### SC4: Schemas shared via .js mirror + parity test: `public/js/calculator-rules.js` mirrors backend schemas, sync enforced by parity test (divergence.js precedent).
- Evidence: `public/js/calculator-rules.js` exists (40 lines: MAX/MIN_LEVERAGE, INPUT_FIELDS, OUTPUT_FIELDS, WARNING_FIELDS, ERROR_MESSAGES). Parity tests in `src/domains/calculator-rules.test.ts:245-273` ("frontend mirror parity (calculator-rules.ts ↔ calculator-rules.js)") plus extended guard at `:275-276` ("extended parity guard (calculator-rules.ts ↔ frozen calculator.js)"). All 42 tests in this file pass. Precedent files exist: `public/js/divergence.js` + `src/domains/divergence.test.ts`.
- Verdict: PASS

### SC5: 15+ unit tests verifying validation rules, edge cases (margin vs. SL, liquidation thresholds).
- Evidence: `src/domains/calculator-rules.test.ts` — 42 tests, all passing. Coverage includes margin>0/negative/non-finite, leverage bounds 1–125 + fractional, direction-dependent SL/TP (long vs short), `longShort` normalization (incl. `'sHoRt' → long`), output/warnings shape, mirror parity, frozen-client guard, liquidation warnings.
- Verdict: PASS

### SC6: Code review complete: zero HIGH issues.
- Evidence: `17-REVIEW.md` present, reports 0 CRITICAL / 0 HIGH / 0 MEDIUM / 5 LOW, recommendation "Merge as-is — no CRITICAL or HIGH issues."
- Caveats: the review's independent verification claim ("calculator-rules.test.ts + calculator.test.ts = 56/56 pass") and its LOW #3 description (501 → `INTERNAL_ERROR` at `calculator.ts:27-30`) are now stale — the post-review fix commit `017109e` changed the code to `NOT_IMPLEMENTED` without updating the tests, and its own commit message verified only "42 tests pass" (the route tests). The criterion as stated (zero HIGH) holds in the review document, but the delivered code now ships with a failing test suite, which is the SC3 blocker.
- Verdict: PASS (with stale-review caveat; blocker captured under SC3)

## No-Regression Check
Spot-checked against prior phases via the full suite: 650 of 653 tests pass across 41 files, including the frozen client regression (SC2), records/klines routes, and phase 16 service-layer tests — no prior-phase functionality regressed. However, the *global* test gate (`npm test` / `npm run test:coverage`) is now red at HEAD, which would block CI for any future phase. The 3 failures are all phase-17 artifacts: 2 stale assertions in `src/routes/calculator.test.ts` and 1 broken design-analysis test in `.planning/phases/phase-17/L2-TDD-Schema-Comparison.test.ts`.

## Deviations Logged in SUMMARY
All 4 deviations are documented and none silently violate a success criterion: `longShort` default `'long'` (strict superset of locked Option A, parity is source of truth), fractional leverage accepted (matches frozen client bounds-only check), 2 commits instead of 1, and 400 path mechanism pinned via `ValidationError` (codebase convention). Deviation 1 + 3 are material but SC-compatible.

## Conclusion
1 criterion FAILED — SC3 (endpoint contract tests contradict the shipped stub code; global test suite red).

Recommendation: NOT READY FOR PRODUCTION until the following are fixed (trivial, small):
1. **Update `src/routes/calculator.test.ts`** — change the 2 assertions at lines 55 and 153 from `error.code: 'INTERNAL_ERROR'` to `'NOT_IMPLEMENTED'` to match the shipped stub (`src/routes/calculator.ts:29`, `ErrorCode.NOT_IMPLEMENTED` maps to 501). This is the one-line-per-site fix; `NOT_IMPLEMENTED` is the semantically correct code and the 501 status already matches.
2. **Fix or relocate `.planning/phases/phase-17/L2-TDD-Schema-Comparison.test.ts`** — the "includes error message if calculation fails" test feeds `leverage: 0` into `CalculatorOutputsC.parse`, which throws on `Infinity`; either exclude the file from the vitest run, use `.safeParse`, or delete this one-off analysis artifact. As-is it breaks `npm test`.
3. **Refresh `17-REVIEW.md`** stale claims (56/56 pass; LOW #3 describing `INTERNAL_ERROR`) to reflect the current `NOT_IMPLEMENTED` code.

Nothing in `src/` other than the 2 test assertions needs changing; SC1/2/4/5 are fully verified against the current repo state.