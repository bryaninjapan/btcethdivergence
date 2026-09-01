---
phase: 12
title: "Service Layer Pattern — Plan Check Insights"
date: 2026-09-01
status: pre-execution_findings
---

# Phase 12 — Plan Check Learning & Guidance

Captured from final `12-PLAN-CHECK.md` (08:01 revision) for reference during execution.

## Plan Check Summary

| Status | Count | Notes |
|--------|-------|-------|
| **Blockers** | 0 | Plan is logically sound and executable |
| **Warnings** | 7 | Detailed design gaps requiring inline resolution during execution |
| **Info** | 7 | Minor wording/spec clarifications |

**Verdict:** Plans verified. Ready to execute. (0 blockers → proceed)

---

## Critical Warnings — Resolve During Execution

### W1 — Error Translation Ownership (Critical for SC5)

**Issue:** Routes drop the try/catch pattern that currently yields `DatabaseError`. Without explicit error translation, DB failures become `INTERNAL_ERROR` and break existing integration tests.

**Where:** Records/klines route refactoring (12-01, 12-02)

**Impact:** SC5 ("Integration tests pass") fails if followed literally

**Fix Options:**
- **Option A (Recommended):** Services catch `DatabaseError` — gives services real substance (resolves W5 too)
- **Option B:** Routes keep the try/catch — lighter services, but pass-through indirection

**Action:** Pick one, apply consistently across all three domains (12-01/12-02/12-03), run existing integration suites to verify error-code contract preserved.

---

### W2 — Spike Route Example Wiring (Contract Drift Risk)

**Issue:** Refactor example shows wrong route path, param source, startTime logic.

**Real route:** `GET /api/admin/binance-spike` with `?symbol=BTCUSDT` (query), `startTime = Date.now() - 2h`

**Plan example:** `GET /api/admin/binance-spike/:symbol` with `:symbol` (param), `startTime = getBackfillCursor(...) || default`

**Impact:** Following literally changes the API contract (CONTEXT marks as Out of Scope)

**Fix:** Update example to match real endpoint:
```typescript
admin.get('/api/admin/binance-spike', async (c) => {
  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  const startTime = Date.now() - 2 * 60 * 60 * 1000;  // 2 hours ago, not backfill cursor
  
  const result = await adminService.probeBinanceReachability(symbol, startTime);
  return c.json({ ok: true, data: result });
});
```

---

### W3 — Mock `batch()` Signature Mismatch

**Issue:** Plan specs `batch({sql, params}[])` but `insertKlinesBatch` calls `db.batch([prepared-statement-objects])`

**Real usage:** `db.batch(group.map((stmt) => db.prepare(stmt.sql).bind(...stmt.params)))`

**Impact:** Admin tests (12-03) cannot run as specced

**Fix:** Mock's `batch()` must:
1. Accept prepared-statement objects (bound results from `.prepare().bind()`)
2. Execute each via `.run()`
3. Accumulate `meta.changes`
4. Return results array
5. **Test:** Add 12-00 test calling `db.batch([db.prepare(sql).bind(...), ...])` exactly as real code does

---

### W4 — Mock Missing WHERE/LIKE-ESCAPE Filtering

**Issue:** Stated records tests assume filtering (listRecords by type/tag) and seeded-row merge logic, but plan's naive mock returns all rows.

**Tests affected:**
- "listRecords: filter by type → returns matching only"
- "listRecords: filter by tag → returns matching only"  
- "updateRecord: partial update → other fields preserved"

**Impact:** 2-3 of 11 stated records tests would fail

**Fix:** Mock's `all()` must:
1. Parse SQL's WHERE clauses and apply equality/LIKE-ESCAPE filtering
2. Return only matching rows from seeded data
3. **Reference:** Use or port `FakeD1Database` logic from existing records.test.ts:12-84 (includes `simpleLikeMatch`)

**Test:** Add 12-00 test proving `WHERE type = ?` / `tags LIKE ? ESCAPE '\\'` queries return correct subsets of seeded rows.

---

### W5 — records/klines Services Are Pure Pass-Through

