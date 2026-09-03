# Phase 16.1 (16A) Summary — Structured Logging System

**Executed**: 2026-09-03  
**Plan**: `.planning/phases/phase-16a/PLAN.md`  
**Duration**: single session (~4h focused)

---

## What Was Built

### New production files

| File | Purpose |
|------|---------|
| `public/js/logger.js` | Frontend structured logger (contract, `classifyError`, `serializeError`, `redactRecord`, `createLogger`, `consoleSink`, `createBeaconSink`, `installGlobalHandlers`) — plain ESM, no bundler |
| `src/lib/logger.ts` | Backend mirror of the logger with TypeScript types (same contract, parity-tested) |
| `src/routes/client-log.ts` | Beacon endpoint `POST /api/client-log` (zod validation, 64 KB limit, Workers Logs injection via logger, 202/400/413) |
| `e2e/client-log.spec.ts` | Beacon E2E: forced chart error → beacon → endpoint contract (202/400) |

### Modified files

| File | Change |
|------|--------|
| `public/js/managers/ChartManager.js` | Optional injected logger; debug-level state-transition/range logs; abort-aware `loadRange` error logging; console.warn → logger.warn |
| `public/js/charts.js` | Logger + beacon wiring; abort-cause classification (`abort('superseded')` vs `TimeoutError`); `loadRange.error`/`.superseded`/`.invalidRange`; global error handlers; init catch → `captureException` |
| `public/js/records.js` | Logger + beacon wiring; `submitForm.*`, `delete.*`, `loadRecords.*` with notes/tags redaction (lengths only); global error handlers; init catch → `captureException` |
| `src/lib/error-middleware.ts` | Replaced ad-hoc `logError` `console.error` with `createLogger('http').captureException` |
| `src/index.ts` | Registered `/api/client-log` route |
| `wrangler.jsonc` | Enabled Workers Logs (`observability.enabled: true`, `head_sampling_rate: 1`) |

### New test files

| File | Tests |
|------|-------|
| `public/js/logger.test.js` | 34 (contract, classify, serialize, redaction, dispatch, sinks, global handlers) |
| `src/lib/logger.test.ts` | 26 (backend mirror + prototype-key guard) |
| `src/lib/logger-parity.test.ts` | 11 (frontend↔backend identical record shapes — SC4) |
| `src/routes/client-log.test.ts` | 7 (202 valid, 400 invalid schema/level/JSON, 413 oversized, CORS boundary ×2) |
| `ChartManager.test.ts` (+7) | logging instrumentation, abort-not-exception |

### Docs

| File | Purpose |
|------|---------|
| `phase-16a/DECISION.md` | Option C decision + trade-off matrix (SC1) |
| `phase-16a/RUNBOOK.md` | Workers Logs setup, tail, debugging, redaction guarantee (SC8) |
| `phase-16a/IMPLEMENTATION-NOTES.md` | Logger design, deviations, test strategy |
| `phase-16a/BEACON-RUNBOOK.md` | (pre-existing) endpoint spec + integration guide |
| `phase-16/README.md` | Logging architecture + beacon section |

---

## Verification Results (16A-03.1)

| Gate | Result | Status |
|------|--------|--------|
| Unit tests | **571/571** (was 492; +79 logging/beacon/ChartManager tests) | ✅ |
| Typecheck | `tsc --noEmit` clean | ✅ |
| E2E | **84/84** (81 existing + 1 beacon spec × 3 browsers) | ✅ |
| Coverage | **88.13% lines** (gate ≥85%; baseline 87.91%) | ✅ |
| Console sweep | zero raw `console.*` outside logger sinks (SC10) + beacon code (SC13) | ✅ |
| Beacon curls | 202 valid / 400 invalid / 413 oversized; Workers Logs line visible in `wrangler dev` output | ✅ |

**Manual production check remaining (human checkpoint)**: deploy and confirm logs in the live Workers Logs dashboard / `wrangler tail`:

```bash
npm run deploy
wrangler tail --format pretty
# trigger a chart error on https://btcethdivergence.bryanlab.cc/charts.html
# expect: {"level":"error","component":"charts","action":"loadRange.error",...} within 5s
```

---

## Tasks Completed

- [x] 16A-01.1 — DECISION.md (Option C)
- [x] 16A-01.2 — frontend logger + tests
- [x] 16A-01.3 — backend logger + parity + error-middleware refactor
- [x] 16A-01.4 — ChartManager instrumentation
- [x] 16A-02.1 — charts.js instrumentation (abort classification, beacon)
- [x] 16A-02.2 — records.js instrumentation (redaction)
- [x] 16A-02.3 — global error handlers (window.onerror / unhandledrejection)
- [x] 16A-02.4 — Workers Logs enabled + RUNBOOK
- [x] 16A-02.5 — beacon endpoint + unit tests
- [x] 16A-02.6 — beacon integration (2s timeout, try-catch, non-blocking)
- [x] 16A-03.1 — full sweep (unit/typecheck/E2E/coverage/grep)
- [x] 16A-03.2 — beacon E2E + curl verification
- [x] 16A-03.3 — docs + code review
- [ ] ~~16A-02.7~~ — optional push alerting, deliberately skipped per plan

---

## Deviations from PLAN.md (documented, small)

1. **"Auth required" beacon unit test** → covered by CORS-boundary tests + manual curl (auth is enforced at the Cloudflare Access edge, consistent with `/api/records`; no in-Worker auth exists for any UI API). See IMPLEMENTATION-NOTES.
2. **ChartManager aborts** are logged at **debug**, never as exceptions/beacons, so superseded loads don't spam Workers Logs. Timeouts are still captured as exceptions at the charts.js UI layer.
3. **Beacon injection** uses the structured logger (`client-log` component) instead of raw `console.log`, to satisfy SC13.
4. **E2E count** is 84/84 (81 + 1 beacon spec × 3 browsers); live Workers Logs visibility is verified manually post-deploy (not automatable in Playwright).

## [CONFLICT] / [PLAN-GATE] decisions

- None. The only human-gated item is the **post-deploy Workers Logs verification** (SC8/SC11/SC12) and the optional [PLAN-GATE-A] Sentry adapter (deferred by design).

## Security / Cleanup fixes applied

- `[cleanup]` removed unused `_logException` helper from ChartManager.
- `[cleanup]` removed unused `validationMessage` import from client-log route.
- `[fix]` hardened backend `setLevel` against prototype-inherited keys (`constructor`).
- No `[security]` issues found (no DEV_* flags, no hardcoded secrets, no auth bypass — beacon is CF-Access gated at the edge).