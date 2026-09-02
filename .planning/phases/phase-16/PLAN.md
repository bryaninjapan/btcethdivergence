---
phase: 16
name: Backend Service Deepening (Records Repository)
status: planned
created: 2026-09-02
depends_on: 14
duration: 1.5 days
---

# Phase 16 Plan: Backend Service Deepening (Records Repository)

<!-- REVISED 2026-09-02: Plan-check corrections applied per blocker resolution
  B1: STATE/ROADMAP aligned
  B2: Task ID unified (PLAN.md → ROADMAP.md sync)
  B3: MockD1 migration (Option A) — 16-01 time 1h → 2h
  B4: records.service.test.ts migration — 16-02 time +0.5h
  Total: 9.5h → 11h (1.5 days)
  All 13 warnings integrated into SC/design sections
-->

## Overview

Replace the pass-through `recordsService` + `lib/db.ts` record helpers with a single rich `RecordsRepository` class that owns all divergence-record SQL, error translation, and time handling. Route handlers become pure HTTP layer (parse → validate → delegate → format).

**Duration**: 1.5 days (≈11 focused hours)
**Work Type**: Backend refactor + new query methods + MockD1 migration + test file consolidation
**Risk Level**: Medium — touches every records endpoint; mitigated by existing route-level integration suite

---

## Success Criteria

<!-- REVISED 2026-09-02: Warnings W1-W13 integrated; SC clarified per plan-check findings -->

| SC# | Criterion |
|-----|-----------|
| SC1 | RecordsRepository exports 8 methods: findAll, findById, listWithStats, findByTimeRange, findByType, create, update, delete. **W3**: findByType delegates to findAll({type}), no duplicate SQL. |
| SC2 | All record query logic moved from routes and lib/db.ts to RecordsRepository. **W6**: Helper escapeLikeWildcards also moved; move/keep checklist verified. |
| SC3 | Repository constructor: `constructor(db: D1Database, now?: () => number)`. **W2**: Clock optional, defaults to TemporalConverter.dateToSec(new Date). |
| SC4 | Every route handler ≤10 lines, HTTP concerns only. **W4**: findById used internally by update() (merge + 404); no HTTP endpoint for findById. |
| SC5 | 25+ unit tests (minimum gate), target 41. Net new after records.service.test.ts migration ≥25. **W10**: All existing tests retained, none deleted. |
| SC6 | Integration tests pass: all routes green including GET /api/records/stats. **W2**: /stats path verified under Cloudflare Access policy (wildcard `/api/records/*`). **W12**: 81/81 E2E or 80/81 if Phase 15 flaky test reproduces; re-run until green. |
| SC7 | Coverage ≥85% (global); repository layer ≥95%. **W11**: Manual inspection confirms repository module ≥95% (not machine-enforced by tsconfig.json). |
| SC8 | Code review: zero HIGH/CRITICAL. |

---

## Design Decisions (Approved 2026-09-02)

### Approved Design

- **listWithStats()**: Simple statistics (totalRecords, byType, byMsb, dateRange) — **W1**: computed in JS from findAll() results; no SQL COUNT/GROUP BY
- **findByTimeRange()**: Overlap semantics (records spanning the window included) — `WHERE start_time < endSec AND end_time > startSec`
- **No pagination**: Single-owner scale; optional for Phase 17+
- **Delete records.service.ts**: One layer, not two
- **Move record SQL**: All in RecordsRepository, not split across files

### Plan-Check Blocker Decisions (2026-09-02)

**B2 — Task ID Unification**: Adopt PLAN.md編號順序, update ROADMAP.md to match
  - 16-01: Extend MockD1 overlap predicate + migrate records.test.ts (2 hours, was 1)
  - 16-02: Implement RecordsRepository + migrate records.service.test.ts (3.5 hours, was 3)
  - 16-03: Unit tests (2.5 hours, unchanged)
  - 16-04: Route refactor + stats endpoint (2 hours, unchanged)
  - 16-05: Review + docs (1 hour, unchanged)

