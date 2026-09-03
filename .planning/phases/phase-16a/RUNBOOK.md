# Workers Logs Runbook (Phase 16A)

**Phase 16A — Structured Logging / Observability**  
Created: 2026-09-03  
Status: Implemented in 16A-02.4

This runbook covers how Workers Logs is enabled, how to stream/tail it, and how
to debug the structured logging pipeline (backend logger + client-log beacon).

---

## 1. Enabling Workers Logs

Workers Logs (real-time + persisted invocation logs) is enabled in
`wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1,
  "logs": {
    "enabled": true,
    "invocation_logs": true
  }
}
```

- `head_sampling_rate: 1` — every invocation is captured.
- `logs.invocation_logs` — per-invocation metadata (URL, status, duration).

Deploy once to activate:

```bash
npm run deploy
```

## 2. Streaming Logs

### Real-time tail (terminal)

```bash
wrangler tail --format pretty
```

Filter by a specific message/component (JSON format for grepping):

```bash
wrangler tail --format json | jq -r 'select(.logs[]?.message | contains("loadRange"))'
```

### Local development

`npm run dev` (wrangler dev) prints Worker stdout directly to the terminal —
structured JSON lines from the logger sinks appear inline.

### Dashboard (persisted)

- Cloudflare dashboard → **Workers & Pages** → `btcethdivergence` → **Logs**.
- Saved queries: `component:"http"`, `level:"error"`, `clientComponent:"charts"`.

## 3. What Gets Logged

### Backend (server-side)

| Source | Component | Notes |
|--------|-----------|-------|
| `errorMiddleware` | `http` | All request errors, classified + structured (action `errorMiddleware`) |
| `client-log` endpoint | `client-log` | Ingested frontend records, `source:"client"` |

### Frontend (via beacon → Workers Logs)

| Page | Component | Actions |
|------|-----------|---------|
| charts.html | `charts` | `loadRange.error`, `loadRange.superseded`, `init`, `window.onerror`, `window.onunhandledrejection` |
| index.html | `records` | `submitForm.*`, `delete.*`, `loadRecords.*`, `window.onerror`, ... |

Records carry the shared contract:
`{ timestamp, level, component, action, message, context?, error? }` with
`error.kind` one of `abort-timeout | abort-superseded | validation | service | database | auth | unknown`.

## 4. Client-Log Beacon

`POST /api/client-log` ingests frontend records (202 Accepted, fire-and-forget).

- **Endpoint spec**: see `BEACON-RUNBOOK.md`.
- **Auth**: Cloudflare Access at the edge (same policy as `/api/records`).
- **Timeout**: client-side 2s via `AbortSignal.timeout()`.
- **Oversized**: payloads > 64 KB are rejected with 413 and dropped client-side.

## 5. Debugging Checklist

- [ ] `wrangler tail` shows structured JSON lines (not ad-hoc `console.error`).
- [ ] Trigger a chart error → `clientComponent:"charts"` record appears ≤ 5s.
- [ ] Submit an invalid record form → `records.submitForm.validation` (warn) appears.
- [ ] `npm run typecheck` clean; `npm test` green (includes logger + beacon tests).
- [ ] `grep -rn "console\." public/js src` → only logger sinks + test helpers.

## 6. Redaction Guarantee

User-supplied `notes`/`tags` content is **never** logged. Both loggers replace
them with `notes_len` / `tags_len` at dispatch time (defense-in-depth), and call
sites already log lengths only. Verified by blocking tests in
`src/lib/logger.test.ts` and `public/js/logger.test.js`.