---
phase: 16a
name: Structured Logging System
status: planned
created: 2026-09-02
depends_on: 15
duration: 1-1.5 days
---

# Phase 16A Plan: Structured Logging System

## Overview

Replace ad-hoc `console.*` calls with a small, dependency-free structured logging layer that carries context (component, action, severity, timestamp, classified error), and enable Cloudflare Workers Logs so backend errors are queryable in production.

**Duration**: 1-1.5 days (≈7 focused hours)
**Work Type**: Frontend/backend logging instrumentation + observability configuration
**Risk Level**: Medium — logging on every error path; mitigated by comprehensive unit tests and E2E regression suite.

---

## Origin

From Phase 15 code review finding **IN-01** (`.planning/phases/phase-15/15-REVIEW.md:255-291`): current code uses `console.error()` instead of structured logging, preventing production error tracking.

---

## Success Criteria

- [ ] SC1 — Logging approach decided and recorded in `DECISION.md` with trade-off matrix (Option A: Sentry, Option B: pino, Option C: custom lightweight logger)
- [ ] SC2 — Structured logging integrated in ChartManager (state transitions), charts.js (load/init errors), records.js (form + delete + filter)
- [ ] SC3 — `classifyError()` distinguishes abort-timeout / abort-superseded / validation / service / database / auth / unknown
- [ ] SC4 — Record contract enforced on both sides with frontend↔backend parity test
- [ ] SC5 — 443 existing unit tests + ~40 new logging tests pass
- [ ] SC6 — 81/81 E2E pass (no behavioural regression)
- [ ] SC7 — Coverage ≥85% lines (baseline 87.91%)
- [ ] SC8 — Workers Logs enabled in wrangler.jsonc, verified on deployed Worker, with RUNBOOK.md
- [ ] SC9 — Code review: zero HIGH/CRITICAL
- [ ] SC10 — Zero raw console.* in production code outside logger sinks

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

### 16A-02: Page Instrumentation + Monitoring (~0.5 day)

- [ ] 16A-02.1: Instrument charts.js (abort-cause classification, load logging)
- [ ] 16A-02.2: Instrument records.js (form operations, with redaction)
- [ ] 16A-02.3: Global error handlers (uncaught + unhandledrejection)
- [ ] 16A-02.4: Enable Workers Logs + runbook
- [ ] [OPTIONAL] 16A-02.5: Push alerting (Sentry adapter or GitHub workflow) — default: skip

### 16A-03: Verification + Review (~0.25 day)

- [ ] 16A-03.1: Full sweep (npm test, typecheck, E2E, coverage, grep for console)
- [ ] 16A-03.2: Code review + docs (README, IMPLEMENTATION-NOTES, RUNBOOK)

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

## Testing Strategy

- **Unit (41 cases)**: record shape, level filters, classifyError kinds, serializeError edge cases, redaction, sink dispatch
- **Integration**: existing error-middleware.test.ts, records.test.ts unchanged and green
- **E2E (81 runs)**: all specs unchanged, proving no behavioural drift
- **Manual**: post-deploy curl + Workers Logs dashboard verification

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

---

## Out of Scope

- Sentry integration (deferred; optional via [PLAN-GATE-A])
- Performance tracing / RUM metrics
- Log-based dashboards beyond saved queries
- API endpoint for client-log ingestion

---

## Verification Commands

```bash
npm test                     # all tests
npm run typecheck
npm run test:coverage        # ≥85% gate
npx playwright test          # 81/81
grep -rn "console\." public/js src --include=*.js --include=*.ts | grep -v test
```

---

## Handoff

Phase 16A is complete when all 10 success criteria are met and code review yields zero HIGH/CRITICAL.
