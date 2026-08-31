---
task: "Technical Debt Cleanup — TypeScript & Test Fixes"
date: 2026-09-01
status: complete
---

# Technical Debt Cleanup — Learning

## Overview

Cleaned up 5 pre-existing test failures and 2 TypeScript errors using TDD methodology. Discovered a critical test-isolation bug and hidden type gaps that masked each other.

---

## Key Discoveries

### 1. Test Isolation: Sub-Router vs App (Critical)

**Problem:**
`src/routes/klines.test.ts` tested the `klines` sub-router in isolation:
```typescript
klines.request(new HonoRequest(...))  // Direct sub-router call
```

But in production, `klines` is mounted under the top-level app with error middleware:
```typescript
// src/index.ts
app.use('/', klines)
app.onError(errorMiddleware)  // Only on top-level app!
```

**Impact:**
- Sub-router calls bypass `app.onError(errorMiddleware)`
- Thrown `ValidationError`/`DatabaseError` fell through to Hono's default handler
- Default handler returns plain-text `500 Internal Server Error`, not structured JSON
- Tests asserted wrong response shape: `body.error` as string instead of `{code, message}` object

**Lesson:**
**Always test routes through the top-level app**, not in isolation. The error-handling middleware only exists at the app level.

**Fix Applied:**
```typescript
// BEFORE: Direct sub-router test (isolation, wrong middleware chain)
const res = await klines.request(new HonoRequest(...))

// AFTER: Test through app with full middleware
const app = new Hono<{ Bindings: Env }>();
app.route('/', klines);
app.onError(errorMiddleware);  // Now middleware runs!
const res = await app.request(new HonoRequest(...))
```

This mirrors the pattern already established in `src/lib/error-middleware.test.ts` and matches production wiring.

---

### 2. Hidden Type Gaps (Cascading Errors)

**Problem Chain:**
1. **First error found:** `src/types.ts` — Env interface missing `ASSETS?: Fetcher` field
   - `wrangler.jsonc` declares `assets.binding: "ASSETS"` (serves `./public`)
   - But `Env` type never declared it
   - TypeScript: "excess property 'ASSETS'"

2. **Second error masked by first:** `src/index.test.ts` — `mockEnv` missing `INGEST_TOKEN`
   - Was never caught because TypeScript stopped at the ASSETS error
   - Only surfaced once ASSETS was fixed

**Lesson:**
**Fix TypeScript errors sequentially.** The first error can mask cascading issues downstream. Don't assume you've found all errors until `tsc --noEmit` is fully clean.

**Fix Applied:**
```typescript
// src/types.ts — add missing binding
export interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
  ASSETS?: Fetcher;  // Was missing!
}

// src/index.test.ts — add missing env var
const mockEnv: Env = {
  DB: ...,
  INGEST_TOKEN: 'test-token',  // Was missing!
  ASSETS: mockAssetsFetcher,
};
```

---

### 3. Diagnostic Scripts Don't Belong in Test Suite

**Problem:**
`src/routes/klines-diagnosis.test.ts` — manual diagnostic that makes live `fetch()` calls to production:
```typescript
// Makes real HTTP request to btcethdivergence.bryanlab.cc
const res = await fetch('https://btcethdivergence.bryanlab.cc/api/klines?...');
```

**Issues:**
- Non-deterministic in CI (depends on network, production state)
- Tests Cloudflare edge config, not this repo's code
- Violates "mock external dependencies" principle
- Clutters test suite with 1 unrelated failure

**Lesson:**
**Diagnostic scripts should be separate from the test suite.** They're tools for manual investigation, not automated tests.

**Fix Applied:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/klines-diagnosis.test.ts',  // Exclude diagnostic
    ],
  },
});

// src/routes/klines-diagnosis.test.ts — add doc comment
/**
 * MANUAL DIAGNOSTIC: Tests live Cloudflare Access edge behavior.
 * This is NOT an automated test — it makes real HTTP calls to production.
 * 
 * To run manually:
 *   npx vitest run --include '**/klines-diagnosis.test.ts'
 * 
 * Why excluded by default:
 * - Non-deterministic (depends on network, production state)
 * - Tests infrastructure, not application code
 * - Violates test isolation principle
 */
```

---

### 4. Test Assertion Accuracy: Shape Matters

**Problem:**
`klines.test.ts` assertions were wrong before the fix:
```typescript
// WRONG: assumes error is a plain string
expect(res.body.error).toContain('must be positive integer');

// CORRECT: error is a structured object per our API envelope
expect(res.body.error.code).toBe('VALIDATION_ERROR');
expect(res.body.error.message).toContain('must be positive integer');
```

**Root Cause:**
- Tests written in isolation, never saw actual `{ ok, data?, error: {code, message} }` envelope
- Nobody noticed the mismatch until the test was reintegrated with the middleware

**Lesson:**
**Assertion accuracy requires seeing the real response shape.** Document your expected JSON structure upfront, and test through the full middleware chain.

---

### 5. TypeScript Compilation Must Be First

**Lesson:**
`npm run typecheck` before `npm run test`. TypeScript errors can hide logical test failures. The error chain:
1. TypeScript fails (ASSETS, INGEST_TOKEN)
2. Tests run but exhibit strange failures (wrong middleware chain, wrong shape)
3. Both need fixing, but TypeScript errors take priority

**Process Order:**
```bash
npm run typecheck    # Fix type errors first
npm run test         # Then fix test logic
npm run test:coverage # Finally check coverage
```

---

## Best Practices Validated

### 1. App-level middleware testing (established)
Already done correctly in `error-middleware.test.ts`:
```typescript
const app = new Hono<{ Bindings: Env }>();
app.onError(errorMiddleware);
// Then test through app, not middleware directly
```
**Lesson:** Reuse this pattern. Every route test should wire the app with middleware.

### 2. Environment mocking must be complete
```typescript
// mockEnv needs ALL required Env fields, not just some
const mockEnv: Env = {
  DB: mockDb,
  INGEST_TOKEN: 'test-token',    // Don't forget!
  ASSETS: mockAssetsFetcher,      // Don't forget!
};
```

### 3. Response envelope contracts
Document your API response shape once, test against it consistently:
```typescript
// Envelope structure (reused everywhere)
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;  // Server-side only
  };
}
```

---

## Prevention for Future

1. **Test routes through app, not sub-routers** — catches middleware gaps
2. **Fix TypeScript errors sequentially** — don't stop at the first error
3. **Document mock env setup** — list all required fields
4. **Exclude non-tests from test suite** — use `vitest.config.ts` exclude
5. **Run `npm run typecheck` before `npm run test`** — type errors mask test failures

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| TypeScript errors | 2 | 0 ✅ |
| Test failures | 5 | 0 ✅ |
| Files fixed | — | 6 |
| Coverage | 95% target, failing | Still failing (pre-existing calc-init.js gap) |

---

*Cleanup completed 2026-09-01 via TDD workflow. All findings actionable for future work.*
