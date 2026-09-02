# Phase 16 Code Review Report

**Date**: 2026-09-03
**Reviewer**: gsd-code-reviewer (independent pass)
**Commit range reviewed**: `44204ef..4a3e072` (base `44204ef~1`) — 6 commits:
- `44204ef` test(16-01) MockD1 migration
- `227b311` feat(16-02) RecordsRepository + delete records.service layer
- `740eacf` test(16-03) repository suite expansion
- `dce9120` feat(16-04) route refactor + GET /api/records/stats
- `d13d4ca` / `4a3e072` docs(16-05)/(16)

**Files reviewed**: `src/services/RecordsRepository.ts`, `src/services/RecordsRepository.test.ts`, `src/routes/records.ts`, `src/routes/records.test.ts`, `src/lib/db.ts`, `src/lib/test-db.ts`, `src/lib/test-db.test.ts`, `src/routes/klines.test.ts`, `src/routes/admin.test.ts`.

**Verification run green**: `npm test` 480/480, `npm run typecheck` zero errors, targeted suites 86/86.

## Summary

1 HIGH, 0 CRITICAL, 0 MEDIUM, 4 LOW

The refactor itself is sound: all records SQL is consolidated in `RecordsRepository` with parameterized statements throughout (no string interpolation of user input), `delete()` issues exactly one statement, LIKE wildcards are escaped, stats are computed in JS, and route handlers are now pure HTTP (parse → validate → delegate → format). Injection safety, error sanitization (client envelope strips `details`), and CF Access gating of the new `/api/records/stats` path all check out. One genuine data-integrity bug — a partial `PUT` silently resets the `msb` field — was carried into the new repository and is masked by the new test fixtures. It must be fixed before merge.

## Issues

### CRITICAL

*None found.*

### HIGH

- **`src/services/RecordsRepository.ts:242-277` (+ `src/lib/validate.ts:32`)** — Partial update silently resets `msb` to `'no'`, violating the documented contract "omitted fields are preserved — never cleared". `baseFields.msb = msbStatus.default('no')`; in Zod v4, `.partial()` still applies that default on a missing key, so `updateRecordSchema.parse({ notes: 'x' })` yields `{ msb: 'no', notes: 'x' }` (confirmed empirically). `update()`'s merge then keeps the injected `'no'` via `msb: input.msb ?? existing.msb`, overwriting a stored `msb: 'yes'`. The route regression test "PUT omitting notes/tags → preserves existing notes/tags" (`records.test.ts:153-175`) exercises the exact buggy path on a `msb:'yes'` fixture but never asserts `msb`, and the unit fixture (`EXISTING`) uses `msb:'no'`, so the suite cannot catch it. Pre-existing (ported from the old `updateRecord` in `lib/db.ts`), but re-authored here under the "merge preserves omitted fields" design and left untested.
  Fix hint: move the default off `baseFields` — `msb: msbStatus` in `baseFields`, then `msb: msbStatus.default('no')` only inside `createRecordSchema` — and add a regression test: seed a `msb:'yes'` record, `PUT` with `{ type }` only, assert `msb === 'yes'`. The UI always sends `msb`, so the practical trigger is API-level partial updates, but the API contract and the method's own JSDoc promise preservation.

### MEDIUM

*None found.*

### LOW

- **`src/routes/records.ts:33-44,46-59`** — POST (~12 lines) and PUT (~14 lines) handlers exceed the SC4 "≤10 lines" claim, while GET/DELETE comply. Minor; the handlers are materially simplified and remain pure HTTP.
- **`src/lib/test-db.ts` (mock fidelity)** — MockD1 does not implement SELECT column projection; `SELECT open_time, open, ...` returns full stored rows (incl. `symbol`). This forces `klines.test.ts` to use `toMatchObject` and would mask a projection bug in `queryKlines`. Documented in 16-SUMMARY; test-only, no production impact.
- **`src/services/RecordsRepository.ts:242-277`** — `update()` is read-then-write without a transaction: a concurrent delete between `findById` and the `UPDATE` returns 200 with a merged row that no longer exists (the `.run()` `changes` is ignored). Negligible in a single-owner app; consider checking `res.meta.changes > 0` to return null/404.
- **`src/services/RecordsRepository.ts:169-196`** — `findByTimeRange()` and `findByType()` are exported but unused outside tests. Required API surface per SC1/Phase 17+; informational, not dead code.

## Recommendation

Do not merge as-is. Fix the one HIGH before merge:

1. **HIGH-1 (must fix)**: remove the `.default('no')` from `baseFields.msb` in `src/lib/validate.ts`, apply the default only in `createRecordSchema`, and add the `msb:'yes'` partial-PUT regression test in `RecordsRepository.test.ts` / `records.test.ts`.
2. **LOW items** are optional follow-ups (handler line-count note, mock projection fidelity, update `changes` check) — none block merge.

1 HIGH issue(s) found — must fix before merge.