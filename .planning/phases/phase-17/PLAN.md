---
phase: 17
name: Future-Proofing (Calculator Validation, Optional)
status: planning
created: 2026-09-02
depends_on: 16
optional: true
---

# Phase 17 Plan: Future-Proofing (Optional)

## Overview

Extract calculator validation rules into schema-driven, reusable module. Prepares for future calculator API endpoints while keeping client-side calculator unchanged.

**Duration**: 0.75 days (revised from 0.5 to include frontend mirror + endpoint tests)
**Work Type**: Schema extraction + API preparation + frontend parity
**Risk Level**: Low (additive, no production changes yet)  
**Priority**: Low (nice-to-have, can be deferred)

---

## Goals

1. **Calculator Validation Schemas**: Create Zod schemas for inputs/outputs
2. **Shared Schemas**: Frontend and backend import from same module
3. **API Stubs**: Create endpoints ready for future implementation
4. **Future-Ready**: No changes to client-side calculator, but foundation ready

---

## Scope

### Files to Create
- `src/domains/calculator-rules.ts` — Zod schemas for validation (longShort included, complete output fields)
- `public/js/calculator-rules.js` — browser-compatible mirror of schemas (SC4: parity with backend)
- `src/routes/calculator.ts` — future API endpoints (stubs with correct envelope)
- `src/routes/calculator.test.ts` — endpoint contract tests (validates 501 responses, invalid schemas)
- `src/domains/calculator-rules.test.ts` — 15+ validation tests (parity test included)

### Files to Keep Unchanged
- `public/js/calculator.js` — no changes (client-side logic unchanged, frozen by SC2)
- `src/index.ts` — will be updated with route registration (not "keep unchanged")

### Files to Update
- `src/index.ts` — add `app.route('/', calculator)` registration
- Documentation (future service layer placeholder)

---

## Success Criteria

- [ ] SC1: CalculatorInputs Zod schema created with 6 fields (margin, entry, stopLoss, takeProfit, leverage, **longShort**)
- [ ] SC2: CalculatorOutputs Zod schema created with 9 output fields (isValid, errorMessage, positionSize, stopLossAmount, takeProfitAmount, riskRewardRatio, lossRatePercent, gainRatePercent, warnings)
- [ ] SC3: API endpoints created as stubs with correct envelope (return `{ok: false, error: {code, message}}` + 501); endpoints registered in `src/index.ts`; 5+ contract tests written
- [ ] SC4: Frontend and backend can import schemas (parity test verifies `public/js/calculator-rules.js` mirrors `src/domains/calculator-rules.ts`)
- [ ] SC5: Schemas handle edge cases (direction-dependent SL/TP via longShort; liquidation threshold; leverage bounds 1–125)
- [ ] SC6: 15+ unit tests passing (validation, edge cases, parity test included)
- [ ] SC7: Code review: zero HIGH issues
- [ ] SC8: Access policy stated (email OTP gate, consistent with `/api/client-log`)

---

## Task Breakdown

### Task 17-01: Calculator Validation Schemas + API Preparation (0.5 days)

**Objectives**:
1. Create calculator validation schemas
2. Handle edge cases (margin vs SL, liquidation)
3. Create API endpoint stubs
4. Write 15+ unit tests

**Subtasks**:
- [ ] 17-01-1: Design CalculatorInputs schema
  **Done when**: 6 fields validated (margin, entry, stopLoss, takeProfit, leverage, longShort); direction-dependent SL/TP rules in .refine(); error messages match calculator.js strings; MAX_LEVERAGE/MIN_LEVERAGE exported as 125/1

- [ ] 17-01-2: Design CalculatorOutputs schema
  **Done when**: 9 output fields enumerated (isValid, errorMessage, positionSize, stopLossAmount, takeProfitAmount, riskRewardRatio, lossRatePercent, gainRatePercent, warnings); matches calculator.js output shape exactly

- [ ] 17-01-3: Implement edge case validation
  **Done when**: liquidation threshold tests pass; margin vs leverage × entry validation; SL/TP direction tests (long vs short); leverage bound tests (1–125); all conditions raise appropriate warnings

