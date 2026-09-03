---
phase: 16.1
name: Structured Logging System
status: planned
created: 2026-09-02
depends_on: 15
duration: 2 days
---

# Phase 16A Plan: Structured Logging System

<!-- REVISED 2026-09-02 (Mode=Check Pass 2): 
  All 14 warnings resolved via modifications
  B3 Decision: Option B (add beacon endpoint)
  Duration: 1-1.5 days → 2 days
  New SC: SC11/12/13 (beacon-related)
  New Tasks: 16A-02.5/6 (beacon dev), 16A-03.2 (beacon verification)
  New Doc: BEACON-RUNBOOK.md
-->

## Overview

Replace ad-hoc `console.*` calls with a small, dependency-free structured logging layer that carries context (component, action, severity, timestamp, classified error). Enable Cloudflare Workers Logs for backend observability AND add a client-log ingestion beacon endpoint for frontend error tracking in production.

**Duration**: 2 days (≈16 focused hours)
**Work Type**: Frontend/backend logging instrumentation + observability configuration
**Risk Level**: Medium — logging on every error path; mitigated by comprehensive unit tests and E2E regression suite.

---

## Origin

From Phase 15 code review finding **IN-01** (`.planning/phases/phase-15/15-REVIEW.md:255-291`): current code uses `console.error()` instead of structured logging, preventing production error tracking.

---

## Success Criteria

- [ ] SC1 — Logging approach decided and recorded in `DECISION.md` with trade-off matrix (Option A: Sentry, Option B: pino, Option C: custom lightweight logger) ✅ **Option C approved**
- [ ] SC2 — Structured logging integrated in ChartManager (state transitions), charts.js (load/init errors), records.js (form + delete + filter)
- [ ] SC3 — `classifyError()` distinguishes abort-timeout / abort-superseded / validation / service / database / auth / unknown
- [ ] SC4 — Record contract enforced on both sides with frontend↔backend parity test
- [ ] SC5 — 443 existing unit tests + ~40 new logging tests pass
- [ ] SC6 — 81/81 E2E pass (no behavioural regression)
- [ ] SC7 — Coverage ≥85% lines (baseline 87.91%)
- [ ] SC8 — Workers Logs enabled in wrangler.jsonc, verified on deployed Worker, with RUNBOOK.md
- [ ] SC9 — Code review: zero HIGH/CRITICAL
- [ ] SC10 — Zero raw console.* in production code outside logger sinks
- [ ] **SC11 — Beacon endpoint POST /api/client-log**: ✅ **[B3: Option B]**
  - Accepts JSON with { timestamp, level, component, action, message, context?, error? }
  - Returns 202 Accepted
  - Rejects invalid schema with 400 + error message
  - CF Access policy: **Option A (protected, requires token)**
  - Injection: logs appear in Workers Logs within 5 seconds
- [ ] **SC12 — Beacon integration from charts.js**:
  - charts.js calls beacon on errors (abort, validation, service failures)
  - Wrapped in try-catch (no propagation to UI)
  - Client-side timeout ≤2 seconds (AbortSignal)
  - E2E proof: trigger error → verify Workers Logs
- [ ] **SC13 — Zero raw console.* in beacon code** (src/routes/api/client-log.ts)

---

## Design Decisions

**Approved by owner** (2026-09-02):
- Use **Option C: Custom lightweight logger** (no external dependencies, preserves no-build-step architecture)
- Simple contract: `{ timestamp, level, component, action, message, context, error? }`
- Pluggable sink interface: `consoleSink` by default; `sentrySink` deferred behind [PLAN-GATE-A]
- Backend Workers Logs as primary observability sink (zero cost, built-in retention)

---

## Task Breakdown

### 16A-01: Logger Core + ChartManager Integration (~0.5 day)

