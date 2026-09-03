# Phase 17 Code Review Report

**Date**: 2026-09-03
**Reviewer**: gsd-code-reviewer
**Commit range reviewed**: `4a9529a..c610d97` (2 commits: `4a9529a` schemas + mirror + parity tests; `c610d97` API stubs + registration + contract tests) — range taken from `17-SUMMARY.md:7`

## Summary

0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW

Reviewed files (all 6 changed in range):
- `src/domains/calculator-rules.ts` (new)
- `public/js/calculator-rules.js` (new)
- `src/routes/calculator.ts` (new)
- `src/routes/calculator.test.ts` (new)
- `src/domains/calculator-rules.test.ts` (new)
- `src/index.ts` (route registration)

Verified: `npm run typecheck` clean; `calculator-rules.test.ts` + `calculator.test.ts` = 56 tests pass; `git diff` confirms `public/js/calculator.js` untouched (SC2).

## Issues

### CRITICAL

None.

### HIGH

None.

### MEDIUM

- **`src/domains/calculator-rules.ts:70`** — `normalizeDirection` is a **superset** of the frozen client it claims to mirror, with a misleading comment. The implementation `value.toLowerCase() === 'short'` maps *any* case variant (`'sHoRt'`) to `'short'`, but frozen `calculator.js:66-69` only maps the exact strings `'short' | 'Short' | 'SHORT'` to `'short'` and treats everything else (including `'sHoRt'`) as `'long'`. The doc comment (lines 65–67) states "only explicit short variants map to 'short'; everything else is 'long'", which is not what the code does. The parity tests (`calculator-rules.test.ts:170-194`) only exercise the documented cases and miss this drift. Benign for the `validate` stub (the normalized value is discarded), but this is the phase's flagship "single source of truth" module — if `/api/calculator/compute` is later implemented, input `longShort: 'sHoRt'` would compute short math server-side while the frozen client computes long math for the same payload. *Fix hint: match the frozen logic exactly (`['short','Short','SHORT'].includes(value)`), or narrow the comment to state the deliberate superset and add a `'sHoRt' → 'long'` parity test.*

### LOW

- **`src/routes/calculator.ts:26-29` + `src/index.ts:59`** — 501 "Not Implemented" is mapped to `ErrorCode.INTERNAL_ERROR`. Semantically a capability gap, not an internal error; consistent with the existing `notFound` pattern (404 also uses `INTERNAL_ERROR`), so it is codebase-conventional, but monitoring that buckets on `error.code` will classify stub 501s as internal failures. *Fix hint: acceptable as-is for consistency; consider a dedicated `NOT_IMPLEMENTED` code when the API matures.*

- **`src/routes/calculator.ts:32-41`** — `parseBody` validates the payload but discards the parsed result. The future `/compute` handler must re-parse (or `parseBody` must return the parsed `CalculatorInput`), creating mild duplication. Not a bug today (stub-only), just a seam to clean up when implementing Phase 17+.

- **`src/routes/calculator.test.ts:43,53,64,79,115,121,144,153`** — `const body: any` type assertions throughout the contract tests. Test-only, so non-blocking; typed narrowings (e.g. `body.error.code`) would be marginally safer against the envelope contract changing.

- **`public/js/calculator-rules.js`** — not imported by any shipped page (`calculator-init.js` still imports only `calculator.js`). It is deliberate SC4 future-facing dead code, kept in sync by the parity tests, so drift risk is low — but until something consumes it, it ships to the browser unused. *Fix hint: fine to leave; verify it is referenced when the client is next un-frozen.*

## Recommendation

**Merge as-is — no CRITICAL or HIGH issues.**

The phase delivers exactly what it promises: additive stubs (501), no writes, no secrets, no auth gap (CF Access edge + app-level CORS second layer, both covered by contract tests), sanitized 400 envelopes with no raw zod `details` leakage, and the frozen client untouched. Security posture is consistent with the existing `/api/records`/`/api/client-log` precedent.

Before implementing `/api/calculator/compute` in a later phase (not required now), address the single MEDIUM in priority order:

1. Align `normalizeDirection` with the frozen client (or document + test the superset) — `src/domains/calculator-rules.ts:70`.
2. Have `parseBody` return the normalized input to avoid double parsing — `src/routes/calculator.ts:32-41`.
3. Decide the error code for 501 once the endpoint goes live — `src/routes/calculator.ts:28`.

No CRITICAL/HIGH issues — ready to merge.