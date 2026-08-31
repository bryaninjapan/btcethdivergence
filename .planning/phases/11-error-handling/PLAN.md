---
phase: 11
title: "Error Handling & Structured Responses"
date_created: 2026-09-01
goal: Replace ad-hoc error handling with structured error types, unified response envelope, and centralized error middleware
depends_on: Phase 1-10 (v1.0 complete)
requirements: CODE-02 (Error Handling)
estimated_effort: 4-5 days (1.5 + 1.5 + 1 + 0.5-1 for frontend)
---

# Phase 11: Error Handling & Structured Responses

## Goal
Eliminate scattered `try-catch` blocks, string-based errors, and ad-hoc error responses. Implement structured error types, unified response envelope, and centralized error middleware for all API routes.

## Why This Matters

**Current State**:
- `admin.ts` lines 47-59: Nested try-catch with fragile fallback logic
- Error info compressed: `err instanceof BinanceError ? err : new BinanceError(0, String(err))`
- Routes swallow errors: `catch (error) { console.error(...) }` masks failure reasons
- No structured error response: Only `{ ok: false, error: "message" }`
- Frontend cannot differentiate error types (validation vs. service vs. network)

**Problems This Causes**:
1. Debugging nightmare: Full error context lost after first catch
2. Frontend fragility: Can't handle different error types appropriately
3. Inconsistency: Some errors logged, some silently swallowed
4. Testability: Error handling logic scattered; impossible to test centrally

## Success Criteria

1. **Error Type Hierarchy**: All errors inherit from `AppError` base class
   - `ValidationError` for Zod/domain validation failures
   - `DatabaseError` for D1 query/constraint violations
   - `ExternalServiceError` for Binance API failures
   - `AuthenticationError` for CF Access failures

2. **Structured Response Envelope**: All API responses follow format:
   ```typescript
   interface ApiResponse<T> {
     ok: boolean
     data?: T
     error?: ErrorDetails
   }
   
   interface ErrorDetails {
     code: ErrorCode
     message: string  // User-friendly
     details?: Record<string, any>  // Internal debugging
   }
   ```

3. **Centralized Error Middleware**:
   - Single entry point for all error handling
   - Logs full context server-side
   - Returns sanitized response to client
   - No `console.error` in route handlers

4. **Type Safety**:
   - Error types checked at compile time
   - Route handlers typed to return `Promise<ApiResponse<T>>`
   - Middleware typed to handle `AppError` subtypes

5. **Zero Silent Failures**:
   - No more `catch (error) { console.error(...) }`
   - All errors logged with full context
   - All errors returned to client in structured format

## Implementation Plan

### Phase 11-01: Error Type Definitions & Middleware
**Duration**: 1-1.5 days
**Deliverable**: `src/lib/errors.ts`, error middleware, types

Tasks:
- [ ] Create `src/lib/errors.ts`:
  - Define `AppError` base class with `code`, `message`, `details` properties
  - Define `ValidationError`, `DatabaseError`, `ExternalServiceError`, `AuthenticationError`
  - Implement `toResponse()` method for each type (client-safe, no details leakage)
  - Define `ErrorCode` enum: VALIDATION_ERROR, DATABASE_ERROR, SERVICE_ERROR, AUTH_ERROR, INTERNAL_ERROR
  - **HTTP Status Code Mapping**:
    ```typescript
    const statusCodes = {
      VALIDATION_ERROR: 400,
      DATABASE_ERROR: 500,
      SERVICE_ERROR: 502,
      AUTH_ERROR: 401,
      INTERNAL_ERROR: 500
    }
    ```
- [ ] Create `src/lib/error-middleware.ts`:
  - Centralized error handler for Hono
  - **Logging Strategy**: Use Wrangler's built-in logger with structured JSON format
    - Log fields: `{ code, message, details, stack, timestamp, severity }`
    - Include full stack trace for debugging
    - Log level: ERROR for client errors, ERROR for server errors
  - **Zod Error Detection**: Catch `ZodError` and convert to `ValidationError`
    ```typescript
    if (err instanceof ZodError) {
      return new ValidationError(err.errors[0].path.join('.'), validationMessage(err))
    }
    ```
  - Returns structured `ApiResponse<never>` on error (with correct HTTP status code)
  - Handles `AppError` subtypes + unexpected errors (unknown → INTERNAL_ERROR)
- [ ] Update `src/types.ts`:
  - Export `ApiResponse<T>` interface
  - Export `ErrorDetails` interface
  - Export `ErrorCode` enum

- [ ] Update `src/index.ts`:
  - Register error middleware: `app.onError((err, c) => errorMiddleware(err, c))`
  - **JSON Parse Error Handling**: Preserve route-level try-catch for `c.req.json()`
    - Routes should catch and throw `ValidationError("body", "Invalid JSON")`
    - Middleware will catch and format response

### Phase 11-02: Refactor Route Handlers
**Duration**: 1.5 days
**Deliverable**: Updated routes, all errors structured

Tasks:
- [ ] Update `src/routes/klines.ts`:
  - Catch Binance errors → throw `ExternalServiceError`
  - Catch DB errors → throw `DatabaseError`
  - Validate params → throw `ValidationError`
  - Return `ApiResponse<Kline[]>`

