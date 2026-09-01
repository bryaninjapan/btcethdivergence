---
phase: 15
name: Frontend State Refactoring (Chart State Machine)
status: planning
created: 2026-09-02
depends_on: 14
---

# Phase 15 Plan: Frontend State Refactoring

## Overview

Merge four scattered chart state modules (chart-state.js, chart-range.js, chart-sync.js, charts.js) into a unified ChartManager state machine for better testability and maintainability.

**Duration**: 2-3 days  
**Work Type**: Refactoring + state machine consolidation  
**Risk Level**: Medium (UI logic, needs E2E verification)

---

## Goals

1. **ChartManager State Machine**: Unified module encapsulating all chart state (visible range, log/linear, sync lock, data cache)
2. **Module Elimination**: Remove chart-state.js, chart-range.js, chart-sync.js (consolidate into ChartManager)
3. **Re-entrancy Guarantees**: Prevent race conditions in sync operations
4. **Test Coverage**: 40+ unit tests verifying state transitions and edge cases

---

## Scope

### Files to Create
- `public/js/managers/ChartManager.ts` or `.js` — unified state machine

### Files to Refactor
- `public/js/charts.js` — use ChartManager exclusively
- Remove: `public/js/chart-state.js`, `public/js/chart-range.js`, `public/js/chart-sync.js`

### Files to Update
- `index.html` — update script includes (remove old modules, add ChartManager)

---

## Success Criteria

- [ ] ChartManager class created with state machine pattern
- [ ] All chart state transitions machine-testable
- [ ] Re-entrancy guards prevent race conditions
- [ ] charts.js refactored to use ChartManager (≤5 direct Lightweight Charts API calls)
- [ ] Old modules (chart-state.js, chart-range.js, chart-sync.js) removed
- [ ] 40+ unit tests passing (state transitions, sync, edge cases)
- [ ] E2E tests pass (zoom/pan/sync workflow works)
- [ ] Code review: zero HIGH issues

---

## Task Breakdown

### Task 15-01: ChartManager Core Implementation (1 day)

**Objectives**:
1. Design state machine for chart states
2. Implement TemporalConverter integration (from Phase 14)
3. Implement re-entrancy guards
4. Write 20+ unit tests

**Subtasks**:
- [ ] 15-01-1: Design ChartManager state interface
- [ ] 15-01-2: Implement visible range management
- [ ] 15-01-3: Implement log/linear scale toggling
- [ ] 15-01-4: Implement sync lock and re-entrancy guards
- [ ] 15-01-5: Write ChartManager unit tests (20+)
- [ ] 15-01-6: Verify state transitions are correct

**Expected Deliverables**:
- `public/js/managers/ChartManager.ts/js` — state machine implementation
- `public/js/managers/ChartManager.test.ts/js` — 20+ tests passing

---

### Task 15-02: Charts.js Refactoring (1 day)

**Objectives**:
1. Refactor charts.js to use ChartManager
2. Simplify charts.js to thin UI layer
3. Remove old chart modules from HTML

**Subtasks**:
- [ ] 15-02-1: Update charts.js initialization (use ChartManager)
- [ ] 15-02-2: Update chart range change handlers
- [ ] 15-02-3: Update sync handlers
- [ ] 15-02-4: Update scale toggle handlers
- [ ] 15-02-5: Verify charts.js is thin (≤10 direct Lightweight Charts calls)
- [ ] 15-02-6: Update index.html script includes
- [ ] 15-02-7: Delete old modules (chart-state.js, chart-range.js, chart-sync.js)

**Expected Deliverables**:
- Refactored `public/js/charts.js` using ChartManager
- Updated `index.html` with correct script includes
- Old modules removed

---

### Task 15-03: Testing + E2E Verification (0.5-1 day)

**Objectives**:
1. Write 20+ additional integration tests
2. Run E2E tests (critical workflows)
3. Verify no performance regressions

**Subtasks**:
- [ ] 15-03-1: Write ChartManager integration tests (20+)
- [ ] 15-03-2: Run existing E2E tests (8/8 should pass)
- [ ] 15-03-3: Manual testing: zoom, pan, sync, scale toggle
- [ ] 15-03-4: Performance check (no laggy interactions)
- [ ] 15-03-5: Code review + sign-off

**Expected Deliverables**:
- 40+ total tests passing (20 unit + 20 integration)
- All 8 E2E tests passing
- No performance regressions

---

## Dependencies

- **Blocks**: None (can run parallel with Phase 16)
- **Blocked By**: Phase 14 ✅ (temporal-api available)
- **Related**: Phase 16 (independent refactoring)

---

## Testing Strategy

### Unit Tests (20+)
- State transitions (range, scale, sync state changes)
- Re-entrancy guard behavior
- Edge cases (rapid zoom, invalid ranges, missing data)

### Integration Tests (20+)
- Full chart interaction workflows
- Multiple rapid state changes
- Sync between two charts under stress

### E2E Tests
- All 8 existing E2E tests must pass
- Manual verification: zoom/pan workflow smooth

---

## Rollback Plan

If issues found:
1. Revert changes to charts.js and index.html
2. Restore old modules from git
3. Analyze root cause and retry

---

## Time Estimate

| Task | Estimate | Status |
|------|----------|--------|
| 15-01 (ChartManager) | 1 day | Ready to start after Phase 14 |
| 15-02 (charts.js refactoring) | 1 day | Ready to start after Phase 14 |
| 15-03 (Testing + E2E) | 0.5-1 day | Ready to start |
| **Total Phase 15** | **2.5 days** | **Planned after Phase 14** |

---

## Handoff Criteria

Phase 15 is complete when:
1. ✅ ChartManager state machine implemented
2. ✅ charts.js refactored to use ChartManager
3. ✅ Old modules removed
4. ✅ 40+ tests passing (unit + integration)
5. ✅ All 8 E2E tests passing
6. ✅ Code review complete (zero HIGH issues)
7. ✅ No performance regressions
8. ✅ Ready for Phase 16 + Phase 17
