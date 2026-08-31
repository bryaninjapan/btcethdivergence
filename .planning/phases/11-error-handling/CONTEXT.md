---
phase: 11
focus: Error handling architectural decision
---

# Phase 11 Context: Error Handling Architecture

## Current Error Handling Issues

### Location 1: admin.ts (lines 47-59)
```typescript
try {
  // Try to fetch from Binance
  const data = await backfillFromBinance(...)
} catch (error) {
  // Fragile fallback:
  err instanceof BinanceError ? err : new BinanceError(0, String(err))
  console.error(...)  // Logs locally, client gets nothing
}
```

**Problem**: If Binance fails, error info is lost after console.log.

### Location 2: All route handlers
- `klines.ts`: No explicit error handling (relies on Hono default)
- `records.ts`: Zod parsing errors silently swallowed
- `admin.ts`: Mixed error types, no structure

### Location 3: Frontend
```javascript
// records.js
fetch('/api/records').then(res => res.json()).then(data => {
  if (!data.ok) {
    console.error(data.error)  // Always a string; can't differentiate error type
  }
})
```

**Problem**: Frontend can't tell if error is validation, DB, or network.

## Error Types in Codebase

### Validation Errors
- Zod schema failures (invalid type, missing field)
- Domain validation (record ID must be positive)
- **Currently**: Thrown by Zod, then swallowed by route

### Database Errors
- Constraint violations (duplicate record)
- Query failures (D1 connection)
- **Currently**: Thrown by D1, not caught

### External Service Errors
- Binance API rate limit (429)
- Binance timeout
- Binance invalid data format
- **Currently**: Caught as `BinanceError`, but info lost

### Authentication Errors
- CF Access validation failure
- Invalid Service Token
- Missing header
- **Currently**: Handled by CF middleware, not our code

## Design Decisions

### Decision 1: Error Hierarchy

Use inheritance, not discriminated union:
```typescript
class AppError extends Error {
  constructor(public code: ErrorCode, public details?: any) { super() }
}

class ValidationError extends AppError { ... }
class DatabaseError extends AppError { ... }
class ExternalServiceError extends AppError { ... }
class AuthenticationError extends AppError { ... }
```

**Why inheritance over discriminated union**:
- instanceof checks for type narrowing
- Each error type can have custom logic
- Easier to extend (add new error type = new class)
- Middleware catches with `catch (error: AppError)`

### Decision 2: Structured Response Envelope

All responses (success & failure) use:
```typescript
interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: ErrorDetails
}

interface ErrorDetails {
  code: ErrorCode  // Machine-readable: "VALIDATION_ERROR"
  message: string  // User-friendly: "Invalid record ID"
  details?: Record<string, any>  // Debug info: { field: "id", reason: "must be positive" }
}
```

**Why this shape**:
- `ok` flag makes success/failure obvious (vs. checking for error property)
- `code` allows frontend to handle error types programmatically
- `message` is user-friendly (can show in UI)
- `details` has full context for debugging (server-side only)

### Decision 3: Error Code Enum

```typescript
enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  SERVICE_ERROR = "SERVICE_ERROR",
  AUTH_ERROR = "AUTH_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}
```

**Why enum, not string**:
- Compiler catches typos
- Frontend can use `if (error.code === ErrorCode.VALIDATION_ERROR)`
- Easier to find all error types (grep-able)

### Decision 4: Middleware vs. Route-level Error Handling

Use centralized middleware:
```typescript
app.onError((err, c) => {
  const appError = err instanceof AppError ? err : new AppError(...)
  logger.error({ code: appError.code, details: appError.details, stack: err.stack })
  return c.json({ ok: false, error: appError.toResponse() }, 500)
})
```

**Why middleware**:
- Single entry point (DRY)
- Full error context logged server-side
- Consistent response format
- Prevents error info loss in route-level handlers

**Why not route-level**:
- Would require try-catch in every route
- Error handling scattered = maintenance burden
- Risk of forgetting to handle some error type
- Inconsistent error format

### Decision 5: Client Response Sanitization