- [ ] 17-01-4: Create `/api/calculator/validate` stub endpoint
  **Done when**: POST /api/calculator/validate returns `{ok: false, error: {code: 'NOT_IMPLEMENTED', message: '...'}}` with 501 status; rejects invalid schema with 400 + error details; respects CF Access gate (email OTP)

- [ ] 17-01-4.5 (NEW): Register calculator routes in `src/index.ts`
  **Done when**: `app.route('/', calculator)` added to src/index.ts (after records route); curl /api/calculator/validate returns 501 (not 404); route order verified in code review

- [ ] 17-01-5: Create `/api/calculator/compute` stub endpoint + contract tests
  **Done when**: POST /api/calculator/compute returns same 501 envelope; `src/routes/calculator.test.ts` written with ≥5 test cases (valid input, invalid schema, boundary values, auth required, envelope format); all tests passing

- [ ] 17-01-1.5 (NEW): Create frontend mirror + parity test
  **Done when**: `public/js/calculator-rules.js` exports CalculatorInputs/Outputs matching backend; `src/domains/calculator-rules.test.ts` includes parity test asserting field lists sync (use divergence.js pattern as reference)

- [ ] 17-01-6: Write calculator validation unit tests (15+)
  **Done when**: ≥15 tests passing (field validation, margin/SL rules, liquidation warnings, leverage bounds, direction-dependent rules, parity test); coverage ≥80% for calculator-rules module

- [ ] 17-01-7: Document schemas for future API implementation
  **Done when**: PLAN notes future CalculatorService.ts pattern; access policy stated (email OTP); rate-limit recommendations documented; error message contract documented

- [ ] 17-01-8: Code review + sign-off
  **Done when**: code review complete; zero HIGH/CRITICAL issues; typecheck clean; all tests passing; coverage threshold met

**Expected Deliverables**:
- `src/domains/calculator-rules.ts` — Zod schemas (CalculatorInputs with longShort, CalculatorOutputs with 9 fields, MAX/MIN_LEVERAGE constants)
- `public/js/calculator-rules.js` — frontend mirror (SC4 parity, divergence.js pattern)
- `src/routes/calculator.ts` — stub endpoints (correct envelope, 501 status, auth required)
- `src/routes/calculator.test.ts` — ≥5 endpoint contract tests
- `src/domains/calculator-rules.test.ts` — ≥15 validation + parity tests
- Updated `src/index.ts` — route registration (app.route('/', calculator))
- Updated PLAN.md "Notes for Future Implementation" — service layer placeholder, access policy, rate-limit notes

---

## Dependencies

- **Blocks**: None (optional, does not block future phases)
- **Blocked By**: Phase 16 (patterns established, can proceed after)
- **Related**: None (independent task)

---

## Testing Strategy

### Unit Tests (15+)
- CalculatorInputs: 6 fields, validation rules, direction-dependent SL/TP
- CalculatorOutputs: 9 fields, output shape parity with calculator.js
- Edge cases: liquidation threshold, negative values, extreme leverage (1, 125)
- Margin vs. SL comparison (warning conditions)
- Direction-dependent rules (long vs short)
- **Parity test (NEW)**: `public/js/calculator-rules.js` field lists sync with backend

### Endpoint Contract Tests (5+)
- Valid CalculatorInputs: returns 501 with correct envelope
- Invalid schema: returns 400 with error details
- Boundary values: leverage=1, leverage=125, margin=0
- Missing required fields: caught by Zod validation
- Access gate: CF Access OTP required

### Manual QA
- None required (no UI changes, stubs only)

---

## Verification Commands

Run after implementation to verify all success criteria met:

```bash
# TypeScript check
npm run typecheck

# Unit + endpoint tests
npm test -- calculator-rules
npm test -- calculator.test

# Coverage verification
npm run test:coverage
# Expected: new files (calculator-rules.ts, calculator.ts) meet ≥80% threshold

# Manual endpoint test (after deploy)
curl -X POST http://localhost:8787/api/calculator/validate \
  -H "Content-Type: application/json" \
  -H "CF-Access-Token: [token]" \
  -d '{"margin": 1000, "entry": 100, "stopLoss": 95, "takeProfit": 110, "leverage": 10, "longShort": "long"}' \
# Expected: { "ok": false, "error": { "code": "NOT_IMPLEMENTED", "message": "..." } } with HTTP 501
```

