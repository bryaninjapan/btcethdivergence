---
phase: 11
title: "Error Handling — Implementation Deep Dive"
date: 2026-09-01
---

# Phase 11 Implementation Notes

Technical reference for extending error handling and patterns for future phases.

---

## Error Type Design

### Class Hierarchy Rationale

**Choice:** Inheritance-based AppError + 5 subtypes

```typescript
abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  constructor(public code: ErrorCode, message: string, public details?: any) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toResponse(): ApiErrorResponse {
    return { code: this.code, message: this.message };
    // Note: details NOT included (sanitized)
  }
}

class ValidationError extends AppError {
  readonly httpStatus = 400;
}

class DatabaseError extends AppError {
  readonly httpStatus = 500;
}

class ExternalServiceError extends AppError {
  readonly httpStatus = 502;
}

class AuthenticationError extends AppError {
  readonly httpStatus = 401;
}

class NotFoundError extends AppError {
  readonly httpStatus = 404;
}
```

**Why Inheritance vs Discriminated Union:**

Inheritance:
- ✅ `error instanceof ValidationError` is idiomatic TypeScript
- ✅ Each subtype can override `toResponse()` for custom logic
- ✅ Middleware branches on instanceof checks naturally
- ✅ Adding new error type doesn't touch existing code

Discriminated Union (alternative):
```typescript
type AppError = 
  | { type: 'validation', code: 'VALIDATION_ERROR', message: string, httpStatus: 400 }
  | { type: 'db', code: 'DATABASE_ERROR', message: string, httpStatus: 500 }
  | ...
```
- ❌ Requires tag-based branching in middleware (less idiomatic)
- ❌ Less extensible (new type = update union)
- ❌ Harder to add per-type methods

**Verdict:** Inheritance chosen. Production use validates this choice.

---

## Error Code Enum

```typescript
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

**Rationale:**
- ✅ Enum ensures type safety (compile-time checks)
- ✅ String values are machine-readable (used in API responses)
- ✅ Centralized definition (no duplication across middleware/frontend)
- ✅ Adding new code = update enum only

**Frontend Dependency:** Frontend code branches on these string values:
```javascript
if (data.error.code === ErrorCode.VALIDATION_ERROR) { ... }
```

---

## Error Middleware Pattern

### Architecture

```typescript
// src/lib/error-middleware.ts
export function errorMiddleware(app: HonoApp): void {
  app.onError((error, c) => {
    // Step 1: Log for debugging
    const requestId = c.req.header('X-Request-ID') || 'unknown';
    logger.error('Unhandled error', {
      requestId,
      path: c.req.path,
      method: c.req.method,
      error: error instanceof Error ? error.stack : String(error),
    });

    // Step 2: Convert to AppError if needed
    if (error instanceof ZodError) {
      const appError = new ValidationError('Request validation failed', {
        issues: error.issues.map(i => ({ path: i.path, message: i.message }))
      });
      return c.json(appError.toResponse(), appError.httpStatus);
    }

    if (error instanceof AppError) {
      return c.json(error.toResponse(), error.httpStatus);
    }

    // Step 3: Unknown error → 500 INTERNAL_ERROR
    const unknownError = new AppError(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      { stack: error instanceof Error ? error.stack : undefined }
    );
    return c.json(unknownError.toResponse(), 500);
  });
}

// Registration in src/index.ts
const app = new Hono();
errorMiddleware(app);
app.route('/api', routes);
```

### Middleware Placement

⚠️ **Critical:** Middleware must be registered **before routes**:

```typescript
// CORRECT
const app = new Hono();
errorMiddleware(app);  // First
app.route('/api', routes);  // Then

// WRONG
const app = new Hono();
app.route('/api', routes);  // Routes registered first
errorMiddleware(app);  // Middleware registered after (won't catch route errors)
```

### Error Propagation Flow

```
1. Route handler throws error
   ↓
2. Hono catches it (because middleware registered)
   ↓
