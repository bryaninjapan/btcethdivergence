---
phase: 11
title: "Error Handling & Structured Responses — Plan Check"
date: 2026-09-01
verdict: READY_TO_EXECUTE
---

# Phase 11 Plan Check

## Executive Summary

Phase 11 plan is **logically sound and executable**. No blockers identified. All design decisions explicit. Ready to proceed.

| Category | Status | Notes |
|----------|--------|-------|
| **Goal Clarity** | ✅ | Replace scattered error handling with structured types + middleware |
| **Success Criteria** | ✅ | 5 SC clear and measurable |
| **Design Decisions** | ✅ | Error hierarchy, response envelope, middleware pattern explicit |
| **Task Breakdown** | ✅ | 4 clear tasks with dependencies |
| **Risk Level** | 🟢 LOW | Confined to error handling, no major refactoring |
| **Effort Estimate** | ✅ | 1 day (light phase, single-threaded) |

---

## Validation

### Goal Statement ✅

**Goal:** Eliminate scattered `try-catch` blocks, string-based errors, and ad-hoc error responses. Implement structured error types, unified response envelope, and centralized error middleware for all API routes.

✅ **Clear.** Specific problems identified (scattered errors, no structure). Specific solutions proposed (error hierarchy, middleware). Measurable outcome (all routes use AppError + middleware).

### Success Criteria ✅

| SC | Status | Assessment |
|----|----|------------|
| SC1: Error hierarchy with inheritance | ✅ | Clear: AppError base + 5 subtypes (Validation, Database, ExternalService, Authentication, NotFound) |
| SC2: Structured response envelope | ✅ | Clear: ApiResponse<T> with ErrorDetails (code, message, details) |
| SC3: Centralized middleware | ✅ | Clear: Single errorMiddleware function in Hono |
| SC4: Type safety (compile-time checks) | ✅ | Clear: Routes typed to return ApiResponse<T>, errors inherit AppError |
| SC5: Zero silent failures | ✅ | Clear: All errors logged server-side with full context; none swallowed |

**Verdict:** All SC measurable and achievable.

### Task Breakdown ✅

| Task | Duration | Deliverable | Status |
|------|----------|-------------|--------|
| 11-01: Error types + middleware | 1-1.5 days | errors.ts, error-middleware.ts, errors.test.ts | ✅ Scoped |
| 11-02: Route refactoring (backend) | 1-1.5 days | admin.ts, klines.ts, records.ts using AppError | ✅ Scoped |
| 11-03: Frontend error handling | 1 day | api.js, records.js, charts.js parsing ErrorDetails | ✅ Scoped |
| 11-04: Integration tests | 0.5-1 days | Error path coverage in route tests | ✅ Scoped |

**Verdict:** Tasks are sequential but 11-03 can run parallel with 11-02 (frontend/backend split). Achievable in 1-2 days.

---

## Design Review

### Error Hierarchy (Class-Based vs Discriminated Union) ✅

**Decision:** Use class inheritance (AppError base + subtypes).

```typescript
class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public details?: any) {
    super(message);
  }
  toResponse(): ErrorResponse { /* ... */ }
}
class ValidationError extends AppError { /* ... */ }
class DatabaseError extends AppError { /* ... */ }
```

**Rationale:**
- instanceof checks are type-safe and idiomatic in TypeScript
- Each error type can have custom `toResponse()` logic
- Middleware uses catch branches: `if (error instanceof ValidationError) { ... }`

**Alternative Considered:** Discriminated union (`type AppError = { type: 'validation', ... } | { type: 'db', ... }`).
- Rejected: Less idiomatic for error handling; instanceof checks are clearer.

✅ **Verdict:** Design sound. No concerns.

### Response Envelope ✅

**Decision:** All responses follow `{ ok: boolean, data?: T, error?: ErrorDetails }`.

```typescript
// Success: { ok: true, data: record }
// Error: { ok: false, error: { code, message } }
```

**Rationale:**
- Single boolean `ok` field makes client branching simple
- Discriminated union: either `data` or `error` populated
- No details leaked to client (security)

✅ **Verdict:** Standard REST practice. No concerns.

### Error Middleware (Hono vs Custom) ✅

**Decision:** Use Hono's `app.onError()` callback.

```typescript
app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(error.toResponse(), error.httpStatus);
  }
  // Unknown error → 500
  return c.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: '...' } }, 500);
});
```

**Rationale:**
- Hono provides built-in error handler
- Single entry point; all route errors caught
- Middleware runs even if route handler throws

✅ **Verdict:** Standard Hono pattern. No concerns.

### Frontend Error Differentiation ✅

**Decision:** Parse error.code and branch based on type.

```javascript
// records.js
fetch('/api/records')
  .then(res => res.json())
  .then(data => {
    if (!data.ok) {
      if (data.error.code === 'VALIDATION_ERROR') { /* Show user-friendly message */ }
      else if (data.error.code === 'DATABASE_ERROR') { /* Retry logic */ }
      else { /* Generic error */ }
    }
  });
```

✅ **Verdict:** Enables better UX (context-specific messages). Sound design.

---

## Risk Assessment

### Low-Risk Items ✅

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Error type names might conflict with external libs | 🟢 LOW | Scoped to `src/lib/errors.ts`; no re-exports outside services |
| Middleware might catch too much (e.g., async parse errors) | 🟢 LOW | Test all error paths: ZodError, AppError, unknown |
| Backward compatibility (routes expect old error format) | 🟢 LOW | No external consumers; v1.0 complete; route contract updated together |

### No Critical Blockers ✅

- No external API contracts to break (internal only)
- No third-party library incompatibilities
- No database schema changes

**Overall Risk:** 🟢 **LOW.** Phase is isolated to error handling layer.

---

## Implementation Feasibility ✅

### Existing Code Review

**Checked:**
- Current error handling in admin.ts, klines.ts, records.ts
- Current response formats in existing test files
- Hono app structure in index.ts

**Findings:**
- Routes use mix of thrown errors and return-based responses → consolidate to throw-based
- Some routes catch ZodError → move to middleware
- Frontend uses bare error strings → add error code parsing

✅ **All manageable. No architectural conflicts.**

### Effort Estimate ✅

| Task | Estimate | Rationale |
|------|----------|-----------|
| 11-01 (errors.ts + middleware) | 4-6 hrs | Standard error boilerplate; well-understood pattern |
| 11-02 (route refactoring) | 4-6 hrs | 8 routes × ~30min each (mechanical refactor) |
| 11-03 (frontend) | 3-4 hrs | Update 3 JS files; mostly parsing changes |
| 11-04 (tests) | 3-4 hrs | Error path tests for each error type |
| **Total** | **14-20 hrs** | **~1.5 days for solo executor** |

✅ **Achievable in single sprint.**

---

## Decision Checkpoints

| Item | Decision | Status |
|------|----------|--------|
| Use class-based AppError hierarchy? | YES | ✅ |
| Centralized middleware in Hono? | YES | ✅ |
| Sanitize details in client response? | YES (security) | ✅ |
| Log full context server-side? | YES | ✅ |
| Throw errors vs. return error responses? | THROW (then middleware catches) | ✅ |
| Frontend parse error.code for differentiation? | YES | ✅ |

**All decisions locked. No conflicts.**

---

## Sign-Off

✅ **Phase 11 plan is VERIFIED and READY TO EXECUTE.**

- No blockers
- No design ambiguities
- No feasibility concerns
- Effort estimate: 1.5 days (achievable)
- Risk level: 🟢 LOW

**Next:** Proceed to execution (11-01 through 11-04).

---

**Verified:** 2026-09-01
