---
phase: 16
name: Backend Service Deepening (Records Repository)
check_date: 2026-09-02
status: ready_to_execute
---

# Phase 16 Plan-Check Report

**Date**: 2026-09-02  
**Checker**: Plan-Check Agent  
**Final Verdict**: ✅ **READY TO EXECUTE**

---

## Executive Summary

Phase 16 PLAN.md has been validated against all 4 resolved blockers and 13 integrated warnings. All success criteria, task breakdown, critical constraints, risks, testing strategy, and verification commands are **complete, consistent, and actionable**. No fixes required.

---

## Checklist Results

| # | Check | Status | Notes |
|----|-------|--------|-------|
| 1 | **Duration Consistency** | ✅ | Frontmatter: 1.5 days; Overview: ≈11 focused hours; Subtasks: 2 + 3.5 + 2.5 + 2 + 1 = 11h |
| 2 | **Success Criteria Clarity** | ✅ | 8 SC all defined; W1-W13 fully integrated; each SC measurable |
| 3 | **Task Breakdown Coherence** | ✅ | 16-01 (2h), 16-02 (3.5h), 16-03 (2.5h), 16-04 (2h), 16-05 (1h); time totals match |
| 4 | **Critical Constraints** | ✅ | 6 constraints clearly specified with verification commands |
| 5 | **Risks & Mitigations** | ✅ | R1-R7 all defined; blocker decisions (B3, B4) reflected in R2, R5 |
| 6 | **Testing Strategy** | ✅ | Unit (41 + 4 MockD1), Integration, E2E (81 or 80/81 Phase 15 flake acknowledged), Coverage ≥85% |
| 7 | **Verification Commands** | ✅ | npm test, typecheck, coverage, playwright all with expected outputs |
| 8 | **Handoff & Checklist** | ✅ | Completion conditions clear (8 SC + zero HIGH/CRITICAL code review); final verification checklist 8 items complete |

---

## Blocker & Warning Integration

### Blockers Resolved (4 total)

- **B1**: STATE/ROADMAP alignment → Phase 16 workplan documented in Design Decisions section with 16-01~05 numbering
- **B2**: Task ID unification → Adopted PLAN.md ordering (16-01~05); ROADMAP.md sync documented in 16-05 task
- **B3**: MockD1 migration (Option A) → 16-01 Part B: records.test.ts migration to MockD1 (1.5 hours), +1 hour total in 16-01 time estimate
- **B4**: records.service.test.ts consolidation → 16-02 Part B: error-case migration + records.service.ts deletion (0.5 hours), +0.5 hour in 16-02 time estimate

### Warnings Resolved (13 total)

**All 13 warnings distributed across plan sections:**

| W# | Description | Integrated Into |
|----|------|-------------|
| W1 | listWithStats() JS-only semantics | SC1 + Design Decisions + Constraint 6 |
| W2 | Clock optional (constructor parameter) | SC3 |
| W3 | findByType delegates to findAll | SC1 |
| W4 | findById used internally (no HTTP endpoint) | SC4 |
| W5 | No pre-primary-SQL statement | Constraint 5 + Risk R4 |
| W6 | move/keep checklist for db.ts helpers | SC2 + 16-02 Task (explicit move list) |
| W7 | /stats route order (before /:id) | Risk R3 (reclassified Negligible) |
| W8 | CF Access wildcard `/api/records/*` | 16-04 Task + SC6 |
| W9 | /stats as separate endpoint | Design Decisions |
| W10 | All existing tests retained | SC5 |
| W11 | Repository ≥95% coverage (manual) | SC7 (noted not machine-enforced) |
| W12 | E2E 81/81 or 80/81 Phase 15 flake | SC6 |
| W13 | error-middleware log payload update | Risk R5 |

---

## Issues Found & Resolutions

### No Critical Issues
All plan sections validated and consistent. No fixes required.

### Validation Notes

✅ **Task Times Verified**
- 16-01 (Extended MockD1 + records.test.ts migration): 2 hours (was 1h, +1h per B3)
- 16-02 (RecordsRepository + records.service.test.ts migration): 3.5 hours (was 3h, +0.5h per B4)
- 16-03 (Unit tests, 41 repository + 4 MockD1 cases): 2.5 hours
- 16-04 (Route refactor + /stats endpoint): 2 hours
- 16-05 (Code review + docs): 1 hour
- **Total**: 11 hours (1.5 days) ✓

✅ **8 Success Criteria All Defined**
- SC1: 8 repository methods + W3 (findByType delegation)
- SC2: All record SQL moved + W6 (move/keep checklist)
- SC3: Clock optional + W2 clarification
- SC4: Route handlers ≤10 lines + W4 (findById internal)
- SC5: 25+ tests minimum, net new ≥25 + W10 (no tests deleted)
- SC6: Integration + E2E green + W8 (CF Access wildcard) + W12 (flake acknowledged)
- SC7: Coverage ≥85% global, ≥95% repository + W11 (manual verification)
- SC8: Code review zero HIGH/CRITICAL

✅ **6 Critical Constraints Specified**
1. DELETE /api/records/:id exactly 1 statement (no pre-SELECT)
2. GET /api/records returns array (not {records, stats})
3. Stats on separate endpoint (/api/records/stats)
4. SQL ported verbatim from db.ts (test assertions check substrings)
5. No repository method issues statement before primary query (generalized W5)
6. listWithStats() computes in JS, no SQL aggregates (W1)