Server logs full context; client sees sanitized:
```typescript
// Server logs this:
logger.error({
  code: "SERVICE_ERROR",
  message: "Binance API rate limited",
  details: {
    status: 429,
    retryAfter: 60,
    timestamp: "2026-09-01T10:00:00Z"
  }
})

// Client receives this:
{
  ok: false,
  error: {
    code: "SERVICE_ERROR",
    message: "Service temporarily unavailable. Please retry in 60 seconds.",
    // No details leaked to client
  }
}
```

**Why**: Details are for debugging; client should only see actionable messages.

## Error Handling Flow

### Success Path
```
Route receives request
  ↓
Validate input (throw ValidationError if invalid)
  ↓
Call service (may throw DatabaseError or ExternalServiceError)
  ↓
Return ApiResponse { ok: true, data: result }
```

### Failure Path (Single Catch at Middleware)
```
Route throws AppError (ValidationError | DatabaseError | ExternalServiceError | AuthenticationError)
  ↓
Middleware catches (catch (err: AppError))
  ↓
Middleware logs full context to server
  ↓
Middleware returns ApiResponse { ok: false, error: ErrorDetails }
  ↓
Frontend receives structured error, handles by code
```

## Testing Strategy

### Error Type Tests (Unit)
```typescript
describe('ValidationError', () => {
  it('serializes to response with VALIDATION_ERROR code', () => {
    const err = new ValidationError("id", "must be positive")
    expect(err.toResponse()).toEqual({
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/id.*positive/)
    })
  })
})
```

### Middleware Tests (Unit)
```typescript
describe('Error Middleware', () => {
  it('catches ValidationError and returns 400', async () => {
    const app = new Hono()
    app.use(errorMiddleware)
    app.get('/', () => { throw new ValidationError(...) })
    
    const res = await app.request(new Request('http://localhost/'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", ... }
    })
  })
})
```

### Route Tests (Integration)
```typescript
describe('GET /api/records', () => {
  it('returns structured error on invalid ID', async () => {
    const res = await app.request(new Request('http://localhost/api/records?id=invalid'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: expect.stringMatching(/id/) }
    })
  })
})
```

## Future Extensions

### Error Retry Information
When a service error occurs, include retry metadata:
```typescript
{
  ok: false,
  error: {
    code: "SERVICE_ERROR",
    message: "Binance API rate limited",
    retryable: true,
    retryAfter: 60  // seconds
  }
}
```

### Error Tracking (v2)
Send errors to tracking service (Sentry, LogRocket):
```typescript
middleware logs error → sends to Sentry → frontend can report back link to error
```

### Graceful Degradation
Some routes could return partial success:
```typescript
{
  ok: true,  // Partial success
  data: { btcKlines: [...], ethKlines: null },
  error: { code: "SERVICE_ERROR", message: "Could not fetch ETH data" }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         HTTP Request                    │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│    Route Handler (thin, no error catch) │
│  1. Validate input → throw ValidationError
│  2. Call service → may throw DatabaseError/ExternalServiceError
│  3. Return ApiResponse { ok: true, data }
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │ Success?     │
      └──┬───────┬───┘
         │       │
       YES      NO (Error thrown)
         │       │
         ↓       ↓
      Return  ┌──────────────────────────┐
      Response│  Error Middleware        │
             │ 1. Catch AppError        │
             │ 2. Log full context      │
             │ 3. Return structured     │
             │    ApiResponse           │
             └──────────────┬───────────┘
                            ↓
                    ┌───────────────────┐
                    │  JSON Response    │
                    │ { ok, error }     │
                    └───────────────────┘
```

## Questions to Answer During Implementation

1. **HTTP Status Codes**: Should ValidationError return 400? DatabaseError return 500?
   - Answer: Yes, map error types to status codes
   
2. **Logging**: How much detail in server logs?
   - Answer: All details, including stack traces for debugging
   
3. **Client-side Handling**: Should frontend show different UI for each error code?
   - Answer: Yes (toast for validation, error page for service error)
   
4. **Error Messages**: Hardcode or i18n?
   - Answer: Start with hardcoded English; i18n later
   
5. **Auth Errors**: Handled by CF middleware, not our code?
   - Answer: Yes, CF returns 401/403; we handle downstream (app-level) auth errors
