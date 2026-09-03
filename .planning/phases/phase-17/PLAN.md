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

- [ ] SC1: CalculatorInputs Zod schema created with 6 fields (margin, **entryPrice**, stopLoss, **takeProfitPrice**, leverage, **longShort**)
- [ ] SC2: CalculatorOutputs Zod schema created with computed output fields (positionSize, stopLossAmount, takeProfitAmount, riskRewardRatio, lossRatePercent, gainRatePercent, isValid, errorMessage, warnings: {riskRewardTooLow, liquidationRisk})
- [ ] SC3: API endpoints created as stubs with correct envelope (return `{ok: false, error: {code, message}}` + 501); endpoints registered in `src/index.ts`; 5+ contract tests written
- [ ] SC4: Schemas shared via .js mirror + parity test (divergence.js precedent)
  - Backend: `src/domains/calculator-rules.ts` (Zod schemas)
  - Frontend: `public/js/calculator-rules.js` (plain-JS mirror of constants/field lists)
  - Sync enforced by parity test in `src/domains/calculator-rules.test.ts`
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
  **Done when**: 6 fields validated (margin, **entryPrice**, stopLoss, **takeProfitPrice**, leverage, longShort); field names match frozen client param names (calculator.js:6-9, calculator-init.js:14-16); **longShort uses z.transform to normalize direction values (LONG→long, SHORT→short, etc.) matching calculator.js:66-69 normalizeDirection() behavior** (TDD verified: 10/10 test cases pass, 95% coverage); direction-dependent SL/TP rules in .refine(); error messages match calculator.js strings; MAX_LEVERAGE/MIN_LEVERAGE exported as 125/1

- [ ] 17-01-2: Design CalculatorOutputs schema
  **Done when**: Computed output fields enumerated (positionSize, stopLossAmount, takeProfitAmount, riskRewardRatio, lossRatePercent, gainRatePercent, isValid, errorMessage); warnings subobject {riskRewardTooLow, liquidationRisk} enumerated (calculator.js:27, 59-62); schema structure matches calculatePosition() return shape (calculator.js:12-28)

- [ ] 17-01-3: Implement edge case validation
  **Done when**: liquidation threshold tests pass; margin vs leverage × entry validation; SL/TP direction tests (long vs short); leverage bound tests (1–125); all conditions raise appropriate warnings

- [ ] 17-01-4: Create `/api/calculator/validate` stub endpoint
  **Done when**: POST /api/calculator/validate returns `{ok: false, error: {code: ErrorCode.INTERNAL_ERROR, message: 'Not yet implemented'}}` with HTTP 501 status (follows notFound handler pattern in src/index.ts:53-62); rejects invalid CalculatorInputs schema with HTTP 400 + `error.code === 'VALIDATION_ERROR'` + non-empty `error.message` (sanitized envelope; raw zod issues excluded per errorMiddleware); respects CF Access gate (email OTP)

- [ ] 17-01-4.5 (NEW): Register calculator routes in `src/index.ts`
  **Done when**: `app.route('/', calculator)` added to src/index.ts (after records route); curl /api/calculator/validate returns 501 (not 404); route order verified in code review

- [ ] 17-01-5: Create `/api/calculator/compute` stub endpoint + contract tests
  **Done when**: POST /api/calculator/compute returns same 501 envelope; `src/routes/calculator.test.ts` written with ≥5 test cases (valid input, invalid schema, boundary values, CORS boundary case, envelope format verified); all tests passing (auth is edge-enforced via CF Access, not in-code)

- [ ] 17-01-1.5 (NEW): Create frontend mirror + parity test (SC4 implementation)
  **Done when**: `public/js/calculator-rules.js` exports schema-derived constants (field lists, MAX/MIN_LEVERAGE, error strings) matching backend; parity test in `src/domains/calculator-rules.test.ts` asserts `calculator-rules.ts` ↔ `calculator-rules.js` sync exactly (divergence.js+divergence.test.ts pattern); extended parity test also verifies `calculator-rules.ts` exports match frozen `calculator.js` constants (source-of-truth guard); mirror enables SC2-frozen client.js to reference shared constants in future versions