**Issue:** As designed, `records.service.ts`/`klines.service.ts` only wrap `db.*()` calls with no business logic. Only admin gains real substance.

**Impact:** Service layer indirection exists but adds no value for 2/3 domains.

**Mitigation:** Choose W1's Option A (services own error translation) — this moves real logic into records/klines services and eliminates the pass-through feel.

---

### W6 — Coverage 95% Gates Silently Relaxed

**Issue:** Script change drops existing 95% lines/functions/statements/branches gates for calculator to a single 80% lines gate across all of `src/**` + `public/js/**`

**Impact:** Aggregate ≥80% masks regressions in existing calculator logic

**Fix:** 
1. Dry-run `npm run test:coverage` **before** Phase 12 execution to know baseline
2. Document rationale for gate relaxation in SUMMARY.md
3. Consider keeping calculator-specific 95% gate and only relaxing services portion

---

### W7 — Line-Count Mechanism Unspecified

**Issue:** SC4 targets "~10-20 lines/endpoint" but records PUT is 37, klines GET is 35 today. Plan offers no mechanism to reach the target.

**Example slimming levers:**
- W1 Option A (services own errors) — removes try/catch from routes
- Reuse `validatePositiveInteger()` for ID validation (reduces manual checks)
- Error middleware handles the response formatting

**Action:** During 12-04 step 3, measure refactored routes against 15-20 target and document which levers were applied.

---

## Info Items (Minor Clarifications)

### I1 — Test Count Arithmetic
12-04 says "16+", phase-level SC says "23+". Actual: 22-23 tests.  
**Fix:** Unify count; state "≥20 required by SC3" in 12-04.

### I2 — Module Export Phrasing
Plan phrases `db.queryKlines` as D1 methods, but they're module exports.  
**Fix:** Rephrase as `import { queryKlines } from '../lib/db'`.

### I3 — fetchAndInsertKlines env Unused
Param not needed; startTime unspecified.  
**Fix:** Drop `env`, specify startTime derivation.

### I4 — Klines Route No Zod
Routes validate manually, not via Zod schema.  
**Fix:** Rephrase as "keep existing manual validation + ms→sec conversion".

### I5 — 12-03 Independent of 12-01/12-02
No shared files; serial ordering is safe but wastes parallelism.  
**Fix:** Allow 12-03 to run parallel with 12-01/12-02 if executor capacity allows.

### I6 — Error Middleware Contract
Error-middleware.ts:47-55 maps non-`AppError` → INTERNAL_ERROR.  
**Note:** Needed for W1 decision-making.

### I7 — E2E Scope Explicit
Only calculator spec; phase changes backend only.  
**Status:** Acceptable; route integration tests carry SC6 for changed endpoints.

---

## Decision Checkpoints for Execution

**Before 12-01 starts:**
- [ ] Decide W1 (error translation ownership) — Option A or B?
- [ ] Confirm W2 example uses real route path + startTime
- [ ] Verify W3 mock batch() accepts prepared statements
- [ ] Verify W4 mock implements WHERE/LIKE filtering

**During 12-04:**
- [ ] Measure line counts vs. 15-20 target (W7)
- [ ] Dry-run coverage command, document 95% gate rationale (W6)
- [ ] Verify integration tests still pass with chosen error-translation pattern (W1)

---

## Quick Reference: What Soldier Found

**Plan Status:** Executable (0 blockers)  
**Main Risk:** Error translation ownership & mock spec gaps; resolve inline  
**Estimated Effort:** 4 days (with 12-01/12-02 parallel)  
**Critical Decision:** W1 (services own errors vs. routes own try/catch)

---

*Plan check executed 2026-09-01 @ 08:02. This learning captures the key gaps to address during execution.*

---

## Execution Learnings (2026-09-01)

### How the plan-check warnings were resolved

