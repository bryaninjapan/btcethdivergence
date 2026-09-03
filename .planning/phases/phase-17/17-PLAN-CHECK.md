# Phase 17 Plan Check — Goal-Backward Verification Report

**Checker**: gsd-plan-checker
**Date**: 2026-09-03
**Phase**: 17 — Future-Proofing (Calculator Validation, Optional)
**Plan(s) verified**: 17-01 (single plan) — `.planning/phases/phase-17/PLAN.md` (rev 2026-09-03 12:17, commit `1de6605`)
**Status**: ISSUES FOUND — 0 blocker(s), 2 warning(s), 5 info

## 1. Coverage Summary

| Requirement ID | Meaning (ROADMAP) | Covered by task(s) | Verdict |
|---|---|---|---|
| CODE-03 (DRY Validation) | Validation centralized, single source of truth | 17-01-1 (`CalculatorInputs`, 6 fields, `longShort` z.transform normalize), 17-01-2 (`CalculatorOutputs`, 9 fields + `warnings` subobject), 17-01-3 (edge cases: liquidation, margin×leverage, direction SL/TP, bounds 1–125), 17-01-1.5 (mirror + parity), 17-01-6 (15+ tests) — all in `src/domains/calculator-rules.ts` + `MAX/MIN_LEVERAGE` exports | ✅ Covered |
| CODE-04 (Service Layer Pattern) | Business logic separated from HTTP concerns | 17-01-4/4.5/5 (thin stub routes, HTTP-only envelope), "Service Layer Placeholder" + "Notes for Future Implementation" document future `CalculatorService.ts` pattern | ✅ Covered (stub-appropriate; SC3 only requires stubs + tests) |

Note: CODE-03/04 are already validated requirements (Phases 11/12); Phase 17 *applies* them to a new module (I1).

## 2. Success Criteria Traceability

| SC (ROADMAP) | Delivering task(s) | Status |
|---|---|---|
| 1. `src/domains/calculator-rules.ts` exports Zod schemas `CalculatorInputs`, `CalculatorOutputs` | 17-01-1 (inputs, `longShort` normalize + direction `.refine()`), 17-01-2 (outputs), 17-01-3 (edge cases) | ✅ Covered |
| 2. Client-side calculator logic unchanged (still runs in browser) | Scope "Files to Keep Unchanged: `public/js/calculator.js`" (SC2-frozen); no subtask edits it; verification: `npm test -- public/js/calculator` + `git diff --stat public/js/calculator.js` (expect empty) | ✅ Covered |
| 3. `/api/calculator/validate` + `/api/calculator/compute` stubs created, tests written, ready for implementation | 17-01-4 (validate stub: 501 valid / 400 invalid), 17-01-4.5 (`app.route('/', calculator)` in `src/index.ts`, curl 501-not-404), 17-01-5 (compute stub + `src/routes/calculator.test.ts` ≥5 contract tests) | ✅ Covered |
| 4. Schemas shared via .js mirror + parity test (`public/js/calculator-rules.js`, divergence.js precedent) | 17-01-1.5 (mirror + parity test in `src/domains/calculator-rules.test.ts` + extended guard vs frozen `calculator.js`) | ✅ Covered (ROADMAP wording now matches mirror delivery) |
| 5. 15+ unit tests (validation rules, margin vs SL, liquidation thresholds) | 17-01-3 (edge cases), 17-01-6 (≥15 tests incl. parity + normalize cases) | ✅ Covered |
| 6. Code review complete: zero HIGH issues | 17-01-8 (review, zero HIGH/CRITICAL, typecheck clean, tests + coverage pass) | ✅ Covered |

## 3. Dimension Results