- [ ] 17-01-6: Write calculator validation unit tests (15+)
  **Done when**: ≥15 tests passing (field validation, margin/SL rules, liquidation warnings, leverage bounds, direction-dependent rules, longShort normalize cases, parity test); `npm run test:coverage` returns global ≥85% (vitest enforces global aggregate only, new files contribute to total)

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
- Valid CalculatorInputs: returns 501 with correct envelope `{ok: false, error: {code: INTERNAL_ERROR, ...}}`
- Invalid schema: returns 400 with `error.code === 'VALIDATION_ERROR'` + non-empty `error.message` (sanitized; raw zod issues excluded per errorMiddleware)
- Boundary values: leverage=1, leverage=125 (limits enforced)
- Envelope format: 501 response matches `{ok: false, error{code, message}}` shape (no raw text)
- CORS boundary: stub does not duplicate CF Access auth (edge-enforced); request without auth headers still reaches 501 handler (mirroring client-log.test.ts:85-98 pattern)

### Manual QA
- None required (no UI changes, stubs only)

---

## Task Granularity Note (W4)

This phase uses 1 task with 10 subtasks (17-01-1...8 + 17-01-4.5 + 17-01-1.5) rather than 2-3 tasks per phase standard. While the work is cohesive and sequential (not parallelizable), future optimization could split into:
- **17-01**: Schemas + validation tests (4 subtasks)
- **17-02**: API stubs + registration (3 subtasks)
- **17-03**: Frontend mirror + parity (3 subtasks)

Current structure is acceptable for execution; recommend granularity review in post-execution retrospective.

---

## Verification Commands

Run after implementation to verify all success criteria met:

```bash
# TypeScript check
npm run typecheck

# Unit + endpoint tests
npm test -- calculator-rules
npm test -- calculator.test

# Coverage verification (repo threshold: 85% global)
npm run test:coverage
# Expected: global aggregate ≥85% line coverage (new files contribute toward this total)

# SC2 regression verification (calculator.js unchanged)
npm test -- public/js/calculator
git diff --stat public/js/calculator.js
# Expected: calculator.test.ts passes; git diff shows no changes to frozen file

# Manual endpoint test (after deploy)
curl -X POST http://localhost:8787/api/calculator/validate \
  -H "Content-Type: application/json" \
  -d '{"margin": 1000, "entryPrice": 100, "stopLoss": 95, "takeProfitPrice": 110, "leverage": 10, "longShort": "long"}' \
# Expected: { "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "Not yet implemented" } } with HTTP 501
# Note: CF Access OTP auth is enforced at the edge (gateway), not in Worker code
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
| 17-01-6,7,8 (Unit tests + docs + review) | 0.1 days | Includes 15+ tests + access policy documentation + W1/W3 fixes |
| **Total Phase 17** | **0.75 days** | **Revised from 0.5 days; optional, can be skipped** |

---

## Handoff Criteria

Phase 17 is complete when (all success criteria met, or can be deferred):
1. ✅ SC1: CalculatorInputs schema with 6 fields (including longShort) + direction-dependent rules
2. ✅ SC2: CalculatorOutputs schema with 9 fields matching calculator.js output
3. ✅ SC3: `/api/calculator/validate` and `/api/calculator/compute` stubs registered in src/index.ts; ≥5 contract tests written and passing
4. ✅ SC4: Frontend mirror (public/js/calculator-rules.js) created; parity test verifies sync
5. ✅ SC5: Edge case validation (liquidation, leverage bounds 1–125, direction-dependent SL/TP)
6. ✅ SC6: 15+ unit tests passing (including parity test); global coverage ≥85%
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
