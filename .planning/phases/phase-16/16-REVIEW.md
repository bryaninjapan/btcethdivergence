# Phase 16 Code Review Report

**Date**: 2026-09-03
**Reviewer**: gsd-code-reviewer (independent pass, full phase incl. 16-fix-1..3)
**Commit range reviewed**: `44204ef..6d567ac` (base `44204ef~1` = `e762d6d`) — 12 commits:
- `44204ef` test(16-01) MockD1 migration · `227b311` feat(16-02) RecordsRepository + delete records.service layer
- `740eacf` test(16-03) repository suite expansion · `dce9120` feat(16-04) route refactor + GET /api/records/stats
- `d13d4ca` / `4a3e072` / `2c3d46e` docs(16-05)/(16)
- `e66251f` fix(16-fix-1) msb default → createRecordSchema only · `83205ec` / `7f7bf54` test(16-fix-1) msb regression tests
- `225ac8c` refactor(16-fix-2) parseBody helper · `6d567ac` fix(16-fix-3) concurrent-delete guard in update()

**Files reviewed**: `src/services/RecordsRepository.ts`, `src/services/RecordsRepository.test.ts`, `src/routes/records.ts`, `src/routes/records.test.ts`, `src/lib/validate.ts`, `src/lib/db.ts`, `src/lib/test-db.ts`, `src/lib/test-db.test.ts`, `src/routes/klines.test.ts`, `src/routes/admin.test.ts`, `src/lib/errors.ts`, `src/lib/error-middleware.ts`, `src/index.ts`, `src/types.ts`, `migrations/0002/0004`.

**Verification run green in this pass**: `npm run typecheck` zero errors; `npm test` 481/481 (36 files); targeted suite (`RecordsRepository.test.ts` + `records.test.ts` + `test-db.test.ts`) 87/87.

## Summary

0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW

The previously reported HIGH (partial `PUT` silently resetting `msb:'yes'` to `'no'` via Zod v4 `.partial()` injecting the `baseFields` default) is **fixed and regression-tested**: `e66251f` moved the default off `baseFields` so `updateRecordSchema` no longer injects `msb` on a missing key, and `83205ec`/`7f7bf54` added unit + route-level tests seeding `msb:'yes'` and asserting it survives a partial PUT. Verified against the current files and the passing suite.

The refactor itself is sound: all records SQL lives in `RecordsRepository` as parameterized statements (no string interpolation of user input), `delete()` issues exactly one statement, LIKE wildcards are escaped and bound with `ESCAPE '\\'`, overlap semantics match the approved design (`WHERE start_time < ? AND end_time > ?`, params `(end, start)`), stats are JS-computed with no mutation, handlers are pure HTTP and ≤10 lines, and the `/stats` route is registered before any `/:id` handler. Error translation to `DatabaseError` and the client-sanitized envelope are unchanged and correct. Migration of `records/klines/admin` tests onto MockD1 kept the SQL-shape assertions (`WHERE`/`ORDER BY`/`LIKE`) intact.

## Issues

### CRITICAL

*None found.*

### HIGH

*None found.* (Previous HIGH — msb partial-PUT reset — resolved by `e66251f`, regression-covered by `83205ec` + `7f7bf54`, suite green.)

### MEDIUM

- **`src/services/RecordsRepository.ts:242-281` + `src/lib/validate.ts:46-52`** — A partial `PUT` that sends only one of `start_time`/`end_time` can persist a record violating the `start_time < end_time` domain invariant. `updateRecordSchema`'s refine only checks the pair when **both** are present (`d.start_time === undefined || d.end_time === undefined || d.start_time < d.end_time`), so `PUT { start_time: 1e12 }` against a stored record with `end_time: 1600000000` is accepted; `update()` merges it over the stored row and writes `start_time >= end_time`. The API contract (`updateRecordSchema` is `.partial()`) therefore permits creating inconsistent records that break `findByTimeRange` overlap semantics and any downstream consumer. Pre-existing behavior (ported verbatim from the old `updateRecord` in `lib/db.ts`), but now the repository is the documented owner of record integrity. The UI always submits both times together (`records.js` form), so the trigger is API-level only.
  Fix hint: refine on the **merged** result — e.g. `.superRefine` on the merged times in `update()`, or extend `updateRecordSchema` to reject a lone time field (`d.start_time === undefined || d.end_time === undefined` when only one is present) — and add a unit test for `update(1, { start_time: later })` on an existing record.

### LOW

- **`src/services/RecordsRepository.ts:271-274`** — The `res.meta.changes === 0 → null` guard added in fix-3 (concurrent delete between `findById` and `UPDATE`) is correct but has **no test coverage**: MockD1's UPDATE returns `changes=1` whenever `findById` succeeded, so the race branch is unreachable in the current suite. Add a test that forces `changes=0` (e.g. a mock knob or a targeted statement) to lock the 404 behavior.
- **`src/lib/test-db.ts` (mock fidelity)** — MockD1 does not implement SELECT column projection; `SELECT open_time, open, ...` returns full stored rows (incl. the `symbol` filter column). This forced `klines.test.ts` to `toMatchObject` and would mask a projection bug in `queryKlines`. Test-only, documented in 16-SUMMARY.
- **`src/services/RecordsRepository.ts:169-183`** — `findByTimeRange(start, end)` does not validate `start <= end`; an inverted window yields odd-but-harmless results. Currently unused in production (API surface for Phase 17+); the future route should validate the pair.
- **`src/index.ts:12` (pre-existing, outside diff)** — The permissive default Hono CORS (`cors({ credentials: true })`, reflected origin) now also gates the new `/api/records/stats` endpoint. Not changed in this phase and the whole API sits behind Cloudflare Access, so defense-in-depth only; consider constraining `origin` to the app's own host when next touching `index.ts`.

Also noted (informational): `findByType`/`findByTimeRange` are exported but unused in production — required API surface per SC1, not dead code. No secrets, `.dev.vars`, or hardcoded credentials appear in the range; test `INGEST_TOKEN` values are fixtures.

## Recommendation

Ready to merge. The one blocking HIGH from the earlier review pass is fixed and verified; no new CRITICAL/HIGH issues found in the full `44204ef..6d567ac` range.

Follow-ups (non-blocking, in priority order):
1. **MEDIUM**: reject lone-time partial updates (or validate the merged row) so the API cannot persist `start_time >= end_time`, plus a unit test.
2. **LOW**: add a test that exercises the `update()` `changes === 0` branch.
3. **LOW**: constrain CORS `origin` when `index.ts` is next touched; document MockD1's projection limitation next to `selectRows`.