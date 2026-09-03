# Phase 17 Code Review Report

**Date**: 2026-09-03
**Reviewer**: gsd-code-reviewer
**Commit range reviewed**: `4a9529a..8c6c1c1` (3 commits: `4a9529a` schemas + frontend mirror + parity tests; `c610d97` API stubs + registration + contract tests; `8c6c1c1` fix resolving prior review MEDIUM/LOW findings)

**Note on range**: `17-SUMMARY.md:7` states `4a9529a..c610d97`, but a post-summary fix commit `8c6c1c1` ("fix(phase-17): resolve MEDIUM and LOW code review findings") is now HEAD. This review covers the full shipped state `4a9529a..HEAD`.

## Summary

0 CRITICAL, 0 HIGH, 0 MEDIUM, 5 LOW

Reviewed files (all 6 changed in range; `public/js/calculator.js` untouched — SC2 confirmed, `git diff` empty):
- `src/domains/calculator-rules.ts` (new — Zod schemas + constants)
- `public/js/calculator-rules.js` (new — plain-JS mirror)
- `src/routes/calculator.ts` (new — 501 stub endpoints)
- `src/routes/calculator.test.ts` (new — 15 contract tests)
- `src/domains/calculator-rules.test.ts` (new — 41 unit/parity tests)
- `src/index.ts` (route registration)

Verified independently: `npm run typecheck` clean; `calculator-rules.test.ts` + `calculator.test.ts` = 56/56 pass; working tree clean; no diff on frozen `calculator.js`.

The fix commit `8c6c1c1` resolved the prior review's single MEDIUM (`normalizeDirection` superset — now exact-match `['short','Short','SHORT'].includes(value)`, byte-identical to frozen `calculator.js:66-69`) and two LOWs (`any` → typed `ApiErrorResponse` in tests; `parseBody` now returns parsed data). I confirm those fixes in the current files.

## Issues

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- **`src/domains/calculator-rules.ts:69-71` + `.planning/phases/phase-17/LEARNING.md:146-154`** — Locked-decision drift: the locked Option A snippet (`val.toString().toLowerCase() === 'short'`) normalizes `'sHoRt' → 'short'`, but shipped code exact-matches and maps `'sHoRt' → 'long'`. The shipped behavior is *correct* (matches frozen client, the actual source of truth) and the code comment documents it, but the locked doc no longer matches and no test pins the `'sHoRt' → 'long'` case (tests cover `'long'/'LONG'/'Long'/'bogus'/''` → long, `'short'/'Short'/'SHORT'` → short, but not the mixed-case short miss). *Fix hint: update the LEARNING.md Option A snippet to the final exact-match form and add a `'sHoRt' → 'long'` parity test so the comment's claim is enforced against future drift.* Related nuance, also untested: schema rejects `longShort: null` (400) while frozen `normalizeDirection(null)` → `'long'` — deliberate contract per `calculator-rules.test.ts:132-135`, but a future `/compute` consuming the frozen shape must mirror the schema, not the client.

- **`src/domains/calculator-rules.ts:135-154`** — `CalculatorOutputs` omits the 6 input-echo fields the frozen `calculatePosition()` return includes (`longShort`, `margin`, `entryPrice`, `stopLoss`, `takeProfitPrice`, `leverage`). Deliberate per PLAN I3 and documented in the comment, but a future `/compute` returning the frozen shape verbatim will fail `CalculatorOutputs.safeParse`. *Fix hint: strip echoes at the future service boundary (or extend the schema) — no action needed now.*

- **`src/routes/calculator.ts:27-30`** — 501 "Not yet implemented" mapped to `ErrorCode.INTERNAL_ERROR`. Semantically a capability gap, not an internal failure; consistent with the existing `notFound` handler (`src/index.ts:55-64`, 404/INTERNAL_ERROR), so codebase-conventional — but error-code-based monitoring will bucket stub 501s as internal failures. *Fix hint: acceptable as-is; introduce a dedicated code when the endpoint goes live.*

- **`src/routes/calculator.ts:12-13` + `src/index.ts:53`** — Auth is edge-enforced only (no in-code guard), consistent with `/api/records` and `/api/client-log`; Phase 16A RUNBOOK confirms the CF Access policy path is the `/api/*` wildcard, so `/api/calculator/*` is covered. The endpoints are stubs (400/501 only, no writes, no data, no user-content logging), so blast radius is nil even if reached unauthenticated. *Fix hint: at deploy time, curl the endpoint without an Access token and confirm the gateway returns 401/403 (RUNBOOK pattern).*

- **`public/js/calculator-rules.js`** — Ships to the browser but is imported by no page (`calculator-init.js` imports only `calculator.js`). Deliberate SC4 future-facing dead code, kept honest by the 6 parity tests + extended guard vs frozen `calculator.js`. *Fix hint: fine to leave; verify it is referenced when the client is next un-frozen.*

## Recommendation

**Merge as-is — no CRITICAL or HIGH issues.**

Phase 17 delivers exactly what it promises and nothing more: additive, read-only stub endpoints (501), no writes, no secrets, no sinks, no auth bypass (CF Access `/api/*` edge + app-level CORS second layer, both covered by contract tests including an `evil.com` origin check), sanitized 400 envelopes with raw zod `details` excluded (`body.error.details` asserted `undefined`), and the frozen client untouched (SC2). Schema logic, direction-dependent SL/TP rules, leverage bounds, and error strings are all byte-consistent with `public/js/calculator.js`; typecheck and 56/56 phase tests pass.

If / when `/api/calculator/compute` is implemented in a later phase, address in priority order:
1. Update the LEARNING.md Option A snippet + add the `'sHoRt' → 'long'` parity test — `src/domains/calculator-rules.ts:69`.
2. Decide the error code for 501 once it goes live — `src/routes/calculator.ts:28`.
3. Decide echo-field handling for `CalculatorOutputs` — `src/domains/calculator-rules.ts:141`.
4. Verify the `/api/*` Access policy covers the new path at deploy — `src/routes/calculator.ts:12`.

No CRITICAL/HIGH issues — ready to merge.