# Phase 6 Summary — Dual Chart Rendering & Time Sync

**Date**: 2026-08-31
**Executor**: gsd-executor
**Status**: ALL TASKS COMPLETE — no blockers, no checkpoints pending human input.

## What was built

| File | Purpose |
|---|---|
| `public/charts.html` | Charts page — stacked `#btc-chart` (top) and `#eth-chart` (bottom) panes, pinned Lightweight Charts v5.2.1 standalone CDN script, `#chart-error` banner, module scripts `api.js` + `charts.js` |
| `public/index.html` | Minimal reachability link (`<a href="/charts.html">K線圖</a>`) in the records page header |
| `public/css/style.css` | `.chart-pane` rules (explicit 420px container heights, stacked cards) + `#chart-error` styling |
| `public/js/charts.js` | `loadWindow()` fetches a bounded 30-day kline window for BTCUSDT/ETHUSDT via `api()`; `toCandle()` maps rows to LWC v5 data (unix-sec `time`); `renderChart()` creates a chart + `CandlestickSeries` per pane; `init()` aligns the initial visible logical range (BTC → ETH) then wires `sync.link` both ways |
| `public/js/chart-sync.js` | Pure `createRangeSync()` factory — duck-typed logical-range link with a shared `syncing` re-entrancy guard (`try/finally`), `isUsableRange` rejection of null/non-finite ranges; no DOM, no LWC global |
| `public/js/chart-sync.test.ts` | Vitest suite (8 tests) with `FakeTimeScale`/`ThrowingTimeScale` reproducing LWC's synchronous notify-back: forwarding, re-entrancy-loop prevention (bidirectional), rapid-fire, symmetric, null/NaN rejection, gap forwarding, unsubscribe, exception-safety |

## Tasks completed vs. blocked

- ✅ 06-01 T1 — charts page + pane CSS + reachability link (deployed, markers green)
- ✅ 06-01 T2 — charts.js fetch + dual candlestick render (deployed, markers green, browser checkpoint PASS)
- ✅ 06-02 T1 — chart-sync.js + vitest suite (8/8 green)
- ✅ 06-02 T2 — sync wiring in charts.js (deployed, markers green, interactive browser checkpoint PASS)
- ⛔ Blocked: none. No human checkpoints pending.

## Plan-check warnings applied

- **W-1 (exception-safety test wiring)**: authored case 8 per the fix_hint — the throwing scale is the link *target* (`sync.link(b, a)` with `a = ThrowingTimeScale`), `b.fire(...)` throws, guard resets via `finally`, and a subsequent non-throwing apply succeeds. Also addressed I-1: test count is **8/8** (the plan text said "7/7").
- **W-2 (optional Playwright spec)**: implemented a real-browser automated sync checkpoint instead of a committed Playwright spec, using the fix_hint's sanctioned approach of exposing `window.btcChart`/`window.ethChart` in `charts.js` (see deviations).

## [CONFLICT] / [PLAN-GATE] decisions

None.

## Deviations from the plan

1. **`window.btcChart` / `window.ethChart` exposed in `charts.js`** (06-02 T2). The plan's `init()` kept chart refs in local `const`s; the plan-check W-2 fix_hint explicitly sanctioned exposing them ("harmless, aids debugging") to enable real-browser lockstep assertions. Without them the interactive SC2/SC3 checkpoint could only be verified visually. Logged, minimal, no behavior change.
2. **Verify commands use `curl -sfL` instead of `curl -sf` for `/charts.html` / `/js/*` URLs.** Cloudflare Workers Static Assets 307-redirects `charts.html` → `/charts` and `index.html` → `/` (standard clean-URL behavior, confirmed identical for `/index.html` on the pre-existing records page). `curl -sf` without `-L` returns an empty body on the 307, so the plan's literal marker commands grep an empty string. The code functionally matches the plan — this is a verify-command fix (allowed under decision-tree B.3).
3. **Favicon 404**: the deployed site has no `/favicon.ico`, so browsers log a benign `Failed to load resource: 404` network message on every page (index.html included — pre-existing, not introduced by this phase). It is not a JS error; the browser checkpoints assert zero JS console/page errors and no error banner, which hold.
4. **Browser checkpoint scope**: the loaded window is the fixed last-30-days range (Phase 6 scope, per plan), so the "far-left edge of history" checkpoint exercises the beyond-data-bounds path at the left edge of the loaded 30-day dataset rather than the 2021 start; the gap-across-unequal-datasets case is proven by construction via the vitest gap test.

## Verification results (end-to-end)

- `npx vitest run public/js/chart-sync.test.ts` → **8/8 passed**
- `npx vitest run` → **76 passed** (10 files, no regressions)
- `npm run typecheck` → exit 0
- Deployed markers (https://btcethdivergence.gn01968711.workers.dev): `/charts.html` serves pinned `lightweight-charts@5.2.1`, `#btc-chart` above `#eth-chart`, `href="/charts.html"` on `/`, `.chart-pane` CSS; `/js/charts.js` contains `CandlestickSeries`, `/api/klines`, `DEFAULT_WINDOW_SECONDS`, `createRangeSync`, `getVisibleLogicalRange`, `sync.link`; `/js/chart-sync.js` contains `createRangeSync`
- Must-never-appear greps all 0: `addCandlestickSeries`, `lightweight-charts@latest`, `innerHTML`, `fetch(` in `charts.js`, `setVisibleTimeRange|subscribeVisibleTimeRangeChange|getTimeRange` in `chart-sync.js`/`charts.js`, `document|window|LightweightCharts` in `chart-sync.js`
- **Browser (Playwright, headless chromium)**: both panes render real hourly candlesticks with correct titles and no error banner (SC1, SC4). Interactive sync: baseline aligned (both `535..722`); BTC pan → ETH matches exactly; ETH pan → BTC matches exactly; BTC Ctrl+wheel zoom → both match; 40-event rapid zoom + 30-drag rapid pan → zero desync, zero JS errors; left-edge scrub beyond data bounds → no crash, no drift (SC2, SC3).

## Commit range

`git log --oneline 573b92b..HEAD`:
- `7d7c277` feat(phase-6): charts page — stacked BTC/ETH panes, pinned LWC v5.2.1 CDN, reachability link
- `4923f86` feat(phase-6): charts.js — bounded 30-day kline fetch for BTC/ETH and v5 candlestick rendering per pane
- `7b22bce` feat(phase-6): pure logical-range sync factory (chart-sync.js) with re-entrancy guard + vitest suite
- `f2ad4b9` feat(phase-6): wire logical-range sync into charts.js with initial alignment and bidirectional links

(`573b92b` was HEAD before execution.)

No [security] or [cleanup] commits were needed — Section A scans (DEV_* flags, hardcoded secrets, auth bypass, dead code, unused imports) found nothing across all touched files.