- [ ] 16A-01.1: Record Option C decision in DECISION.md with rationale
- [ ] 16A-01.2: TDD public/js/logger.js (contract tests, pluggable sinks, redaction)
- [ ] 16A-01.3: TDD src/lib/logger.ts + refactor error-middleware
- [ ] 16A-01.4: Instrument ChartManager (state transitions, optional injected logger)

### 16A-02: Page Instrumentation + Monitoring + Beacon (~0.75 day)

**Part A: Instrumentation (0.5 day)**
- [ ] 16A-02.1: Instrument charts.js (abort-cause classification, load logging)
- [ ] 16A-02.2: Instrument records.js (form operations, with redaction)
- [ ] 16A-02.3: Global error handlers (uncaught + unhandledrejection)
- [ ] 16A-02.4: Enable Workers Logs + runbook

**Part B: Beacon Endpoint (~0.25 day)** ✅ **[B3: Option B]**
- [ ] 16A-02.5: Implement POST /api/client-log endpoint
  - Accept clientLog record (timestamp, level, component, action, message, context, error)
  - Return 202 Accepted (fire-and-forget)
  - Inject log into Workers Logs via stdout
  - 4 unit tests: valid payload, invalid schema, auth required, oversized payload
  
- [ ] 16A-02.6: Integrate charts.js to call beacon on error
  - Add logger.captureException() in existing error handlers
  - Wrap in try-catch (prevent beacon failure → UI break)
  - Implement 2s timeout (AbortSignal + setTimeout)
  - Example call sites: abort handler (~line 150), error handler (~line 200)
  
- [ ] [OPTIONAL] 16A-02.7: Push alerting (Sentry adapter or GitHub workflow) — default: skip

### 16A-03: Verification + Review (~0.5 day)

- [ ] 16A-03.1: Full sweep (npm test, typecheck, E2E, coverage, grep for console)
- [ ] 16A-03.2: Beacon integration verification ✅ **[NEW]**
  - [ ] Call beacon from charts.js error handler (manual + E2E proof)
  - [ ] POST /api/client-log returns 202 Accepted
  - [ ] Log record appears in Workers Logs within 5 seconds
  - [ ] Beacon call doesn't block main thread (Chrome DevTools performance profile)
  - [ ] Timeout validation: 2s max, fails gracefully with try-catch
- [ ] 16A-03.3: Code review + docs
  - [ ] README.md update (logging architecture, beacon endpoint)
  - [ ] IMPLEMENTATION-NOTES.md (logger design, test strategy)
  - [ ] RUNBOOK.md (Workers Logs setup, debugging)
  - [ ] **BEACON-RUNBOOK.md** (endpoint spec, client integration, error handling) ✅ **[NEW]**

---

## Logging Record Contract

```json
{
  "timestamp": "2026-09-02T05:30:15.234Z",
  "level": "error|warn|info|debug",
  "component": "ChartManager|charts|records|api|http",
  "action": "loadRange|submitForm|transition|...",
  "message": "readable summary",
  "context": {
    "record_id": 42,
    "notes_len": 120,
    "tags_len": 45
  },
  "error": {
    "name": "TypeError",
    "message": "...",
    "code": "VALIDATION_ERROR",
    "kind": "validation|abort-timeout|abort-superseded|service|database|auth|unknown",
    "stack": "..."
  }
}
```

**Redaction rule**: Never log user-supplied `notes` or `tags` values. Log only their lengths.

---

## Beacon Endpoint Contract

**POST /api/client-log** — Submit frontend logs for production observability

