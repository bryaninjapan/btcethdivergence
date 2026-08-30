# SPIKE REPORT — Binance Reachability from Deployed Cloudflare Worker

**Spike date:** 2026-08-30
**Phase:** 1 (Plan 01-03, Task 2/3) — DATA-07 / SC5
**Worker:** `https://btcethdivergence.swadmin31.workers.dev`
**Spike endpoint:** `GET /api/admin/binance-spike` (1-candle `BTCUSDT` 1h fetch, `startTime = now − 2h`)

> **Note (INFO-04):** The `/api/admin/binance-spike` endpoint is **temporary** — it exposes only a 1-candle public-data fetch. It must be removed or Cloudflare-Access-gated before launch (Phase 9).

## Endpoints Attempted

| Host | Attempted |
|------|-----------|
| `https://api.binance.com` | ✅ |
| `https://data-api.binance.vision` | ✅ |

Both hosts queried at `/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1&startTime=<now-2h>`.

## Results

### Run outputs (plan-mandated, ~30s apart)

**Run 1 — 13:56:58 UTC** (HTTP 502)
```
{"ok":false,"error":"Binance blocked: api.binance.com 403, data-api.binance.vision 403"}
```

**Run 2 — 13:57:32 UTC** (HTTP 502)
```
{"ok":false,"error":"Binance blocked: api.binance.com 403, data-api.binance.vision 403"}
```

### Additional intermittency runs (~15s apart)

| Run | Time (UTC) | api.binance.com | data-api.binance.vision |
|-----|------------|-----------------|--------------------------|
| 3   | 13:59:09   | 403             | 403                      |
| 4   | 13:59:25   | 403             | 403                      |
| 5   | 13:59:40   | 403             | 403                      |

### HTTP statuses

- **api.binance.com:** 403 on all 5 runs
- **data-api.binance.vision:** 403 on all 5 runs

### X-MBX-USED-WEIGHT-1M

Not observable — every response was rejected at the edge (403) before any Binance weight header could be returned. Weight tracking is implemented in `src/lib/binance.ts` (`fetchKlines` reads the header) and will take effect once a reachable path exists.

### Candle counts

0 candles — no kline payload was ever returned from the deployed Worker.

### Block-page evidence

The 403 body from `api.binance.com` is **Cloudflare's own block page** (cf-ray header present; "ERROR: The request could not be satisfied … Request blocked"), and `data-api.binance.vision` returns a bare nginx-style 403 Forbidden. This indicates the request is being rejected at the Cloudflare edge in front of Binance when it originates from Cloudflare Workers' shared datacenter IPs — the exact phenomenon documented in research (PITFALLS.md Pitfall 1 / STATE.md Blocker). It is **not** a Binance-wide outage: the same requests succeed (HTTP 200) when issued from the local machine.

A User-Agent spoofing probe (`Mozilla/5.0 … Chrome/126`) was also attempted from the Worker — still 403 on both hosts, so the block is not UA-based.

## Intermittency Observations

**None.** The block was deterministic: 5/5 runs returned 403 from both hosts across ~3 minutes. The research's "can be intermittent per-request depending on edge IP" behavior was not observed in this session — all Worker edge IPs sampled (cf-ray `a3344e9e…-NRT` region) were blocked consistently.

## Verdict

**Both Binance public kline hosts are BLOCKED from this deployed Cloudflare Worker (403), while reachable from local (200).** The failure is at the Cloudflare edge in front of Binance rejecting Cloudflare Workers' shared IP range. Direct-fetch ingestion from the Worker is **not viable** without a workaround, so SC5 is satisfied via the documented-fallback branch: **a fallback ingestion path is selected and documented below.**

## Phase 2 Path

Per the plan decision rule — *api.binance.com failed, data-api.binance.vision failed, therefore*:

> **Phase 2 uses an EXTERNAL-FETCHER INGEST PATH**: a GitHub Actions free-tier scheduled job fetches klines from Binance (from GitHub's IPs, which reach Binance successfully) and POSTs them into a future Worker endpoint `/api/admin/ingest` (to be built in Phase 2), which persists them to D1. Phase 2 planning must account for this extra component.

**Selected option: (c) — both blocked → external fetcher ingest.**

---

*This decision is a one-way door for the data-ingestion architecture (Phases 2 and 3). Awaiting owner confirmation or override.*