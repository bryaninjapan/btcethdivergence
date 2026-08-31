---
phase: 11
title: "Error Handling & Structured Responses - Learning & Decisions"
date_completed: 2026-09-01
status: complete
---

# Phase 11: Error Handling & Structured Responses — LEARNING.md

## Execution Summary

Successfully replaced ad-hoc error handling with structured error types, unified response envelope, and centralized error middleware. All 4 tasks completed:

- **11-01**: Error types + middleware infrastructure ✅
- **11-02**: Route handler refactoring ✅
- **11-03**: Frontend error handling updates ✅
- **11-04**: Integration & testing ✅

**Test Coverage**: 35+ new error handling tests (19 error type tests + 16 middleware tests) + 219 total tests passing.

---

## Architectural Decisions

### Decision 1: Error Hierarchy Using Inheritance

**Chosen**: Class-based hierarchy extending `AppError` base class.

```typescript
AppError (base)
├── ValidationError (400)
├── DatabaseError (500)
├── ExternalServiceError (502)
├── AuthenticationError (401)
└── NotFoundError (404)
```

**Why inheritance over discriminated union**:
- Type narrowing via `instanceof` checks
- Each error can have custom logic (e.g., NotFoundError overrides statusCode())
- Extensible: add new error types by creating new classes
- Testable: easy to mock and verify specific error types

### Decision 2: Structured Response Envelope

**Chosen**: Two-stage response with machine-readable code + user-friendly message.

```typescript
interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: {
    code: ErrorCode // Machine-readable
    message: string  // User-friendly
    details?: Record<string, unknown> // Server logs only
  }
}
```

**Why this shape**:
- `ok` flag is explicit (no need to check for error property)
- `code` enables frontend to differentiate error types programmatically
- `message` is user-facing and actionable
- `details` hidden from client response (security), logged server-side only

### Decision 3: Centralized Error Middleware

**Chosen**: Single `errorMiddleware` in Hono caught via `app.onError()`.

**Benefits**:
- DRY: Single entry point
- Consistent: All errors formatted identically
- No silent failures: Every error gets logged

---

## Implementation Patterns

### Pattern 1: Throwing vs. Returning Errors

**BEFORE** (return-based):
```typescript
function auth(c, env) {
  if (unauthorized) {
    return jsonError('Unauthorized', 401)
  }
  return null
}
```

**AFTER** (throw-based):
```typescript
function requireAuth(c, env) {
  if (unauthorized) {
    throw new AuthenticationError('...')
  }
}
```

### Pattern 2: Frontend Error Differentiation

```javascript
try {
  await api('/api/records', { method: 'POST', body: ... })
} catch (error) {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      // Show validation toast
    } else if (error.code === 'SERVICE_ERROR') {
      // Show "service unavailable" page
    }
  }
}
```

---

## Testing Strategy

### Unit Tests: Error Types (19 tests)
- Error construction, status codes, sanitization
- Type guard verification
- ErrorCode uniqueness

### Unit Tests: Middleware (16 tests)
- Error type → HTTP status mapping
- ZodError → ValidationError conversion
- Unknown errors → INTERNAL_ERROR
- Response envelope format validation

### Integration Tests: Routes
- Wrapped routers with error middleware
- Verified status codes match error types
- Ensured error response structure

---

## Lessons Learned

### 1. Error Middleware Must Be Registered on App
**Problem**: Route tests failed with 500 (expected middleware wasn't running)
**Solution**: Created test helper to wrap routes with middleware

### 2. Error Type Instanceof Checks Matter
**Problem**: NotFoundError thrown but status was 500 (not 404)
**Solution**: Updated catch blocks to check all relevant error types

### 3. Frontend Needs Error Codes, Not Just HTTP Status
**Insight**: HTTP status (400/500) isn't granular enough for semantic UX
**Solution**: Include `error.code` in response for fine-grained frontend control

### 4. Structured Logging Is Non-Negotiable
**Pattern**: Full error context logged server-side, sanitized response to client

---

## Future Extensions

### 1. Error Tracking Integration (v2)
Send errors to Sentry/LogRocket for monitoring and user impact analysis

### 2. Retry Metadata
Standardize retry information for client-side error recovery

### 3. Graceful Degradation
Support partial success responses when some data sources fail

### 4. Client-Side Error Recovery
Implement exponential backoff retry, field focus on validation errors

---

## Success Metrics

✅ Zero silent failures - all errors logged with full context
✅ Frontend control - error codes enable semantic UX decisions
✅ Type safety - ErrorCode enum prevents typos
✅ Testability - 35+ error handling tests cover all paths
✅ Consistency - all routes use same error envelope
✅ Extensibility - new error types added without middleware changes

