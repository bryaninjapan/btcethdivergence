---
reviewer: claude-code-review (gsd-code-reviewer agent)
date: 2026-09-01
severity: WARNING
findings: 3-HIGH, 1-MEDIUM, 2-LOW
---

# Phase 11 Code Review — Error Handling & Structured Responses

## Scope Reviewed

Diff `5282b2d..HEAD` (19 files, +1751/-158):
- New: `src/lib/errors.ts`, `src/lib/error-middleware.ts`, `src/lib/errors.test.ts`, `src/lib/error-middleware.test.ts`, `public/js/api.js`
- Modified: `src/types.ts`, `src/index.ts`, `src/routes/{klines,records,admin}.ts`, `public/js/{records,charts}.js`

Verified: `npx tsc --noEmit` and `npx vitest run` on affected files (63 tests pass).

---

## Findings

### 🔴 [HIGH] Internal error strings leaked into client-facing `message` field

**Files:** `src/routes/klines.ts:41`, `src/routes/records.ts:29,54,92,118`, `src/routes/admin.ts:127,144`

Every `DatabaseError` thrown embeds `String(error)` directly in the message:

```ts
// WRONG — raw D1 error sent to client
throw new DatabaseError(`Failed to list records: ${String(error)}`);
```

`AppError.toResponse()` returns `message` verbatim to the browser. Raw stringified D1/JS errors (which can include query context, constraint names, or stack-adjacent text) leak to the frontend.

This contradicts the phase's test suite intent (`errors.test.ts:42-54`, `error-middleware.test.ts:44-55`), which asserts sensitive info stays server-side via `details`.

**Fix:** Use generic public message + move raw error into `details`:
```ts
throw new DatabaseError('Failed to list records', { originalError: String(error) });
```
Apply to all 7 call sites.

---

### 🔴 [HIGH] Duplicate `ApiResponse<T>` interface — two sources of truth

**Files:** `src/types.ts:12-16` vs. `src/lib/error-middleware.ts:23-31`

Two identical `ApiResponse<T>` definitions exist:
- `src/index.ts:3` imports from `./lib/error-middleware`
- Routes import from `../types`

They match today, but there's no compiler-enforced link. Future edits (e.g., adding a `meta` field) silently diverge with no type error.

**Fix:** Keep single definition in `types.ts`, import it in `error-middleware.ts`:
```ts
// error-middleware.ts
import type { ApiResponse } from '../types';
```

---

### 🔴 [HIGH] New `tsc --noEmit` regression introduced

**File:** `src/lib/error-middleware.test.ts:105`

```ts
app.get('/test', () => {
  const schema = z.object({ ... });
  schema.parse(invalid); // Throws ZodError
  // Missing return — implicit void
});
```

Handler has no return statement, doesn't satisfy Hono's `Handler` type. `tsc --noEmit` fails:

```
error TS2769: No overload matches this call. Type 'void' is not assignable to type 'HandlerResponse<any>'.
```

This didn't exist in pre-Phase-11 commit (`5282b2d`). Vitest doesn't typecheck, so tests pass, but `npm run typecheck` fails.

**Fix:** Add unreachable return after `.parse()`:
```ts
schema.parse(invalid);
return c.text('unreachable'); // Unreachable at runtime, satisfies type
```

---

### 🟡 [MEDIUM] Misleading status-code type assertion excludes 404

**File:** `src/lib/error-middleware.ts:72`

```ts
const statusCode = appError.statusCode() as 400 | 401 | 500 | 502;
```

`NotFoundError.statusCode()` returns `404`, but the union doesn't include it. At runtime harmless, but type is dishonest. Type checker won't catch future bugs if logic changes.

Also: `errors.test.ts`'s "returns correct HTTP status code" test omits `NotFoundError` (lines 30-40 test only Validation/Database/ExternalService/Authentication).

**Fix:** Widen union to `400 | 401 | 404 | 500 | 502`, or use Hono's `StatusCode` type. Add `NotFoundError` to status code test.

---

### ⚠️ [LOW] Duplicated error-code→message mapping in frontend

**Files:** `public/js/records.js` (3 near-identical blocks: 100-112, 217-225, 255-263), `public/js/charts.js` (2 blocks: 144-156, 207-219)

Same `if (error.code === 'VALIDATION_ERROR') ... else if 'SERVICE_ERROR'...` chain repeated 5 times with only copy differing.

**Fix:** Extract shared helper in `api.js`:
```js
export function describeApiError(error, fallbackMessage) {
  if (error.code === 'VALIDATION_ERROR') return 'Validation error';
  if (error.code === 'SERVICE_ERROR') return 'Service unavailable';
  if (error.code === 'DATABASE_ERROR') return 'Database error';
  return fallbackMessage || 'An error occurred';
}
```
Reuse at each call site. Also: nothing handles `AUTH_ERROR` on client (silently falls through to generic `else`).

---

### ⚠️ [LOW] Unreachable branch in `requireAuth`

**File:** `src/routes/admin.ts:20-31`

```ts
try {
  if (expected.length !== actual.length) throw new AuthenticationError(...);
  if (!timingSafeEqual(...)) throw new AuthenticationError(...);
} catch (error) {
  if (error instanceof AuthenticationError) throw error;
  throw new AuthenticationError('Authorization check failed'); // Unreachable
}
```

Every throw inside `try` is already an `AuthenticationError`, so the generic re-wrap is unreachable.

**Fix:** Remove unreachable branch or add clarifying comment. No functional impact, just cleaner intent.

---

## What Looks Good ✅

- `AppError` hierarchy clean, `toResponse()` correctly strips `details`, `statusCode()` exhaustively maps `ErrorCode`
- Timing-safe admin auth comparison preserved (`admin.test.ts`)
- D1 queries use `bind()` parameterization — no SQL injection
- DOM updates use `textContent`, not `innerHTML` — no XSS surface
- Server-side logging captures full context (stack, details, path, method) via `console.error`
- Route handlers consistently re-throw already-typed errors (no double-wrapping)
- `records.test.ts` and `admin.test.ts` exercise full error-middleware pipeline end-to-end
- No hardcoded secrets; `INGEST_TOKEN` from `Env` bindings

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | ✅     |
| HIGH     | 3     | ⚠️     |
| MEDIUM   | 1     | ℹ️     |
| LOW      | 2     | 📝     |

**Verdict: ⚠️ WARNING**

The 3 HIGH issues should be resolved before merge:
1. **Error message leakage** (7 call sites) — directly contradicts phase's security design intent
2. **Duplicate `ApiResponse` type** — divergence risk
3. **tsc regression** — breaks CI (`npm run typecheck`)

None are CRITICAL (no exploitable secrets/injection/XSS), but error-message leakage undermines the structured error design. MEDIUM/LOW are improvements worth addressing.

**Next:** Fix all 3 HIGH + MEDIUM, optionally address LOW findings, then re-verify.

---

*Reviewed 2026-09-01 by gsd-code-reviewer agent*
*Findings verified against: npx tsc --noEmit, npx vitest run, git diff analysis*
