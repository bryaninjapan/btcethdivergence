---
phase: 16
name: Backend Service Deepening (Records Repository)
status: planning
created: 2026-09-02
depends_on: 14
---

# Phase 16 Plan: Backend Service Deepening

## Overview

Elevate the thin RecordsService into a rich RecordsRepository with advanced query methods (listWithStats, findByTimeRange, etc.), improving testability and consolidating query logic.

**Duration**: 2 days  
**Work Type**: Service layer deepening + refactoring  
**Risk Level**: Medium (database operations, needs integration testing)

---

## Goals

1. **RecordsRepository Interface**: Define rich query methods (findAll, findById, listWithStats, findByTimeRange, etc.)
2. **Query Consolidation**: Move all query logic from route handlers into RecordsRepository
3. **SQL Safety**: Use parameterized queries, avoid dynamic SQL injection
4. **Thin Routes**: Simplify route handlers to ≤10 lines (pure HTTP concerns)
5. **Test Coverage**: 25+ unit tests using Mock D1, integration tests for all routes

---

## Scope

### Files to Create
- `src/services/RecordsRepository.ts` — rich repository with advanced queries
- `src/services/RecordsRepository.test.ts` — 25+ unit tests

### Files to Refactor
- `src/routes/records.ts` — remove query logic, use RecordsRepository
- `src/services/RecordsService.ts` — adjust if needed (may become thin wrapper or merge into RecordsRepository)

### Files to Update
- `src/types.ts` — review repository interfaces
- Test suite: ensure all integration tests pass

---

## Success Criteria

- [ ] RecordsRepository class created with methods: `findAll()`, `findById(id)`, `listWithStats()`, `findByTimeRange(start, end)`, `findByType(type)`, `create()`, `update()`, `delete()`
- [ ] All query logic moved from route handlers to RecordsRepository
- [ ] All queries use parameterized SQL (no dynamic injection risk)
- [ ] Route handlers simplified to ≤10 lines per endpoint
- [ ] 25+ RecordsRepository unit tests passing (Mock D1)
- [ ] All integration tests passing (routes still work)
- [ ] Code coverage ≥85% for repository layer
- [ ] Code review: zero HIGH issues

---

## Task Breakdown

### Task 16-01: RecordsRepository Implementation (1.5 days)

**Objectives**:
1. Design RecordsRepository interface
2. Implement all query methods with parameterized SQL
3. Write 25+ unit tests using Mock D1
4. Integrate temporal-api (from Phase 14) for time operations

**Subtasks**:
- [ ] 16-01-1: Define RecordsRepository interface and method signatures
- [ ] 16-01-2: Implement `findAll()` with sorting/pagination
- [ ] 16-01-3: Implement `findById(id)` 
- [ ] 16-01-4: Implement `listWithStats()` (count, avg duration per type)
- [ ] 16-01-5: Implement `findByTimeRange(start, end)` with temporal-api
- [ ] 16-01-6: Implement `findByType(type)` with temporal-api
- [ ] 16-01-7: Implement CRUD operations (create, update, delete)
- [ ] 16-01-8: Write RecordsRepository unit tests (25+, Mock D1)
- [ ] 16-01-9: Verify all SQL queries are parameterized

**Expected Deliverables**:
- `src/services/RecordsRepository.ts` — full implementation
- `src/services/RecordsRepository.test.ts` — 25+ tests passing
- All queries using parameterized SQL

---

### Task 16-02: Route Handler Refactoring + Testing (0.5 days)

**Objectives**:
1. Refactor routes/records.ts to use RecordsRepository
2. Simplify route handlers
3. Run integration tests
4. Verify no regressions

**Subtasks**:
- [ ] 16-02-1: Update GET /api/records to use repository.findAll()
- [ ] 16-02-2: Update GET /api/records/:id to use repository.findById()
- [ ] 16-02-3: Update POST /api/records to use repository.create()
- [ ] 16-02-4: Update PUT /api/records/:id to use repository.update()
- [ ] 16-02-5: Update DELETE /api/records/:id to use repository.delete()
- [ ] 16-02-6: Verify all route handlers ≤10 lines
- [ ] 16-02-7: Run integration tests (all routes should pass)
- [ ] 16-02-8: Code review + sign-off

**Expected Deliverables**:
- Refactored `src/routes/records.ts` (thin HTTP layer)
- All integration tests passing
- Zero regressions

---

## Dependencies

- **Blocks**: None (can run parallel with Phase 15)
- **Blocked By**: Phase 14 ✅ (temporal-api available)
- **Related**: Phase 15 (independent refactoring), Phase 17 (uses RecordsRepository patterns)

---

## Testing Strategy

### Unit Tests (25+)
- RecordsRepository: findAll, findById, listWithStats, findByTimeRange, findByType
- CRUD operations (create, update, delete)
- SQL parameterization verification
- Mock D1 ensuring correct query structure

### Integration Tests
- All existing route tests must pass (no regressions)
- Verify routes correctly delegate to RecordsRepository
- End-to-end workflow: create → read → update → delete

### Manual QA (if needed)
- Verify records still display correctly
- Verify filtering by time range works
- Verify stats calculations accurate

---

## Rollback Plan

If issues found:
1. Revert routes/records.ts changes
2. Keep RecordsRepository for future use
3. Analyze issue and retry Phase 16 later

---

## Time Estimate

| Task | Estimate | Status |
|------|----------|--------|
| 16-01 (RecordsRepository) | 1.5 days | Ready to start after Phase 14 |
| 16-02 (Route refactoring + tests) | 0.5 days | Ready to start |
| **Total Phase 16** | **2 days** | **Planned after Phase 14** |

---

## Handoff Criteria

Phase 16 is complete when:
1. ✅ RecordsRepository fully implemented with rich query interface
2. ✅ All queries use parameterized SQL (no injection risk)
3. ✅ Routes refactored to use RecordsRepository (≤10 lines each)
4. ✅ 25+ RecordsRepository unit tests passing
5. ✅ All integration tests passing (no regressions)
6. ✅ Code coverage ≥85% for repository layer
7. ✅ Code review complete (zero HIGH issues)
8. ✅ Ready to unblock Phase 17
