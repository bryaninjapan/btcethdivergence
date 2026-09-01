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

**Duration**: 0.5 days  
**Work Type**: Schema extraction + API preparation  
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
- `src/domains/calculator-rules.ts` — Zod schemas for validation
- `src/routes/calculator.ts` — future API endpoints (stubs)

### Files to Keep Unchanged
- `public/js/calculator.js` — no changes (client-side logic unchanged)

### Files to Update
- Documentation (if needed)

---

## Success Criteria

- [ ] CalculatorInputs Zod schema created (margin, entry, SL, TP, leverage)
- [ ] CalculatorOutputs Zod schema created (position size, risk/reward, warnings)
- [ ] Schemas handle edge cases (SL validation, liquidation thresholds)
- [ ] Frontend and backend can import schemas from calculator-rules.ts
- [ ] Future API endpoints created as stubs: `/api/calculator/validate`, `/api/calculator/compute`
- [ ] 15+ unit tests passing (validation edge cases)
- [ ] Code review: zero HIGH issues

---

## Task Breakdown

### Task 17-01: Calculator Validation Schemas + API Preparation (0.5 days)

**Objectives**:
1. Create calculator validation schemas
2. Handle edge cases (margin vs SL, liquidation)
3. Create API endpoint stubs
4. Write 15+ unit tests

**Subtasks**:
- [ ] 17-01-1: Design CalculatorInputs schema (with validation rules)
- [ ] 17-01-2: Design CalculatorOutputs schema (with computed fields)
- [ ] 17-01-3: Implement edge case validation (SL > margin = liquidation warning)
- [ ] 17-01-4: Create `/api/calculator/validate` stub endpoint
- [ ] 17-01-5: Create `/api/calculator/compute` stub endpoint
- [ ] 17-01-6: Write calculator validation unit tests (15+)
- [ ] 17-01-7: Document schemas for future API implementation
- [ ] 17-01-8: Code review + sign-off

**Expected Deliverables**:
- `src/domains/calculator-rules.ts` — Zod schemas
- `src/routes/calculator.ts` — stub endpoints (return "not yet implemented")
- `src/domains/calculator-rules.test.ts` — 15+ tests passing
- Documentation for API expansion

---

## Dependencies

- **Blocks**: None (optional, does not block future phases)
- **Blocked By**: Phase 16 (patterns established, can proceed after)
- **Related**: None (independent task)

---

## Testing Strategy

### Unit Tests (15+)
- CalculatorInputs schema validation (valid/invalid inputs)
- CalculatorOutputs schema validation
- Edge cases: liquidation threshold, negative values, extreme leverage
- Margin vs. SL comparison (warning conditions)

### Manual QA
- None required (no UI changes, stubs only)

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
| 17-01 (Schemas + stubs) | 0.5 days | Optional, ready to start after Phase 16 |
| **Total Phase 17** | **0.5 days** | **Optional, can be skipped** |

---

## Handoff Criteria

Phase 17 is complete when (or can be deferred):
1. ✅ CalculatorInputs and CalculatorOutputs schemas defined
2. ✅ Schemas handle all edge cases (liquidation, extremes)
3. ✅ `/api/calculator/validate` and `/api/calculator/compute` stubs created
4. ✅ 15+ unit tests passing
5. ✅ Code review complete (zero HIGH issues)
6. ✅ Documentation ready for future API implementation
7. ✅ Ready to defer or proceed to Phase 18 (analytics, etc.)

---

## Notes for Future Implementation

When calculator API is needed in Phase 18 or later:
1. Implement `/api/calculator/validate` using CalculatorInputs schema
2. Implement `/api/calculator/compute` using CalculatorOutputs schema
3. Consider caching results (expensive floating-point math)
4. Rate-limit endpoint to prevent abuse (1000s of calcs per user)
5. Return detailed error messages for validation failures
