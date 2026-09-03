# Phase 16A Implementation Notes — Structured Logging System

**Date**: 2026-09-03  
**Plan**: `.planning/phases/phase-16a/PLAN.md`

---

## Logger Design

- **Option C** (custom lightweight logger) — zero dependencies, preserves the
  no-build-step architecture. Decision matrix in `DECISION.md`.
- **Two implementations, one contract**: `src/lib/logger.ts` (TS/backend) and
  `public/js/logger.js` (ESM/frontend). A parity test
  (`src/lib/logger-parity.test.ts`) asserts identical record shapes so logs are
  queryable consistently across Workers Logs regardless of origin.
- **Sink interface** keeps the core dependency-free:
  - Backend default: `consoleSink` → Workers Logs (stdout).
  - Frontend default: `consoleSink` + `createBeaconSink()` (POST `/api/client-log`,
    2s `AbortSignal.timeout`, oversized payloads dropped, never throws).
- **Error classification** (`classifyError`): maps backend codes
  (`VALIDATION_ERROR`/`DATABASE_ERROR`/`SERVICE_ERROR`/`AUTH_ERROR`) and error
  shapes (TimeoutError, AbortError, TypeError, ZodError, AppError subclasses) to
  7 kinds. Bare `AbortError` defaults to `abort-superseded` — the app convention
  is that plain aborts are superseded in-flight loads, while timeouts always
  carry a `TimeoutError` reason (charts.js aborts with explicit reasons).

## Redaction Rule

- Call sites log `notes_len`/`tags_len` (lengths) only.
- `redactRecord()` is defense-in-depth: any `notes`/`tags`/`note`/`tag` key in
  `context` is replaced by its length at dispatch time on **both** loggers.
- Blocking tests in `src/lib/logger.test.ts` and `public/js/logger.test.js`.

## Key Deviations from PLAN.md

1. **"Auth required" beacon unit test** — Worker code has no per-route auth
   (consistent with `/api/records`; Cloudflare Access enforces auth at the edge).
   Covered instead by: CORS boundary tests (untrusted origin → no
   `Access-Control-Allow-Origin`) + manual curl verification documented in
   `BEACON-RUNBOOK.md` (R9).
2. **ChartManager abort logging** — aborts (`abort-superseded`/`abort-timeout`)
   are logged at **debug** level, never as exceptions, so superseded loads don't
   spam Workers Logs / the beacon. `charts.js` still captures timeouts as
   exceptions at the UI layer.
3. **Beacon injection** uses the structured logger (`createLogger('client-log')`)
   rather than a raw `console.log`, to satisfy SC13 (zero raw console.* in beacon
   code).
4. **E2E count**: 84/84 (81 existing + 1 beacon spec × 3 browsers). Workers Logs
   visibility is verified manually post-deploy (SC8/SC11/SC12) via `wrangler tail`.

## Test Strategy

- **Unit**: 571 passing (was 492). New: 34 frontend logger, 25 backend logger,
  11 parity, 7 beacon endpoint, + ChartManager logging tests.
- **E2E**: `e2e/client-log.spec.ts` forces a klines 500 via `page.route`, asserts
  charts.js fires an error beacon with the correct contract, and checks the
  endpoint returns 202/400 directly.
- **Coverage**: 88.02% lines (gate ≥85%).

## Observability Setup

- `wrangler.jsonc`: `observability.enabled: true`, `head_sampling_rate: 1`,
  `logs.enabled: true`.
- Docs: `RUNBOOK.md` (Workers Logs), `BEACON-RUNBOOK.md` (endpoint spec).