| # | Resolution |
|---|-----------|
| W1 | **Option A** — services own error translation. `recordsService`/`klinesService`/`adminService` catch raw D1 errors and rethrow `DatabaseError`. Preserves the DATABASE_ERROR contract (klines.test.ts asserts it) and gives records/klines services real substance (W5). **Refinement:** When service A calls service B (e.g., `processIngest` → `setBackfillCursor`), use instanceof guard to avoid double-wrapping: `if (error instanceof DatabaseError) throw error; else throw new DatabaseError(...)`. This preserves the original error context and avoids masking the root cause. |
| W2 | Spike route kept as `GET /api/admin/binance-spike?symbol=` (default BTCUSDT) with `startTime = Date.now() - 2h`; `probeBinanceReachability(symbol, startTime)` is read-only, no cursor derivation. |
| W3 | Mock `batch()` accepts prepared-statement objects (as `insertKlinesBatch` passes them) and executes each via the shared `mutate()` engine; 12-00 tests call `db.batch([db.prepare(sql).bind(...)])` exactly like db.ts. |
| W4 | Mock implements WHERE equality (type/symbol/id), escape-aware `tags LIKE ? ESCAPE '\\'`, and `open_time BETWEEN`; `first()` serves seeded/merged rows; `createMockD1WithData` clones fixtures. |
| W5 | See W1 — services translate DB errors, which is the business-logic seam SC1 wanted. |
| W6 | Dry-run done first (baseline 63% lines). The 95% calculator gate was **already failing on HEAD** (47% since the 90745ea calculator refactor), so it was replaced by the SC7 aggregate gate. Rationale documented in the 12-04 commit. |
| W7 | Levers applied: `validatePositiveInteger` for `:id` (records PUT 37→25), service-owned errors (removed route try/catch). Admin spike=17, backfill-cursor=12 hit the target. Records PUT (25), klines GET (31), ingest (24) stay above 20 because of inline JSON/Zod/param validation — recorded as accepted deviations. |

### Unforeseen complications

1. **Pre-existing test breakage on HEAD** (nothing to do with the phase): `src/public/calculator-init.test.ts` used `window.eval()` which runs in vitest's global scope and could not see the manual JSDOM document → 8 failures; the Playwright `e2e/calculator-init.spec.ts` was collected by `npm test` and collided with vitest globals; the 95% calculator coverage gate was already failing. Fixed as `[cleanup]` commits (scoping fix + `**/e2e/**` vitest exclusion + DOM type declarations + jsdom ambient types).
2. **Mock D1 scope grew beyond the plan's spec**: real `db.ts` emits `INSERT ... RETURNING *` (first() must mutate then return the row), `UPDATE`/`DELETE` (table resolution needed INTO/FROM + UPDATE/DELETE), `INSERT ... ON CONFLICT(symbol) DO UPDATE` (backfill upsert), and INSERT-OR-IGNORE PK dedupe. Fixture objects were also mutated in place by the mock → `setRows` now clones.
3. **Coverage CLI glob quirk**: `--coverage.include='src/**,public/js/**'` (comma form) matches nothing (0%); the working form is repeated `--coverage.include='src/**/*.ts' --coverage.include='public/js/**/*.js'`.
4. **Zod `.default()` makes `CreateRecordInput` fully populated**: service tests must pass complete objects (notes/tags always present after route parse); "missing notes/tags" is not a service-level scenario.
5. **`charts.js` (202 lines) remains at 0%**: it wires Lightweight Charts (CDN, canvas) which jsdom cannot run; aggregate coverage still passes because the rest of the suite is well covered.

### Refactoring opportunities for future

- Add `charts.js` coverage via a stubbed `LightweightCharts` global + injected charts.html DOM (same pattern as records.js).
- Condense klines GET validation (31 lines) into a small Zod query schema to hit the 15-20 line target — deferred because the plan (I4) explicitly kept manual validation.
- If `db.ts` gains pagination (its L4 note), extend the mock with `LIMIT`/`OFFSET` and `COUNT(*)`.
- Consider a shared `parseJsonBody(c)` helper to slim the three routes that read `c.req.json()`.
- `src/services/*` all expose a namespace object (`recordsService`, `klinesService`, `adminService`) + `XxxService` type — consistent; keep the pattern for future domains.