3. Middleware's app.onError() called
   ↓
4. Converts to AppError if needed
   ↓
5. Calls error.toResponse() to sanitize
   ↓
6. Returns JSON response with HTTP status
   ↓
7. Client receives ApiResponse { ok: false, error: { code, message } }
```

---

## Conversion Patterns

### ZodError → ValidationError

```typescript
if (error instanceof ZodError) {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  
  throw new ValidationError('Request validation failed', { issues });
}
```

Frontend receives:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  }
}
```

Details (with issues) **not sent** to client. Logged server-side:
```
Server log: { issues: [{ path: 'start_time', message: 'Expected number' }] }
```

### D1 Error → DatabaseError

```typescript
try {
  return await db.prepare('SELECT * FROM records WHERE id = ?').bind(id).first();
} catch (error) {
  throw new DatabaseError('Failed to fetch record', {
    originalError: error instanceof Error ? error.message : String(error),
    query: 'SELECT * FROM records WHERE id = ?',  // For debugging
  });
}
```

### Binance API Error → ExternalServiceError

```typescript
try {
  const response = await fetch(`https://api.binance.com/...`);
  if (!response.ok) {
    throw new BinanceError(response.status, await response.text());
  }
  return await response.json();
} catch (error) {
  throw new ExternalServiceError(
    'Binance API request failed',
    {
      endpoint: 'https://api.binance.com',
      status: error instanceof BinanceError ? error.status : 'unknown',
      originalError: error instanceof Error ? error.message : String(error),
    }
  );
}
```

---

## Response Sanitization

### Before: Leaked Details
```json
{
  "ok": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Failed to fetch record",
    "details": {
      "query": "SELECT * FROM records WHERE id = ?",
      "originalError": "ECONNREFUSED: Connection refused"
    }
  }
}
```

❌ **Security issue:** Query and connection details leaked to client.

### After: Sanitized Response
```json
{
  "ok": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Failed to fetch record"
  }
}
```

✅ **Secure:** Only code and message sent. Details logged server-side.

**Implementation:**
```typescript
toResponse(): ApiErrorResponse {
  return {
    code: this.code,
    message: this.message,
    // Note: this.details NOT included
  };
}
```

---

## Frontend Error Handling

### api.js: Parse Error Code

```javascript
export async function apiCall(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  
  if (!data.ok && data.error?.code) {
    throw new ApiError(data.error.code, data.error.message);
  }
  
  return data.data;
}