| Dimension | Result | Notes |
|---|---|---|
| 1. Requirement Coverage | ✅ PASS | CODE-03/04 both have concrete covering subtasks (§1) |
| 2. Task Completeness | ✅ PASS | All 10 subtasks have concrete files, specific actions, and "Done when" acceptance criteria |
| 3. Dependency Correctness | ✅ PASS | 1→2→3 sequential; 4/4.5/5 build on schemas; 1.5 feeds 6 (parity); acyclic. 17-01-1.5 and 17-01-6 both write to `calculator-rules.test.ts` but additively |
| 4. Key Links / Wiring | ✅ PASS | 17-01-4.5 wires stubs into `src/index.ts` (curl 501-not-404 + app-level CORS test prove it); 17-01-1.5 wires mirror↔backend + mirror↔frozen `calculator.js` |
| 5. Scope Sanity | ⚠️ WARNING | 1 task / 10 subtasks exceeds the 2-3 tasks/plan target; acknowledged in-plan (W2) |
| 6. Success-Criteria Traceability | ✅ PASS | All 6 ROADMAP SCs have covering tasks (§2) |
| 7. Locked Decision Compliance | ✅ PASS | No contradiction: no-build frontend respected (JS mirror, not TS import); single-Worker deployment respected (routes in `src/index.ts`); calculator frozen/client-side (SC2); CF Access email OTP edge-auth documented, no in-code auth; Phase 11 envelope `{ok, data?, error?}` respected even for stubs |
| 8. Scope Reduction Detection | ✅ PASS | No hedging on in-scope work. "Stub"/501 is exactly what SC3 requires; service/caching/rate-limit notes are correctly labeled out-of-scope |
| 9. Verification Plan Quality | ✅ PASS | `npm run typecheck` (typed code changed), filtered tests, global-coverage command, SC2 git-diff proof, curl 501-not-404 all present; full-suite run at sign-off recommended (I5) |
| 10. Fact-check load-bearing claims | ✅ PASS | All cited line numbers, field names, patterns verified against current source (below) |