**Request**:
```json
{
  "timestamp": "2026-09-02T05:30:15.234Z",
  "level": "error|warn|info|debug",
  "component": "ChartManager|charts|records|...",
  "action": "loadRange|submitForm|...",
  "message": "readable summary",
  "context": { /* optional */ },
  "error": { /* optional */ }
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

**Authentication**: CF Access required (Option A) — same as /api/records  
**Max Payload**: 64 KB (Workers subrequest safety margin)  
**Client Timeout**: 2 seconds recommended (AbortSignal)

---

## Testing Strategy

- **Unit (41 + 4 beacon cases)** ✅ **[UPDATED]**: record shape, level filters, classifyError kinds, serializeError edge cases, redaction, sink dispatch + POST /api/client-log validation (valid, invalid schema, missing required, oversized payload)
- **Integration**: existing error-middleware.test.ts, records.test.ts unchanged and green
- **E2E (81 + 1 beacon run)** ✅ **[UPDATED]**: existing specs + beacon integration proof (trigger error → verify Workers Logs)
- **Performance Validation** ✅ **[NEW]** (part of 16A-03.2):
  - Beacon POST duration ≤100ms median, ≤2s max (timeout)
  - Main-thread blocking ≤5ms
  - Tool: Chrome DevTools Performance tab (screenshot required)
- **Manual**: post-deploy curl + Workers Logs dashboard + beacon endpoint verification

---

## Risks & Mitigations

| # | Risk | Sev | Mitigation |
|---|------|-----|------------|
| R1 | New logger files below 85% coverage gate | High | TDD; run coverage at end of 16A-01 |
| R2 | Touching charts.js abort logic reintroduces Phase 15 race | High | Logging-only edits; 81/81 E2E gate |
| R3 | Logging user notes/tags leaks private data | High | Explicit redaction + blocking test |
| R4 | _transition() logging spams console on pan/zoom | Medium | debug level; production warn default |
| R5 | error-middleware changes response shape | Medium | Response unchanged; middleware tests pass |
| R6 | Sentry dependency blows Workers Free 10ms/50 subrequest budget | Medium | Option C zero deps/subrequests |
| R7 | "Monitoring configured" claimed without verification | Medium | Post-deploy curl + dashboard check |
| R8 | Beacon CORS misconfigured (cross-origin blocked) ✅ **[NEW]** | Low | Verify POST /api/client-log allows CORS; test with curl -H "Origin: ..." |
| R9 | CF Access gate blocks beacon (401/403) ✅ **[NEW]** | Medium | Decision B3.1: Option A (protected) ✅ selected; test POST without token |
| R10 | Beacon timeout > 2s blocks main thread ✅ **[NEW]** | Low | 2s client-side timeout (AbortSignal); alternative: navigator.sendBeacon(); performance profile |
| R11 | Beacon payload oversized ✅ **[NEW]** | Negligible | Enforce 64 KB max; reject >64KB with 413; test case required |

---

## Out of Scope

- Sentry integration (deferred; optional via [PLAN-GATE-A])
- Performance tracing / RUM metrics
- Log-based dashboards beyond saved queries
- API endpoint for client-log ingestion

---

## Verification Commands

```bash
# Existing commands
npm test                     # all tests (including 4 beacon unit tests)
npm run typecheck
npm run test:coverage        # ≥85% gate
npx playwright test          # 81/81 + 1 beacon integration run
grep -rn "console\." public/js src --include=*.js --include=*.ts | grep -v test

# NEW: Beacon endpoint validation ✅
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-09-02T05:30:15.234Z","level":"error","component":"charts","action":"loadError","message":"Chart load failed"}'
# Expected: 202 Accepted

# Invalid payload test (expect 400)
curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{"invalid":"payload"}'
# Expected: 400 Bad Request

# Timeout test (expect timeout within 2s)
timeout 1 curl -X POST http://localhost:8787/api/client-log \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-09-02T05:30:15.234Z","level":"error","component":"charts","action":"timeout","message":"test"}'
# Expected: curl timeout after 1s

# Performance profile (manual, part of 16A-03.2)
# 1. Open Chrome DevTools > Performance tab
# 2. Start recording
# 3. Trigger error in chart (UI or E2E test)
# 4. Stop recording
# 5. Filter by 'fetch' → beacon POST should show ≤100ms duration, ≤5ms main-thread blocking
```

---

## Handoff

Phase 16A is complete when all 13 success criteria are met and code review yields zero HIGH/CRITICAL.