**B3 — MockD1 Migration (Option A)**: Consolidate src/routes/records.test.ts onto MockD1
  - Rationale: FakeD1Database incomplete (first() ignores SQL; no aggregate support). One mock reduces maintenance.
  - Risk: SQL assertions must not break (line 386-388 of records.test.ts check WHERE/ORDER BY/LIKE substrings)
  - 16-01 adds: migrate records.test.ts → MockD1, verify SQL assertions green
  - Time impact: +1 hour in 16-01

**B4 — records.service.test.ts Migration**: Consolidate into RecordsRepository.test.ts
  - records.service.test.ts has ~20 tests with unique error-translation cases (DatabaseError wrapping, lines 80/135/195/226)
  - Move error cases to RecordsRepository.test.ts before deleting records.service.ts
  - 16-02 adds: explicit migration + deletion step
  - Time impact: +0.5 hours in 16-02

---

## Task Breakdown

<!-- REVISED 2026-09-02: B3/B4 decisions + W6 integrated; time +1.5h total (1h B3 + 0.5h B4) -->

### 16-01: Extend MockD1 + Migrate Integration Tests (2 hours)

**Part A: Extend MockD1 (0.5 hour)**
- [ ] Verify applyWhere() handles time-range predicates (`start_time < ? AND end_time > ?`)
- [ ] Add guard: log warning if predicate unknown; confirm never silently no-op
- [ ] 4 tests (MockD1.test.ts) covering overlap logic
- [ ] npm test green

**Part B: Migrate records.test.ts (1.5 hours)** [B3: Option A]
- [ ] Refactor src/routes/records.test.ts to use MockD1 instead of FakeD1Database
- [ ] Verify SQL substring assertions (WHERE, ORDER BY, LIKE) still pass
- [ ] Confirm GET /api/records/stats works (6 new integration tests)
- [ ] npm test + grep "FakeD1Database" should return zero results

### 16-02: Implement Repository + Migrate Service Tests (3.5 hours)

