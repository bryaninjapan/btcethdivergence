# Beacon Endpoint Runbook

**Phase 16A — Client-Log Ingestion Endpoint**  
Created: 2026-09-02  
Status: To be implemented in 16A-02.5

---

## 1. Endpoint Specification

### POST /api/client-log

**Purpose**: Ingest frontend error and event logs for production observability in Workers Logs.

**Request Schema**:
```json
{
  "timestamp": "2026-09-02T05:30:15.234Z",  // ISO 8601, required
  "level": "error|warn|info|debug",         // required
  "component": "ChartManager|charts|records|...",  // required
  "action": "loadRange|submitForm|...",     // required
  "message": "readable summary",             // required
  "context": {                              // optional
    "record_id": 42,
    "notes_len": 120,
    "tags_len": 45
  },
  "error": {                                // optional (required for level=error/warn)
    "name": "TypeError",
    "message": "...",
    "code": "VALIDATION_ERROR|SERVICE_ERROR|...",
    "kind": "validation|abort-timeout|abort-superseded|service|database|auth|unknown",
    "stack": "..."
  }
}
```

**Response (202 Accepted)**:
```json
{
  "status": "accepted",
  "id": "<unique-beacon-id>"
}
```

**Response (400 Bad Request)**:
```json
{
  "status": "error",
  "message": "Missing required field: level"
}
```

**Response (413 Payload Too Large)**:
```json
{
  "status": "error",
  "message": "Payload exceeds 64 KB limit"
}
```

### Authentication

**CF Access Policy**: Protected (Option A)  
- Requires valid CF Access token (same as /api/records)
- Enforced at Cloudflare edge
- Test: `curl -X POST /api/client-log` without auth header → expect 401/403

### Constraints

- **Max Payload**: 64 KB (enforce with 413 if exceeded)
- **Timeout**: Client-side 2 seconds recommended
- **Fire-and-forget**: Server returns 202 immediately; async injection into Workers Logs
- **Idempotence**: Unique beacon-id returned for deduplication (optional; server generates)

---

## 2. Frontend Integration Guide

### When to Call

Call `POST /api/client-log` on the following events:

1. **Chart errors** (charts.js):
   - Load failure (HTTP error, timeout, invalid data)
   - Abort (user-superseded, timeout)
   - Rendering failure

2. **Form errors** (records.js):
   - Validation error (client-side)
   - Submit failure (service error)
   - Delete confirmation failure

3. **Global handlers**:
   - Uncaught exceptions
   - Unhandled promise rejections

### Code Pattern

```javascript
// Example: charts.js error handler
async function loadChart(startMs, endMs) {
  try {
    const data = await fetch(`/api/klines?start=${startMs}&end=${endMs}`);
    if (!data.ok) {
      throw new Error(`HTTP ${data.status}`);
    }
    // render chart...
  } catch (error) {
    // Call beacon
    try {
      await fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          component: 'charts',
          action: 'loadChart',
          message: `Chart load failed: ${error.message}`,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        }),
        signal: AbortSignal.timeout(2000)  // 2s timeout
      });
    } catch (beaconError) {
      console.warn('Beacon send failed (non-blocking)', beaconError);
    }
  }
}
```

### Error Handling

Wrap beacon calls in try-catch to **prevent beacon failure from breaking the UI**:

```javascript
try {
  await fetch('/api/client-log', { ... });
} catch (error) {
  // Beacon failed, but don't bubble the error
  console.warn('Beacon send failed (non-blocking)', error);
  // UI continues normally
}
```

### Timeout Implementation

Use `AbortSignal.timeout()` to enforce a 2-second timeout:

```javascript
fetch('/api/client-log', {
  method: 'POST',
  body: JSON.stringify(record),
  signal: AbortSignal.timeout(2000)  // 2 seconds
})
```

### Alternative: navigator.sendBeacon()

