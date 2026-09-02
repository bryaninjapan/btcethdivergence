---
phase: 16
name: Backend Service Deepening (Records Repository)
reviewed: 2026-09-02
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/services/RecordsRepository.ts
  - src/services/RecordsRepository.test.ts
  - src/routes/records.ts
  - src/routes/records.test.ts
  - src/lib/db.ts
  - src/lib/test-db.ts
findings:
  critical: 0
  high: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 16: Code Review Report

**Reviewed:** 2026-09-02
**Depth:** standard
**Files Reviewed:** 6
**Status:** clean (zero HIGH/CRITICAL)

## Summary

Phase 16 consolidates all divergence-record SQL into a single `RecordsRepository`
class, deletes the pass-through `records.service` layer, migrates every route
integration test onto the shared MockD1, and adds a `GET /api/records/stats`
endpoint backed by JS-computed statistics.

**Key Strengths:**
- ✅ Single owner of records SQL — parameterized statements throughout, no string
  interpolation of user input
- ✅ `delete()` issues exactly one statement (no pre-SELECT); route test asserts
  the single-call contract
- ✅ `update()` merges via internal `findById` and re-wraps all failures under
  one error contract (`Failed to update record`)
- ✅ Statistics computed in JS (`computeRecordStats`), pure and side-effect free —
  no SQL aggregates for MockD1 to parse
- ✅ Route handlers are pure HTTP (parse → validate → delegate → format), all ≤10 lines
- ✅ 42 repository unit tests (96.6% line coverage) + 25 route integration tests
  + 81/81 E2E; global coverage 87.1% lines (≥85% gate)

## Critical Issues

*None found.*

## High Issues

*None found.*

## Warnings

*None found.*

## Info

### IN-01: Defensive `INSERT ... RETURNING` null guard is untestable via MockD1

**File:** `src/services/RecordsRepository.ts:224`

`create()` guards against a null `RETURNING *` result. Real D1 always returns
the row for a returning insert, so this branch is unreachable through MockD1
(which likewise always returns the inserted row). Coverage is 96.6% lines; the
two uncovered lines (151, 224) are defensive branches whose reachable error
paths are already exercised by `failNext()` tests.

**Verdict:** Accept — defensive guard retained, no scaffolding added.

### IN-02: `/api/records/stats` gated by existing Cloudflare Access Policy 1

**File:** `.planning/phases/09-access-launch/09-PLAN.md:336,351`

Policy 1 protects the `/api/records*` prefix (owner email OTP). The new
`/api/records/stats` path matches that wildcard, so it is already gated without
a dashboard change. Verified against the Phase 9 policy documentation; the
Access policy itself lives in the Cloudflare dashboard and was not modified.

**Verdict:** Accept — no action required.

---

## Security Scan Results

| Check | Result |
|-------|--------|
| DEV_* / debug flags | None present in changed code |
| Hardcoded secrets | None introduced (INGEST_TOKEN remains an env binding) |
| Auth bypass | None — /stats rides the existing CF Access-gated records router |
| SQL injection | Parameterized `.bind()` on all statements; LIKE wildcards escaped; injection-payload test added |
| Error leak | `DatabaseError` carries `originalError` server-side only; client envelope is sanitized |

## Dead Code Scan Results

| Check | Result |
|-------|--------|
| `records.service.ts` / `records.service.test.ts` | Deleted; error cases migrated to `RecordsRepository.test.ts` |
| Record helpers in `src/lib/db.ts` | Removed (`listRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `escapeLikeWildcards`); klines/backfill helpers kept and still consumed by `klines.service` / `admin.service` |
| `FakeD1Database` references | Zero across `public/js` + `src` |