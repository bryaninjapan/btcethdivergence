# Phase 16: Implementation Notes

**Date:** 2026-09-02
**Scope:** Backend Service Deepening — Records Repository

## What Changed

### New files
- `src/services/RecordsRepository.ts` — single owner of all divergence-record
  SQL. Exports `RecordsRepository` (methods `findAll`, `findById`, `listWithStats`,
  `findByTimeRange`, `findByType`, `create`, `update`, `delete`) and the pure
  function `computeRecordStats`. Constructor `(db: D1Database, now?: () => number)`
  with an injectable second clock for deterministic timestamps in tests.
- `src/services/RecordsRepository.test.ts` — 42 unit tests (all 8 methods, SQL
  safety, immutability, error translation, overlap boundaries, stats).

### Modified files
- `src/routes/records.ts` — five handlers, each ≤10 lines and pure HTTP:
  `GET /api/records`, `GET /api/records/stats` (new), `POST /api/records`,
  `PUT /api/records/:id`, `DELETE /api/records/:id`. `/stats` is registered
  before any `/:id` route.
- `src/routes/records.test.ts` — migrated from the inline `FakeD1Database` to the
  shared MockD1; 6 new `/stats` integration tests (25 total in file).
- `src/routes/klines.test.ts`, `src/routes/admin.test.ts` — migrated to MockD1 so
  the plan's "zero `FakeD1Database`" gate passes (One Mock, One Layer).
- `src/lib/test-db.ts` — MockD1 overlap predicate (`start_time < ? AND end_time > ?`)
  applied during this phase (predicate + guard were authored during plan-check).
- `src/lib/test-db.test.ts` — 4th overlap test covering strict boundary semantics.
- `src/lib/db.ts` — record helpers removed; klines/backfill helpers retained.
- `.planning/ROADMAP.md`, `.planning/STATE.md` — Phase 16 marked complete.

### Deleted files
- `src/services/records.service.ts`
- `src/services/records.service.test.ts`

## Design Notes

### Overlap semantics (findByTimeRange)
`WHERE start_time < ? AND end_time > ?` with params `(end, start)`. A record is
included when its `[start_time, end_time]` intersects the query `[start, end]` —
records spanning the window are returned, and boundary-touching records are
excluded (strict inequalities). MockD1's `applyWhere` implements the same
predicate, so unit and integration tests share semantics.

### Statistics (listWithStats)
Computed in JS via `computeRecordStats(records)` over `findAll(filters)`: no SQL
`COUNT`/`GROUP BY`/`MIN`/`MAX`. Shape:
`{ totalRecords, byType, byMsb, dateRange: { start, end } | null }`.

### Error contract
All methods translate raw driver failures into `DatabaseError`. `update()`
re-wraps every failure (including the internal `findById` read) under
`Failed to update record`; `findByType` and `listWithStats` delegate and let the
underlying `DatabaseError` propagate.

### Constraint compliance
- `delete()` issues exactly one statement (route test asserts 1 call, id bound first).
- `GET /api/records` returns an array (not `{records, stats}`).
- SQL ported verbatim from `db.ts` (substring assertions in tests unchanged).
- No method issues a statement before its primary query except `update()`'s
  documented merge read.

## Verification (end-to-end)

```bash
npm test                 # 480/480 pass (36 files)
npm run typecheck        # zero errors
npm run test:coverage    # Lines 87.1% global (>=85%); RecordsRepository 96.6% (>=95%)
npx vitest run src/services/RecordsRepository.test.ts   # 42 pass
npx playwright test e2e/records.spec.ts                 # 24 pass
npx playwright test      # 81/81 pass (full suite)
```

## CF Access

Policy 1 (owner email OTP) protects the `/api/records*` prefix
(09-PLAN.md:336), which covers the new `/api/records/stats` route. No dashboard
change required.

## Deviations from Plan

1. **16-01 Part B scope widened** — the plan's grep gate requires zero
   `FakeD1Database` in `public/js` + `src`. `klines.test.ts` and `admin.test.ts`
   still defined their own local `FakeD1Database` classes, so they were migrated
   to MockD1 alongside `records.test.ts`. This is consistent with the approved
   "One Mock, One Layer" decision (B3 rationale) and is the only way the plan's
   own verification passes.
2. **16-01 "/stats works (6 tests)" deferred** — that checklist line duplicated
   16-04; the `/stats` endpoint is created in 16-04, so its 6 integration tests
   were written there as planned.
3. **Test count** — 42 repository tests (target 41), and the klines test now
   compares kline fields via `toMatchObject` because MockD1 returns the full
   stored row (incl. the `symbol` filter column) rather than the projected
   column list. Intent preserved.
4. **Commit granularity** — `src/lib/test-db.ts` (MockD1 overlap predicate)
   landed in the 16-02 commit rather than 16-01 because it was uncommitted
   plan-check work required by `findByTimeRange`.