For guaranteed delivery (doesn't wait for response, survives page unload):

```javascript
navigator.sendBeacon('/api/client-log', JSON.stringify(record));
```

**Trade-off**: `sendBeacon` cannot set custom headers or read response, but ensures delivery even if page is closing.

---

## 3. Backend Implementation

### Endpoint Handler (src/routes/api/client-log.ts)

```typescript
import { Router } from 'hono';
import { verifyAuth } from '@/lib/auth';
import type { ClientLog } from '@/types';

const router = Router();

router.post('/api/client-log', verifyAuth, async (c) => {
  try {
    const body = await c.req.json() as ClientLog;

    // Validate schema
    if (!body.timestamp || !body.level || !body.component || !body.action || !body.message) {
      return c.json({ status: 'error', message: 'Missing required field' }, 400);
    }

    // Check size
    const payload = JSON.stringify(body);
    if (payload.length > 64 * 1024) {
      return c.json({ status: 'error', message: 'Payload exceeds 64 KB limit' }, 413);
    }

    // Inject into Workers Logs (stdout)
    console.log(JSON.stringify({
      timestamp: body.timestamp,
      level: body.level,
      source: 'client',
      component: body.component,
      action: body.action,
      message: body.message,
      context: body.context,
      error: body.error
    }));

    // Return accepted immediately (fire-and-forget)
    return c.json({
      status: 'accepted',
      id: crypto.randomUUID()
    }, 202);
  } catch (error) {
    console.error('Client-log endpoint error:', error);
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
});
```

### Workers Logs Injection

Stdout from the Worker is automatically captured by Cloudflare Workers Logs.  
Verify with: `wrangler tail --format pretty`

---

## 4. Testing Instructions

### Manual Tests (cURL)

```bash
# Test 1: Valid request
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "timestamp": "2026-09-02T05:30:15.234Z",
    "level": "error",
    "component": "charts",
    "action": "loadError",
    "message": "Chart load failed",
    "error": { "name": "NetworkError", "message": "fetch failed" }
  }'
# Expected: 202 Accepted + unique beacon-id

# Test 2: Missing required field
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{ "timestamp": "2026-09-02T05:30:15.234Z" }'
# Expected: 400 Bad Request

# Test 3: Oversized payload
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-09-02T05:30:15.234Z",
    "level": "error",
    "component": "charts",
    "action": "test",
    "message": "<65 KB payload>"
  }'
# Expected: 413 Payload Too Large

# Test 4: Unauthorized (no token)
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{ ... }'
# Expected: 401 Unauthorized (CF Access)

# Test 5: Timeout (client-side)
timeout 1 curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{ ... }'
# Expected: curl times out after 1 second
```

### E2E Test (16A-03.2)

1. Trigger an error in the chart UI (e.g., invalid time range)
2. Verify in Workers Logs dashboard:
   ```bash
   wrangler tail --format pretty
   ```
3. Log should appear within 5 seconds with all fields (timestamp, level, component, action, message)

### Performance Test (Chrome DevTools)

1. Open DevTools → Performance tab
2. Start recording
3. Trigger chart error (via UI or test)
4. Stop recording
5. Filter by 'fetch' → Beacon POST should show:
   - Duration: ≤100ms median
   - Main-thread blocking: ≤5ms
   - Screenshot required for verification

---

## 5. Troubleshooting

### Log not appearing in Workers Logs

**Problem**: POST returns 202 but no log in dashboard.

**Diagnosis**:
- [ ] Check `wrangler tail` for any errors on Worker side
- [ ] Verify stdout redirection is enabled in wrangler.jsonc
- [ ] Confirm CF Access token is valid (202 doesn't guarantee successful injection)

**Fix**: Add explicit logging to Worker handler to debug the flow.

### Beacon silently failing (no error in console)

**Problem**: Fetch returns but never resolves.

**Diagnosis**:
- [ ] Check 2s timeout is being enforced
- [ ] Look for network errors in DevTools > Network tab
- [ ] Verify CF Access policy allows the request

**Fix**: Add explicit error logging to beacon call wrapper.

### CF Access 401/403 (Unauthorized)

**Problem**: Beacon endpoint returns 401 even with valid token.

**Diagnosis**:
- [ ] Verify CF Access policy includes `/api/client-log`
- [ ] Check token is being passed (should auto-set via CF Access middleware)
- [ ] Confirm policy path is `/api/*` (wildcard) not `/api/records` only

**Fix**: Update CF Access policy to include beacon endpoint.

### Main-thread blocking (>5ms)

**Problem**: Performance profile shows beacon fetch blocks main thread.

**Diagnosis**:
- [ ] Check fetch is wrapped in try-catch (prevents propagation)
- [ ] Verify timeout is set (2s max)
- [ ] Consider using `navigator.sendBeacon()` instead

**Fix**: Defer fetch to next microtask via `setTimeout(0, ...)` or switch to sendBeacon.

---

## 6. Verification Checklist (16A-03.2)

- [ ] Beacon endpoint returns 202 Accepted on valid request
- [ ] Beacon endpoint returns 400 on invalid schema
- [ ] Beacon endpoint returns 413 on oversized payload
- [ ] Beacon endpoint requires CF Access authentication
- [ ] Log records appear in Workers Logs within 5 seconds
- [ ] Client-side timeout enforced (2s max)
- [ ] Beacon failure does not break UI (try-catch working)
- [ ] Performance profile shows ≤100ms POST duration
- [ ] Performance profile shows ≤5ms main-thread blocking
- [ ] Charts.js error handler calls beacon on load/abort errors
- [ ] Records.js form handlers call beacon on validation/submit errors
- [ ] Global error handler captures uncaught + unhandledrejection
