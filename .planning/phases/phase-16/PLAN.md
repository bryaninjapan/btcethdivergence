---
phase: 16
name: Backend Service Deepening (Records Repository)
status: planned
created: 2026-09-02
depends_on: 14
duration: 1-1.5 days
---

# Phase 16 Plan: Backend Service Deepening (Records Repository)

## Overview

Replace the pass-through `recordsService` + `lib/db.ts` record helpers with a single rich `RecordsRepository` class that owns all divergence-record SQL, error translation, and time handling. Route handlers become pure HTTP layer (parse → validate → delegate → format).

**Duration**: 1-1.5 days (≈9.5 focused hours)
**Work Type**: Backend refactor + new query methods + test migration
**Risk Level**: Medium — touches every records endpoint; mitigated by existing route-level integration suite

---

## Success Criteria

| SC# | Criterion |
|-----|-----------|
| SC1 | RecordsRepository exports 8 methods: findAll, findById, listWithStats, findByTimeRange, findByType, create, update, delete |
| SC2 | All record query logic moved from routes and lib/db.ts to RecordsRepository |
| SC3 | Repository accepts D1 instance + injectable temporal clock via constructor |
| SC4 | Every route handler ≤10 lines, HTTP concerns only |
| SC5 | 25+ unit tests using MockD1 (target 41) |
| SC6 | Integration tests pass with zero regressions |
| SC7 | Coverage ≥85%; repository ≥95% |
| SC8 | Code review: zero HIGH/CRITICAL |

---

## Design Decisions (Approved 2026-09-02)

- **listWithStats()**: Simple statistics (totalRecords, byType, byMsb, dateRange)
- **findByTimeRange()**: Overlap semantics (records spanning the window included)
- **No pagination**: Single-owner scale; optional for Phase 17+
- **Delete records.service.ts**: One layer, not two
- **Move record SQL**: All in RecordsRepository, not split across files

---

## Task Breakdown

### 16-01: Extend MockD1 (1 hour)
- Add overlap predicate support
- Guard against silent no-op filtering
- 4 tests + npm test green

### 16-02: Implement Repository (3 hours)
- 8 public methods (findAll, findById, etc.)
- Pure function computeRecordStats()
- JSDoc on all methods
- Remove record functions from db.ts

### 16-03: Unit Tests (2.5 hours)
- 41 test cases covering all methods
- SQL safety + immutability tests
- Coverage ≥95%

### 16-04: Route Refactor (2 hours)
- Rewrite 4 handlers (≤10 lines each)
- Add GET /api/records/stats endpoint
- 6 integration tests
- npm test + E2E green

### 16-05: Review + Docs (1 hour)
- Code review audit
- 16-REVIEW.md, IMPLEMENTATION-NOTES.md
- Update ROADMAP.md, STATE.md

---

## Testing Strategy

- **Unit**: 41 repository cases + 4 MockD1 overlap cases
- **Integration**: existing records.test.ts pass unchanged (regression net)
- **E2E**: records.spec.ts green (81 runs across browsers)
- **Coverage**: 85% global gate; 95% target for repository

---

## Critical Constraints

- DELETE /api/records/1 must issue exactly 1 statement (no pre-SELECT)
- GET /api/records returns an array (not {records, stats})
- Stats on separate /api/records/stats endpoint
- Port SQL verbatim from db.ts (test assertions depend on substrings)

---

## Risks & Mitigations

| Risk | Sev | Mitigation |
|------|-----|-----------|
| MockD1 silently ignores overlap WHERE | High | Task 16-01 first with guard |
| Route test SQL assertions broken | Medium | Port verbatim; treat failures as bugs |
| /stats shadowed by /:id | Medium | Explicit registration order |
| delete() gains pre-SELECT | Low | Explicit in implementation, tested |

---

## Verification Commands

```bash
npm test
npm run typecheck
npm run test:coverage

npx vitest run src/services/RecordsRepository.test.ts
npx playwright test e2e/records.spec.ts
```

---

## Handoff

Phase 16 complete when all SC met and code review yields zero HIGH/CRITICAL.
