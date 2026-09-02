# Phase 15: Frontend State Refactoring (Chart State Machine)

## Overview

Phase 15 consolidates scattered chart-state management modules into a unified **ChartManager** state machine, improving testability and eliminating race conditions in chart synchronization.

## Problem Statement

The current chart state is fragmented across 4 modules:
- `chart-state.js` — visible range tracking
- `chart-range.js` — range change handlers
- `chart-sync.js` — synchronization logic
- `charts.js` — UI integration

This fragmentation leads to:
1. **Race conditions**: Concurrent zoom/pan/sync operations can corrupt state
2. **Hard to test**: State logic is tightly coupled to DOM/UI events
3. **Maintenance burden**: Related logic spread across files
4. **Sync bugs**: Manual state propagation is error-prone

## Solution

Create a **ChartManager** state machine that:
- Centralizes all chart state (visible range, scale, sync lock, cache)
- Provides atomic state transitions
- Re-entrancy guards prevent race conditions
- Full unit test coverage (40+ tests)
- charts.js becomes a thin UI layer

## Key Deliverables

- ✅ `public/js/managers/ChartManager.ts/js` — State machine implementation
- ✅ `public/js/managers/ChartManager.test.ts/js` — 40+ unit tests
- ✅ Refactored `public/js/charts.js` — Thin UI layer using ChartManager
- ✅ Updated `index.html` — Correct script includes
- ✅ Removed legacy modules — chart-state.js, chart-range.js, chart-sync.js

## Success Criteria

- ✅ ChartManager state machine pattern implemented
- ✅ All state transitions machine-testable
- ✅ Re-entrancy guards prevent race conditions
- ✅ charts.js has ≤10 direct Lightweight Charts API calls
- ✅ 40+ unit tests passing
- ✅ E2E tests verify zoom/pan/sync workflow
- ✅ Code review: zero HIGH issues

## Quick Start

### Review the Plan
```bash
cat .planning/phases/phase-15/PLAN.md
```

### Understand the State Machine
```bash
grep -r "ChartManager" public/js/managers/
```

### Run Tests
```bash
npm test -- public/js/managers/ChartManager.test.ts
npx playwright test charts.spec.ts  # E2E
```

## Dependencies

**Upstream** (Phase 14):
- TemporalConverter (for time-domain conversions in queries)
- Unified divergence types (for data filtering)

**Library Dependencies**:
- Lightweight Charts (existing; v4.0+)
- Vitest (for unit tests)
- Playwright (for E2E tests)

## Architecture

### ChartManager State Machine

```
STATE: {
  visibleRange: {
    startTime: number (seconds),
    endTime: number (seconds)
  },
  scale: 'linear' | 'log',
  syncLock: boolean,
  cache: Map<string, ChartData>
}

TRANSITIONS:
- setVisibleRange(start, end) → state updated
- setScale(type) → state updated
- setSyncLock(bool) → state updated
- getCache() → cached data or fetch
```

### charts.js Refactoring

Before:
```javascript
// Directly manipulates chart state
visibleRange = [start, end];
chart.setData(...);
// Manual sync logic
```

After:
```javascript
// Uses ChartManager
chartManager.setVisibleRange(start, end);
// Sync handled by state machine
```

## Timeline

| Task | Duration | Effort |
|------|----------|--------|
| 15-01: ChartManager Core | 1 day | Medium |
| 15-02: Charts.js Refactoring | 1 day | Medium |
| 15-03: E2E & Code Review | 0.5 day | Low |
| **Total** | **2-3 days** | **Medium** |

## Related Documentation

- **PLAN.md** — Detailed task breakdown
- **IMPLEMENTATION-NOTES.md** (coming) — Design decisions
- **CONTEXT.md** (coming) — Background and constraints

## Next Steps

1. ✅ Run plan-check to validate Phase 15 plan
2. ✅ Execute Phase 15 tasks
3. ✅ Verify with E2E tests
4. ✅ Code review and sign-off (4 warnings fixed)

## Recommended Follow-up: Phase 16 — Structured Logging System

**Decision**: Push structured logging to Phase 16 (separate from Phase 15 frontend refactoring).

**Reason**: Code review found **IN-01** — current code uses `console.error()` instead of structured logging.

**What this means**:
- Phase 15 ships cleanly with ChartManager state machine ✅
- Phase 16 adds observability layer (Sentry / pino / custom logger)
- Future phases benefit from production-grade error tracking

**Phase 16 Scope** (tentative):
- [ ] Evaluate logging libraries (Sentry, pino, custom logger)
- [ ] Integrate structured logging into ChartManager, charts.js, records.js
- [ ] Add user context and telemetry
- [ ] Set up monitoring alerts
- **Duration**: 1-1.5 days
- **Depends on**: Phase 15 ✅

**Why structured logging matters** (see [IN-01 details](15-REVIEW.md#in-01-prefer-structured-logging-over-consoleerror)):
- Track real user errors in production
- Distinguish between abort errors and real failures
- Correlate errors with user journey and device context
- Enable proactive monitoring and alerting

---

*Phase 15 depends on Phase 14 (TemporalConverter, divergence types) being complete.* ✅