**Part A: RecordsRepository Implementation (3 hours)**
- [ ] New src/services/RecordsRepository.ts with 8 methods
- [ ] Pure function computeRecordStats() [W1: JS-only, no SQL aggregates]
- [ ] Constructor: `constructor(db: D1Database, now?: () => number)` [W2: clarified]
- [ ] findByType delegates to findAll({type}) [W3: no duplicate SQL]
- [ ] JSDoc on all methods
- [ ] Move record helpers from src/lib/db.ts (check move/keep list [W6]:
  - **Move**: queryRecords, insertRecord, updateRecord, deleteRecord, escapeLikeWildcards
  - **Keep**: queryKlines, getBackfillCursor, setBackfillCursor, insertKlinesBatch (klines.service uses these)

**Part B: Migrate records.service.test.ts (0.5 hours)** [B4]
- [ ] Identify unique error cases in records.service.test.ts (DatabaseError wrapping, etc.)
- [ ] Move error-translation tests to RecordsRepository.test.ts
- [ ] Delete src/services/records.service.ts (and records.service.test.ts)
- [ ] Verify npm test green with ≥90% RecordsRepository coverage

### 16-03: Unit Tests (2.5 hours)

- [ ] 41 test cases for RecordsRepository covering all 8 methods, edge cases, error paths
- [ ] SQL safety tests (parameterized queries, no injection)
- [ ] Immutability tests (no mutations of input/output)
- [ ] Coverage ≥95% for repository module [W11: manual verification]
- [ ] npm run test:coverage | grep "RecordsRepository.ts"

### 16-04: Route Refactor + Stats Endpoint (2 hours)

- [ ] Rewrite 4 handlers: GET /api/records, POST /api/records, PUT /api/records/:id, DELETE /api/records/:id (≤10 lines each) [W4: findById internal only]
- [ ] Add GET /api/records/stats endpoint [W9: intentional new endpoint for stats]
- [ ] 6 integration tests for /stats (JSON shape, edge cases, filters)
- [ ] Verify CF Access policy covers `/api/records/*` wildcard [W8: verify in 16-04]
- [ ] npm test src/routes/records.test.ts green
- [ ] npx playwright test e2e/records.spec.ts green (or 80/81 with Phase 15 flake acknowledgment [W12])

### 16-05: Review + Docs (1 hour)

- [ ] Code review using /gsd-code-review 16 --depth=standard
- [ ] Address all HIGH/CRITICAL findings
- [ ] Write 16-REVIEW.md, IMPLEMENTATION-NOTES.md
- [ ] Update ROADMAP.md (Phase 16 workplan now 16-01..05, duration 1.5 days)
- [ ] Update STATE.md (Phase 16 status, next phase guidance)

---

## Testing Strategy

- **Unit**: 41 repository cases + 4 MockD1 overlap cases
- **Integration**: existing records.test.ts pass unchanged (regression net)
- **E2E**: records.spec.ts green (81 runs across browsers)
- **Coverage**: 85% global gate; 95% target for repository

---

## Critical Constraints

<!-- REVISED 2026-09-02: W5 added (no pre-primary-SQL constraint generalized) -->

1. **DELETE /api/records/:id** must issue exactly 1 statement (no pre-SELECT) — src/routes/records.test.ts:273 asserts `db.calls[0][0]` is the DELETE
2. **GET /api/records** returns an array (not {records, stats}) — src/routes/records.test.ts:341 asserts shape
3. **Stats on separate endpoint** — /api/records/stats is distinct from /api/records to avoid shadowing /:id routes
4. **Port SQL verbatim** from db.ts — test assertions check substrings (WHERE, ORDER BY, LIKE); refactoring must preserve exact SQL [W5]
5. **No repository method may issue any statement before its primary query** — generalized from DELETE constraint [W5]; includes no warm-up/lazy-init statements
6. **listWithStats() computes in JS** — no SQL COUNT/GROUP BY/MIN/MAX; MockD1 cannot parse aggregates [W1]

---

## Risks & Mitigations

<!-- REVISED 2026-09-02: W7 severity corrected; warnings W1-W13 tracked -->

| Risk | Sev | Mitigation |
|------|-----|-----------|
| R1: MockD1 silently ignores overlap WHERE | High | 16-01 first; add guard + unit test. applyWhere() must log unknown predicates. |
| R2: Route test SQL assertions broken (16-01 migration) | High | Port SQL verbatim (WHERE, ORDER BY, LIKE). Treat failures as blockers, not style. |
| R3: /stats shadowed by /:id (low risk, high confidence) | Negligible | Explicit route registration order; test GET /stats before /:id. No mitigation needed but verified. [W7: corrected] |
| R4: delete() gains pre-SELECT (Constraint 1) | Low | Explicit in RecordsRepository.delete() (no pre-SELECT). Unit test asserts 1-statement rule. |
| R5: error-middleware log payload breaks existing tests | Medium | Update error-middleware.test.ts log assertions (severity→level, add component/action fields). [W6] |
| R6: Sentry/pino dependency blows Workers Free budget | N/A | Option C (custom logger) has zero new dependencies. Phase 16 unaffected. |
| R7: "Repository ready" claimed without verification | Medium | 16-05 verifies: coverage ≥95%, routes ≤10 lines, npm test + E2E green, code review zero HIGH. |

---

## Verification Commands

<!-- REVISED 2026-09-02: Added expected outputs per W4 warning -->

```bash
# Unit + Integration Tests
npm test
# Expected: all tests pass (including migrated records.test.ts with MockD1)
# Expected output: "Test Files  2 passed (2)" or similar

# Type Checking
npm run typecheck
# Expected: zero TypeScript errors

# Coverage Report
npm run test:coverage
# Expected output contains:
#   Lines:     >= 85% global
#   Repository module >= 95%
#   All records-related modules covered

# Repository Unit Tests Only
npx vitest run src/services/RecordsRepository.test.ts
# Expected: 41 tests pass

# E2E Smoke Tests
npx playwright test e2e/records.spec.ts
# Expected: 81/81 tests pass (or 80/81 with acknowledged Phase 15 flake)
```

---

## Handoff

Phase 16 complete when all SC met and code review yields zero HIGH/CRITICAL.

**Final Verification Checklist**:
- [ ] npm test green (all tests including records.test.ts migration)
- [ ] npm run test:coverage shows global ≥85%, repository ≥95%
- [ ] /api/records/stats endpoint responds (6 integration tests)
- [ ] Cloudflare Access policy verified for `/api/records/*` wildcard
- [ ] Code review via /gsd-code-review 16 complete (zero HIGH/CRITICAL)
- [ ] All 8 SC validated
- [ ] ROADMAP.md + STATE.md updated by 16-05
