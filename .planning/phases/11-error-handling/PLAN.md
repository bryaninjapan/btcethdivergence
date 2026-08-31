---
phase: 11
title: "Error Handling & Structured Responses"
date_created: 2026-09-01
goal: Replace ad-hoc error handling with structured error types, unified response envelope, and centralized error middleware
depends_on: Phase 1-10 (v1.0 complete)
requirements: CODE-02 (Error Handling)
estimated_effort: 3-4 days
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
**Duration**: 1 day
**Deliverable**: `src/lib/errors.ts`, error middleware, types

Tasks:
- [ ] Create `src/lib/errors.ts`:
  - Define `AppError` base class
  - Define `ValidationError`, `DatabaseError`, `ExternalServiceError`, `AuthenticationError`
  - Implement `toResponse()` method for each type
  - Define `ErrorCode` enum
- [ ] Create `src/lib/error-middleware.ts`:
  - Centralized error handler
  - Logs full error + context
  - Returns structured `ApiResponse<never>` on error
  - Handles both `AppError` and unexpected errors
- [ ] Update `src/types.ts`:
  - Export `ApiResponse<T>` interface
  - Export `ErrorDetails` interface
  - Export `ErrorCode` enum

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
  - Restructure nested try-catch
  - Separate concerns: validation → service → DB
  - Each layer throws typed error
  - Middleware catches and formats

### Phase 11-03: Integration & Testing
**Duration**: 1 day
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

### Modified Files
- `src/types.ts` — Add `ApiResponse`, `ErrorDetails`, `ErrorCode`
- `src/index.ts` — Register error middleware
- `src/routes/klines.ts` — Structured errors
- `src/routes/records.ts` — Structured errors
- `src/routes/admin.ts` — Restructured try-catch
- `src/routes/klines.test.ts` — Error case tests
- `src/routes/records.test.ts` — Error case tests
- `src/routes/admin.test.ts` — Error case tests

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

**Total**: ~40 tests (target: 80%+ coverage of error paths)

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
3. `test(phase-11-03): add comprehensive error handling tests`
4. `docs(phase-11): add LEARNING.md and error handling guide`