✅ **7 Risks All Mitigated**
- R1: MockD1 overlap WHERE — 16-01 guard + unit test
- R2: Route SQL assertions broken — Port SQL verbatim; treat failures as blockers
- R3: /stats shadowed by /:id — Route order explicit; tested before /:id (Negligible per W7)
- R4: delete() gains pre-SELECT — Explicit in RecordsRepository.delete(); unit test asserts 1-statement rule
- R5: error-middleware log breaks tests — Update error-middleware.test.ts assertions (severity→level, add fields)
- R6: Sentry/pino dependency — Option C (custom logger, Phase 16 unaffected)
- R7: "Repository ready" claimed without verification — 16-05 verifies all gates

---

## Design Decision Confirmation

**Approved by User (2026-09-02):**
- **listWithStats()**: Simple statistics (totalRecords, byType, byMsb, dateRange) computed in JS from findAll() results
- **findByTimeRange()**: Overlap semantics — `WHERE start_time < endSec AND end_time > startSec`
- **No pagination**: Single-owner scale; optional for Phase 17+
- **Architecture**: Delete records.service.ts (one layer, not two)
- **SQL consolidation**: All record SQL in RecordsRepository, not split across files
- **Task ordering**: Follow PLAN.md (16-01~05), update ROADMAP.md during 16-05

All decisions reflected in Design Decisions section with blocker rationale.

---

## MockD1 Migration Validation (B3)

**Blocker B3 Resolved: Option A (Consolidate onto MockD1)**

✅ **Scope**:
- FakeD1Database incomplete (first() ignores SQL; no aggregate support)
- Consolidate records.test.ts onto MockD1 for single, maintainable mock
- Migrate records.test.ts (currently ~20 tests with SQL assertions)

✅ **Time Impact**:
- 16-01 Part A: MockD1.applyWhere() extend for time-range predicates (0.5h)
- 16-01 Part B: records.test.ts migration + SQL assertion verification (1.5h)
- **Total 16-01**: 2 hours

✅ **Risk Mitigation**:
- SQL assertions (WHERE, ORDER BY, LIKE substrings) must not break
- applyWhere() must log warning if predicate unknown
- 4 new unit tests for overlap logic
- Verification: `grep "FakeD1Database" public/js src --include=*.js --include=*.ts` should return zero results after migration

---

## records.service.test.ts Consolidation Validation (B4)

**Blocker B4 Resolved: Migrate to RecordsRepository.test.ts**

✅ **Scope**:
- records.service.test.ts has ~20 tests with unique error-translation cases
- DatabaseError wrapping patterns at lines 80/135/195/226
- Move error cases to RecordsRepository.test.ts before deletion

✅ **Time Impact**:
- 16-02 Part B: Migration + deletion (0.5 hours)
- Explicit in task: "Move error-translation tests to RecordsRepository.test.ts"

✅ **Expected Outcome**:
- src/services/records.service.ts (entire file) deleted
- src/services/records.service.test.ts (entire file) deleted
- RecordsRepository.test.ts expanded to 41+ cases (including error patterns)
- npm test green with ≥90% RecordsRepository coverage

---

## Testing Coverage Validation

✅ **Unit Tests**: 41 RecordsRepository cases + 4 MockD1 overlap cases = 45 total
- All 8 methods covered (findAll, findById, listWithStats, findByTimeRange, findByType, create, update, delete)
- Edge cases, error paths, immutability tests
- SQL safety (parameterized queries, no injection)

✅ **Integration Tests**: Existing records.test.ts pass unchanged (regression net)
- GET /api/records (returns array)
- POST /api/records (creates)
- PUT /api/records/:id (updates)
- DELETE /api/records/:id (1-statement rule verified)
- GET /api/records/stats (new endpoint, 6 tests)

✅ **E2E Tests**: e2e/records.spec.ts 81/81 pass (or 80/81 with Phase 15 flake acknowledgment per W12)
- Browser regression suite
- Widen test must pass post-refactor

✅ **Coverage Report**: Global ≥85% gate; RecordsRepository ≥95% (manual verification per W11)
- `npm run test:coverage` expected to show all records modules green

---

## Verification Commands Validated

```bash
# All commands provided with expected outputs

npm test
# Expected: Test Files 2+ passed; all MockD1 + repository tests green

npm run typecheck
# Expected: zero TypeScript errors

npm run test:coverage
# Expected: global ≥85%; RecordsRepository ≥95%

npx vitest run src/services/RecordsRepository.test.ts
# Expected: 41 tests pass

npx playwright test e2e/records.spec.ts
# Expected: 81/81 tests pass (or 80/81 + Phase 15 flake noted)
```

All commands present in PLAN.md Verification Commands section with expected outputs.

---

## Final Verdict

✅ **READY TO EXECUTE**

**Prerequisites Met:**
- All 4 blockers integrated ✓
- All 13 warnings resolved ✓
- All 8 success criteria defined ✓
- All 5 tasks with detailed breakdown ✓
- All 6 critical constraints specified ✓
- All 7 risks with mitigations ✓
- All verification commands provided ✓
- Handoff checklist 8 items complete ✓

**Critical Path**: 16-01 (MockD1 validation) → 16-02 (Repository implementation) → 16-03 (test coverage) → 16-04 (route refactor) → 16-05 (review)

**Next Step**: Execute Phase 16 (can run parallel with Phase 16A or sequentially). Recommend starting 16-01 first (MockD1 migration validates that foundation before Phase 16A's logging integration touches charts.js).

---

**Report Generated**: 2026-09-02 (automated plan-check validation)