---

## Rollback Plan

If issues found:
1. Delete calculator-rules.ts and calculator.ts
2. No production impact (stubs only)
3. Retry Phase 17 later or defer indefinitely

---

## Optional Criteria

**This phase can be deferred or skipped**:
- Client-side calculator continues to work (no changes)
- Server-side API stubs can be implemented later when needed
- Schemas can be extracted later if API demand materializes

---

## Time Estimate

| Task | Estimate | Status |
|------|----------|--------|
| 17-01-1,2,3 (Schemas + edge case validation) | 0.25 days | Revised schema design with longShort field |
| 17-01-4,4.5,5 (API stubs + registration + tests) | 0.25 days | Includes endpoint contract tests + registration (was missing) |
| 17-01-1.5 (Frontend mirror + parity test) | 0.15 days | New: ensures SC4 (frontend/backend parity) |
| 17-01-6,7,8 (Unit tests + docs + review) | 0.1 days | Includes 15+ tests + access policy documentation |
| **Total Phase 17** | **0.75 days** | **Revised from 0.5 days; optional, can be skipped** |

---

## Handoff Criteria

Phase 17 is complete when (all success criteria met, or can be deferred):
1. ✅ SC1: CalculatorInputs schema with 6 fields (including longShort) + direction-dependent rules
2. ✅ SC2: CalculatorOutputs schema with 9 fields matching calculator.js output
3. ✅ SC3: `/api/calculator/validate` and `/api/calculator/compute` stubs registered in src/index.ts; ≥5 contract tests written and passing
4. ✅ SC4: Frontend mirror (public/js/calculator-rules.js) created; parity test verifies sync
5. ✅ SC5: Edge case validation (liquidation, leverage bounds 1–125, direction-dependent SL/TP)
6. ✅ SC6: 15+ unit tests passing (including parity test); coverage ≥80% for new files
7. ✅ SC7: Code review complete (zero HIGH/CRITICAL issues); typecheck clean
8. ✅ SC8: Access policy documented (CF Access email OTP); service layer pattern clarified
9. ✅ Verification commands (npm run typecheck, npm test, npm run test:coverage) all pass
10. ✅ Ready to defer or proceed to Phase 18 (analytics, etc.)

---

## Service Layer Placeholder (W3 clarification)

Phase 17 stubs intentionally return "not yet implemented" (501). Future implementation will follow this pattern:

```typescript
// Future: src/services/CalculatorService.ts (not implemented yet)
// This service will consume CalculatorInputs and position-math logic
// Mirrors the frozen public/js/calculator.js compute function
// Code-04 pattern: business logic separated from HTTP concerns
```

Current stubs are deliberately thin — the service architecture is intentional, not a gap.

---

## Notes for Future Implementation

When calculator API is needed in Phase 18 or later:

1. **Access Policy**: `/api/calculator/*` endpoints require CF Access email OTP gate (consistent with `/api/client-log`, Phase 16A DECISION.md precedent)

2. **Implementation Pattern**:
   - Create `src/services/CalculatorService.ts` consuming `CalculatorInputs`/`CalculatorOutputs`
   - Implement `/api/calculator/validate` using schema + service
   - Implement `/api/calculator/compute` using service + position-math logic
   - Remove 501 stub responses, wire real implementations

3. **Performance**:
   - Consider caching results (expensive floating-point math, many users repeat same calcs)
   - Rate-limit endpoint (1000s of calcs per user per minute)
   - Monitor latency (should be <100ms per computation)

4. **Error Handling**:
   - Return detailed error messages for validation failures (leverage out of range, SL/TP conflicts, etc.)
   - Maintain envelope contract: `{ok, data?, error?}`
   - Include liquidation risk and margin requirement in error context

5. **Testing**:
   - Add integration tests for CalculatorService (mock inputs, verify outputs)
   - Add E2E tests (frontend form → API → response visualization)
   - Regression test: verify outputs match frozen `calculator.js` results