class ApiError extends Error {
  constructor(public code, message) {
    super(message);
  }
}
```

### records.js: Context-Specific Messages

```javascript
async function fetchRecords(filters) {
  try {
    return await apiCall('/api/records', {
      method: 'GET',
      body: JSON.stringify(filters),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'VALIDATION_ERROR') {
        showError(`Invalid input: ${error.message}`);
      } else if (error.code === 'DATABASE_ERROR') {
        showError('Database error. Please try again later.');
      } else if (error.code === 'NOT_FOUND') {
        showError('No records found.');
      } else {
        showError(error.message);
      }
    } else {
      showError('Network error.');
    }
  }
}
```

---

## Testing Patterns

### Unit Test: Error Type

```typescript
describe('DatabaseError', () => {
  it('creates with code and message', () => {
    const error = new DatabaseError('Query failed', { query: 'SELECT ...' });
    
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.message).toBe('Query failed');
    expect(error.details.query).toBe('SELECT ...');
    expect(error.httpStatus).toBe(500);
  });

  it('toResponse() excludes details', () => {
    const error = new DatabaseError('Failed', { query: 'SELECT' });
    const response = error.toResponse();
    
    expect(response).toEqual({
      code: 'DATABASE_ERROR',
      message: 'Failed',
    });
    expect(response.details).toBeUndefined();
  });
});
```

### Integration Test: Middleware

```typescript
describe('Error Middleware', () => {
  it('catches ValidationError and returns 400', async () => {
    const app = new Hono();
    errorMiddleware(app);
    
    app.post('/test', (c) => {
      const schema = z.object({ name: z.string() });
      schema.parse({});  // Throws ZodError
    });
    
    const res = await app.request(
      new Request('http://localhost/test', { method: 'POST' })
    );
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('catches unknown error and returns 500', async () => {
    const app = new Hono();
    errorMiddleware(app);
    
    app.get('/test', (c) => {
      throw new Error('Unexpected error');
    });
    
    const res = await app.request(new Request('http://localhost/test'));
    const data = await res.json();
    
    expect(res.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
```

---

## Extension Points

### Adding a New Error Type

When implementing a new feature that needs a specific error type:

1. **Add to ErrorCode enum:**
   ```typescript
   export enum ErrorCode {
     // ... existing
     PAYMENT_ERROR = 'PAYMENT_ERROR',  // New
   }
   ```

2. **Create error subclass:**
   ```typescript
   export class PaymentError extends AppError {
     readonly httpStatus = 402;  // Payment Required
   }
   ```

3. **Use in feature code:**
   ```typescript
   try {
     await processPayment(amount);
   } catch (error) {
     throw new PaymentError('Payment processing failed', { error: String(error) });
   }
   ```

4. **Test:**
   ```typescript
   it('throws PaymentError on payment failure', async () => {
     await expect(processPayment(-100)).rejects.toEqual(
       expect.objectContaining({ code: ErrorCode.PAYMENT_ERROR })
     );
   });
   ```

5. **Frontend handles:**
   ```javascript
   if (error.code === 'PAYMENT_ERROR') {
     showPaymentRetryDialog();
   }
   ```

---

## Debugging Guide

### Error Not Caught?

Checklist:
- [ ] Middleware registered **before** routes: `errorMiddleware(app); app.route(...)`
- [ ] Route handler `await`s promises: `const result = await db.query()`
- [ ] Error is thrown, not returned: `throw new ValidationError(...)` not `return { error: ... }`

### Details Leaked to Client?

Check:
```typescript
// Middleware returns error response like this:
return c.json(error.toResponse(), error.httpStatus);

// NOT like this:
return c.json(error, error.httpStatus);  // ❌ Leaks details
```

### Frontend Can't Parse error.code?

Verify:
```javascript
// Check response structure
console.log(data);  // Should have { ok: false, error: { code: '...', message: '...' } }

// Check code comparison
if (data.error?.code === 'VALIDATION_ERROR') { ... }  // Correct
if (data.error?.code === ErrorCode.VALIDATION_ERROR) { ... }  // Also correct if enum imported
```

---

## Performance Considerations

### Error Path Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Throw AppError | <0.1ms | Negligible; errors are exceptional |
| Middleware catch | <0.1ms | instanceof check is fast |
| toResponse() | <0.05ms | Simple object creation |
| JSON.stringify | ~1ms | Depends on details object size |

**Total error path:** ~1-2ms (negligible)

**Note:** Errors are **not** on the hot path. Optimize success paths instead.

### Logging Overhead

Server-side logging with full context:
- Details field logged only once (at middleware)
- No repeated logging at route level
- Structured logging format minimizes I/O

---

## Migration Guide (if refactoring existing code)

**Old pattern (Phase 10):**
```typescript
try {
  const record = await db.getRecord(id);
  return c.json({ ok: true, data: record });
} catch (error) {
  return c.json({ ok: false, error: String(error) }, 500);
}
```

**New pattern (Phase 11):**
```typescript
const record = await db.getRecord(id);  // May throw DatabaseError
return c.json({ ok: true, data: record }, 200);
// Middleware catches any thrown error
```

**Changes:**
1. Remove try-catch from route
2. Let errors propagate to middleware
3. Middleware handles response formatting

---

## References

- **errors.ts** — Error type implementations
- **error-middleware.ts** — Middleware entry point
- **errors.test.ts** — 19 unit tests
- **error-middleware.test.ts** — 16 integration tests

---

**Last Updated:** 2026-09-01