- [ ] Update `src/routes/records.ts`:
  - Catch validation failures → `ValidationError`
  - Catch DB constraint failures → `DatabaseError`
  - Catch auth failures → `AuthenticationError`
  - Return `ApiResponse<Record | Record[]>`

- [ ] Update `src/routes/admin.ts`:
  - Restructure nested try-catch (lines 44-59, 77-86)
  - Separate concerns: validation → service → DB
  - Each layer throws typed error
  - Middleware catches and formats
  - Preserve Binance fallback logic (err instanceof BinanceError ? err : new BinanceError(...))

### Phase 11-03: Frontend Error Handling Updates
**Duration**: 0.5-1 day
**Deliverable**: Frontend receives and differentiates structured errors

Tasks:
- [ ] Update `public/js/records.js`:
  - Change error handling from string to object
  - Check `data.error.code` (VALIDATION_ERROR | SERVICE_ERROR | DATABASE_ERROR)
  - Show context-appropriate messages (toast for validation, error page for service)

- [ ] Update other frontend files if applicable:
  - `public/js/charts.js` — If errors are displayed in charts
  - `public/js/api.js` — If fetch error handling exists

- [ ] Manual frontend UAT:
  - Invalid input → shows validation toast
  - Service failure → shows error page
  - Different error codes differentiated visually

### Phase 11-04: Integration & Testing
**Duration**: 1-1.5 days
**Deliverable**: Tests, verification, LEARNING.md

Tasks:
- [ ] Write error type tests:
  - Each error type serializes correctly
  - `toResponse()` produces valid JSON
  - Error codes are unique

- [ ] Write middleware tests:
  - Catches `ValidationError` → returns VALIDATION_ERROR code
  - Catches `ExternalServiceError` → returns SERVICE_ERROR code
  - Catches unknown errors → returns INTERNAL_ERROR code

- [ ] Write route integration tests:
  - Invalid input → structured validation error
  - DB constraint violation → structured DB error
  - Service timeout → structured service error
  - Success case → normal response

- [ ] Manual testing (UAT):
  - Frontend receives structured errors
  - Can differentiate error types
  - Logs are readable on server

- [ ] Create LEARNING.md:
  - Why structured errors matter
  - Error type decision rationale
  - Middleware architecture
  - Testing strategy
  - Future extensions

## Files to Create/Modify

### New Files
- `src/lib/errors.ts` — Error type definitions
- `src/lib/error-middleware.ts` — Centralized handler
- `src/lib/errors.test.ts` — Error tests
- `src/middleware/error.test.ts` — Middleware tests

### Modified Files (Backend)
- `src/types.ts` — Add `ApiResponse`, `ErrorDetails`, `ErrorCode`
- `src/index.ts` — Register error middleware + JSON parse error handling
- `src/routes/klines.ts` — Throw structured errors instead of swallowing
- `src/routes/records.ts` — Throw structured errors for validation/DB/auth failures
- `src/routes/admin.ts` — Restructure nested try-catch, preserve Binance fallback
- `src/routes/klines.test.ts` — Error case tests (validation, DB, service failures)
- `src/routes/records.test.ts` — Error case tests (3 routes × 3 error types)
- `src/routes/admin.test.ts` — Error case tests (nested try-catch refactoring)

### Modified Files (Frontend)
- `public/js/records.js` — Update fetch error handling to parse `error.code`
- `public/js/charts.js` — (if errors displayed) Update error handling
- `public/js/api.js` — (if exists) Consistent error handling pattern

## Testing Strategy

**Unit Tests**:
- Error type serialization (4 tests × 4 error types = 16 tests)
- Error middleware handling (6 tests)
- Error code uniqueness (1 test)

**Integration Tests**:
- Route returns structured error on validation failure (3 routes × 2 failures = 6 tests)
- Route returns structured error on DB failure (3 routes × 2 failures = 6 tests)
- Route returns structured error on service failure (1 route × 3 failures = 3 tests)
- Error middleware logs full context (3 tests)

**Special Cases**:
- Zod error detection → ValidationError conversion (2 tests)
- Binance timeout errors → ExternalServiceError with retry info (2 tests)
- Error context preservation in server logs (2 tests)

**Total**: ~45 tests (target: 80%+ coverage of error paths)
**Coverage target**: 80%+ of error handling code paths

## Risk Mitigation

**Risk**: Middleware breaks all routes during rollout
- **Mitigation**: Middleware typed to handle any error; fallback returns INTERNAL_ERROR

**Risk**: Error type changes break frontend error handling
- **Mitigation**: Semantic versioning on ErrorCode enum; deprecation path documented

**Risk**: Middleware logs expose sensitive data
- **Mitigation**: `details` field excluded from client response; server logs only

## Related Requirements

- CODE-02 (Error Handling) — Primary
- INFRA-02 (API routes use JSON envelope) — Related
- All routes implicitly depend on structured responses

## Phase Dependencies

- Depends on: Nothing (backward compatible)
- Blocks: None (orthogonal to other phases)
- Can run in parallel with: Architecture improvements #1–6

## Commit Strategy

One commit per task:
1. `feat(phase-11-01): add structured error types and middleware`
2. `refactor(phase-11-02): restructure route error handling`
3. `refactor(phase-11-03): update frontend error handling`
4. `test(phase-11-04): add comprehensive error handling tests`
5. `docs(phase-11): add LEARNING.md and error handling guide`