**Fact-check results (all accurate against current tree):**
- `public/js/calculator.js:1-2` `MAX_LEVERAGE=125`/`MIN_LEVERAGE=1`; `:5` `longShort`, `:6-9` `margin`/`entryPrice`/`stopLoss`/`takeProfitPrice`, `:10` `leverage` — verified.
- `calculator.js:12-28` `calculatePosition()` base shape (15 fields incl. echoes), `:27` `warnings:{riskRewardTooLow,liquidationRisk}` — verified.
- `calculator.js:59-62` computed warnings (`riskRewardTooLow: R:R<1.0`, `liquidationRisk: lossAmount>margin`) — verified.
- `calculator.js:66-69` `normalizeDirection()` — only `'short'/'Short'/'SHORT'` map to `'short'`, all else `'long'`; LEARNING.md Option A `z.transform().pipe(z.enum(['long','short']))` matches semantics (TDD 10/10) — verified.
- `calculator.js:71-86` `validateInput()` error strings + direction-dependent SL/TP — verified.
- `public/js/calculator-init.js:14-16` frozen field names `entryPrice`/`stopLoss`/`takeProfitPrice` — verified.
- `src/index.ts:53-62` `app.notFound` `{ok:false,error:{code:INTERNAL_ERROR,message:'Not found'}}` 404; `:48-51` `app.route('/', <module>)` registration — verified.
- `src/lib/errors.ts:11` `ErrorCode.INTERNAL_ERROR`; `statusCodeMap` maps INTERNAL_ERROR→500 (stub's 501 is an explicit `c.json(response, 501)` override) — verified.
- `src/lib/error-middleware.ts:42-52` ZodError→`ValidationError`; `toResponse()` excludes `details`/zod issues (sanitized `{ok:false,error:{code,message}}`) — verified.
- `src/routes/client-log.ts:9-11` "Authentication enforced at CF Access edge, not in Worker code" — verified.
- `src/routes/client-log.test.ts:85-98` CORS-boundary pattern (evil-origin request still reaches handler; `Access-Control-Allow-Origin` null) — verified.
- Parity precedent: `src/domains/divergence.test.ts` imports `../../public/js/divergence` from the same path depth the plan's `calculator-rules.test.ts` mirror will use — verified.
- `package.json`: `typecheck` = `tsc --noEmit`; `test:coverage` = `--coverage.thresholds.lines=85` global, includes `src/**/*.ts` + `public/js/**/*.js`; `zod ^4.5.4` (z.transform/.pipe valid) — verified.
- `tsconfig.json` `include: ["src"]` → `public/js/calculator-rules.js` is not type-checked (same as existing mirrors; parity test is the guard) — noted I6.
- `src/services/RecordsRepository.ts` + `.test.ts` exist and `src/routes/records.ts` consumes the repository → Phase 16 dependency satisfied — verified.

## 4. Issues

### Blockers

None.

### Warnings

**W1 — Residual "400 + zod error details" phrasing in 17-01-4 "Done when".**
Commit `1de6605` fixed the Testing Strategy bullet (line 139) to the sanitized contract (`error.code === 'VALIDATION_ERROR'` + non-empty `error.message`), but 17-01-4's "Done when" (line 88) still reads "rejects invalid CalculatorInputs schema with 400 + zod error details". `errorMiddleware.toResponse()` excludes the `details`/zod issues array, so a test asserting raw zod details would fail.
- **fix_hint**: Reword 17-01-4 "Done when" to match the Testing Strategy: "rejects invalid CalculatorInputs schema with HTTP 400 + `error.code === 'VALIDATION_ERROR'` + non-empty `error.message` (sanitized envelope; raw zod issues excluded per errorMiddleware)".

**W2 — Single task with 10 subtasks exceeds the 2-3 tasks/plan target (borderline).**
17-01 contains 10 subtasks (17-01-1…8 + 4.5 + 1.5). Work is cohesive, strictly sequential, time-boxed at 0.75 days, and the plan's "Task Granularity Note" documents the optional 3-way split — so execution is not blocked. It remains the phase's weakest structural point against the 2-3 tasks/plan convention.
- **fix_hint**: Keep as-is (0.75-day optional phase, acknowledged in-plan) or split into 17-01 (schemas + edge cases), 17-02 (stubs + registration + contract tests), 17-03 (mirror + parity + review) before execution.

### Info

**I1 — CODE-03/04 are already validated requirements (Phases 11/12).** Phase 17 *applies* them to a new module; consider noting "applies existing CODE-03/04" in the ROADMAP phase line.

**I2 — 400-path mechanism not pinned.** Because the 501 path uses direct `c.json(response, 501)` (bypassing errorMiddleware, per the notFound pattern), the 400 path must *throw* (ZodError via `CalculatorInputs.parse()`, or explicit `ValidationError`) to reach `app.onError` → sanitized envelope. Both work; pin one in 17-01-4 so the contract test's expectation is unambiguous.

**I3 — `CalculatorOutputs` is a deliberate subset.** `calculatePosition()` also echoes the 6 inputs (`longShort`, `margin`, `entryPrice`, `stopLoss`, `takeProfitPrice`, `leverage`) in its return; the schema enumerates only the 9 computed fields + warnings. Fine for "validation and type safety" today, but a future compute endpoint returning the full shape would need the echo fields. Document the subset intent.

**I4 — Extended parity guard is limited to `MAX/MIN_LEVERAGE`.** `calculator.js` exports only those two constants, so the "source-of-truth guard" vs frozen `calculator.js` can only compare those; field lists/error strings are guarded by the mirror↔backend parity + behavioral schema tests (calculator.js error strings are module-internal, not importable). Acceptable — the mirror tests must assert exact error strings to cover this.

**I5 — Full-suite run at sign-off.** `npm test -- calculator.test` also matches `public/js/calculator.test.ts` (beneficial for SC2 regression, but accidental) and `-- calculator-rules` matches only the new domain test. Final 17-01-8 sign-off should run unfiltered `npm test` to catch cross-module regressions. Also relabel the curl "(after deploy)" → "(after `wrangler dev`)" since it targets `http://localhost:8787` (CF Access OTP would block it on the live domain).

**I6 — `public/js/calculator-rules.js` is not covered by `npm run typecheck`.** tsconfig `include: ["src"]` only; the parity test is the type-safety guard for the mirror (consistent with `divergence.js`).

## 5. Recommendation

**APPROVE — ready to execute.** Goal-backward verification passes: both requirements (CODE-03/04) and all 6 ROADMAP success criteria have concrete, wired covering subtasks; every load-bearing source claim (line numbers, field names, envelope, sanitized-error behavior, edge-auth stance, coverage-command semantics, mirror+parity precedent) fact-checks against the current tree; no locked decision (no-build, single Worker, frozen calculator, CF Access edge-auth, Phase 11 envelope) is contradicted; no scope reduction on in-scope work. The prior check's W1 (coverage wording), W2 (ROADMAP SC4), and W4 (Testing Strategy wording) were resolved in commit `1de6605`; the two remaining warnings (W1 residual "Done when" phrasing, W2 granularity) are execution-time clarity items, not blockers. Resolve W1's wording as part of 17-01-4 sign-off; keep the acknowledged granularity note for the retrospective.

**Plans verified. Ready to execute.**