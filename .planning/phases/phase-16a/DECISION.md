# Decision: Logging Approach (Phase 16A)

**Date**: 2026-09-03
**Status**: ✅ APPROVED (Option C)
**Origin**: Phase 15 code review finding **IN-01** — ad-hoc `console.error()` prevents production error tracking.

---

## Options Considered

| Criteria | Option A: Sentry | Option B: pino | Option C: Custom lightweight logger ✅ |
|----------|-----------------|----------------|----------------------------------------|
| External dependencies | @sentry/workers + tunnel | pino + transports | **None** |
| Cloudflare Workers budget | ⚠️ Subrequest budget (10ms/50 subreq) consumed by SDK | ⚠️ Extra runtime weight | **Zero overhead** |
| No-build-step frontend | ❌ Requires bundler | ❌ Requires bundler | **✅ Plain ESM, no bundler** |
| Structured JSON records | ✅ | ✅ | **✅ Same shape both sides** |
| Error classification | Partial (manual) | None built-in | **✅ classifyError()** |
| Redaction control | Config-heavy | Config-heavy | **✅ redactRecord() defense-in-depth** |
| Cost | Free tier but SaaS + tunnel | OSS | **Zero cost (Workers Logs)** |
| Setup complexity | High (DSN, tunnel, source maps) | Medium | **Low** |
| Fit with single-Worker architecture | ❌ Heavy | ❌ Heavy | **✅ Native** |

**Decision**: **Option C — custom lightweight logger**, with a pluggable sink interface.

- Backend sink: Workers Logs (stdout capture via `wrangler tail`), zero cost, built-in retention.
- Frontend sink: `consoleSink` (structured JSON to dev console) + `beaconSink` (POST `/api/client-log`, fire-and-forget, 2s timeout).
- Sentry remains **deferred** behind [PLAN-GATE-A] — a `sentrySink` could be added later without touching call sites.

---

## Consequence

- New files: `src/lib/logger.ts` (backend), `public/js/logger.js` (frontend), parity tested.
- All production `console.*` calls move behind the logger sinks (SC10).
- Beacon endpoint `POST /api/client-log` (Option B for frontend observability) is protected by CF Access (Option A), same as `/api/records`.