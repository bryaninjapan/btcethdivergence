# Performance Baseline: lightweight-charts v5.2.1 (Reference)

**Date**: 2026-09-04  
**Environment**: Chrome on macOS, localhost dev server (wrangler dev)  
**Test Page**: `public/charts.html` (dual BTC/ETH charts, 1000+ K-lines each)  
**Baseline Purpose**: Reference metrics for Phase 19 KLineChart v10 comparison

---

## Measurements Summary

| Environment | Metric | Value | Unit | Source |
|---|---|---|---|---|
| Chrome | Init time (page load, 3x avg) | 34 | ms | performance.timing API (loadEventEnd - navigationStart); 3 measurements: 39ms, 31ms, 32ms |
| Chrome | DOM complete time (average) | 34 | ms | performance.timing.domComplete - navigationStart |
| Chrome | Memory (used heap) | 3.06 | MB | performance.memory.usedJSHeapSize |
| Chrome | Memory (total heap) | 3.86 | MB | performance.memory.totalJSHeapSize |
| Chrome | Bundle size (uncompressed) | 193.28 | KB | Fetched from CDN, blob.size |
| Chrome | Bundle size (gzip estimated) | 55-65 | KB | Typical JavaScript gzip ratio ~30% of uncompressed |
| Chrome | Scroll FPS (smooth interaction) | 77 | fps | requestAnimationFrame frame counter |
| Chrome | Canvas elements rendered | 14 | count | DOM query querySelectorAll('canvas') |
| Mobile (Chrome emulation) | Init time (mobile viewport) | 34 | ms | performance.timing API on 375x812 Chrome DevTools mobile viewport emulation |
| Mobile (Chrome emulation) | Memory (used heap, mobile) | 6.31 | MB | performance.memory.usedJSHeapSize on Chrome DevTools mobile viewport |
| Mobile (Chrome emulation) | Memory (total heap, mobile) | 9.6 | MB | performance.memory.totalJSHeapSize on Chrome DevTools mobile viewport |
| Mobile (Chrome emulation) | Scroll FPS (estimated) | 60 | fps | Estimated 60fps mobile cap; smooth rendering observed (not measured via real iOS) |

---

## Detailed Measurements

### 1. Initialization Time

**Test Procedure**:
- Fresh navigation to `http://localhost:8787/charts.html`
- Measure from navigationStart to loadEventEnd via performance.timing API
- Three measurements with cache enabled

**Results**:
- Measurement 1: 39ms
- Measurement 2: 31ms
- Measurement 3: 32ms
- **Average: 34ms**

**Source**: Chrome DevTools Performance API (`performance.timing`)  
**Notes**: Time includes HTML parsing, CSS/JS load, CDN script fetch (lightweight-charts), chart initialization, and Binance API data fetch (async via Worker)

---

### 2. Memory Usage

**Test Procedure**:
- Measure heap usage after charts fully load and render
- Query performance.memory API

**Results**:
- Used JS Heap: 3.06 MB
- Total JS Heap: 3.86 MB
- Allocated but unused: 0.80 MB

**Source**: Chrome DevTools Memory API (`performance.memory`)  
**Notes**: Heap includes lightweight-charts library + chart instances + rendered canvases + application code. Total heap is pre-allocated memory limit, not actual consumption.

---

### 3. Bundle Size

**Test Procedure**:
- Fetch lightweight-charts@5.2.1 from unpkg CDN
- Measure blob size (browser auto-decompresses gzip)
- Check CDN encoding headers

**Results**:
- Uncompressed: 197,922 bytes (193.28 KB)
- Gzip (on wire): ~55-65 KB (estimated ~30% compression ratio typical for JS)
- File URL: `https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js`

**Source**: Fetch API (blob.size) + CDN metadata  
**Notes**: Browser receives gzip-compressed bytes from CDN, automatically decompresses to ~193 KB. Actual network transfer is much smaller (~55-65 KB depending on gzip quality).

---

### 4. Frame Rate (Scroll Performance)

**Test Procedure**:
- Measure FPS while page is interactive
- Use requestAnimationFrame counter for 1-second sample
- Measure during normal scrolling/interaction

**Results**:
- Scroll FPS: 77 fps
- Frame time: ~13ms average

**Source**: requestAnimationFrame frame counter  
**Notes**: Smooth 60+ fps indicates lightweight-charts rendering is performant on this hardware (Apple Silicon Mac). Browser is capable of 120fps, actual rendering is 77fps due to chart update throttling/batching.

---

### 5. Visual Rendering

**Chart Composition**:
- Number of canvas elements: 14
- Charts rendered: 2 (BTC/ETH, both 1h timeframe)
- K-lines per chart: 1000+
- Layout: Dual-pane (stacked vertically)

**Source**: DOM inspection (querySelectorAll('canvas'), querySelectorAll('[id$="-chart"]'))  
**Notes**: Each chart uses multiple canvas layers for price area, volume, time axis, etc. Total 14 canvases for two charts indicates sophisticated multi-layer rendering architecture.

---

### 6. Mobile Performance (Chrome DevTools Emulation)

**Test Procedure**:
- Chrome DevTools Device Mode, mobile viewport emulation (375x812px, iPhone-equivalent)
- Measure same metrics as desktop for comparison
- Emulation covers viewport size, DPR, and touch behavior — it does NOT run the Safari/iOS rendering engine

**Results**:
- Init time: 34ms (same as desktop)
- Used heap: 6.31 MB (2x desktop, higher DPR rendering in emulated viewport)
- Total heap: 9.6 MB (higher allocation in emulated mobile viewport)
- Estimated FPS: 60fps (typical mobile cap; not directly measured)

**Source**: Chrome DevTools mobile viewport emulation (375x812), performance.memory API, visual rendering inspection  
**Notes**: These numbers are Chrome on macOS rendered in an emulated 375x812 mobile viewport. The 60fps figure is an estimate of a typical mobile cap, not a measurement. Memory is higher in the emulated viewport due to DPR-scaled rendering. Init time is identical because files are still locally cached; a real device over network would be ~2-3x slower. **A real Safari/iOS (Web Inspector) measurement was NOT taken — Phase 22 should verify on actual iOS hardware.** Real iOS behavior may differ (different JS engine, memory limits, 60fps cap).

**Mobile Rendering**:
- Chart renders responsively in mobile viewport
- Touch interactions work smoothly
- Canvas rendering adapts to narrower viewport
- All 1000+ K-lines visible with proper scaling

---

## Data Loading

**API Source**: Binance REST v3 endpoint (`/api/v3/klines`)  
**Data Route**: Worker intercepts `/api/klines` → D1 database query → JSON response  
**Data Volume**: ~2000 K-lines total (1000+ BTC, 1000+ ETH)  
**Load Time**: Included in init time (33-39ms), async fetch + chart update

---

## Browser/Hardware Specifications

### Desktop (Chrome)
- **Browser**: Chrome (latest, macOS)
- **OS**: macOS (Apple Silicon)
- **Viewport**: 800px+ (full desktop)

### Mobile (Chrome DevTools Emulation)
- **Browser**: Chrome DevTools Device Mode (mobile viewport emulation)
- **Emulated Device**: iPhone (375x812px resolution)
- **Emulation**: Viewport size, DPR, and touch simulation only — does NOT simulate the Safari/iOS rendering engine
- **OS**: macOS (Chrome); viewport dimensions emulate iPhone

### Server Configuration
- **Server**: Wrangler dev (local, no network latency)
- **Cache**: Enabled (browser cache + HTTP cache)
- **D1 Database**: Seeded with Binance K-line data

---

## Notes for Phase 19 Comparison

### Desktop Performance Targets
1. **Init time baseline**: 34ms — this is the time to render 1000+ K-lines with lightweight-charts. KLineChart Phase 19 should aim for <50ms to maintain responsive feel.

2. **Memory baseline**: 3.06 MB used — KLineChart memory footprint should be comparable (not significantly higher for same data volume).

3. **FPS baseline**: 77fps — interactive experience is smooth. KLineChart should maintain 60+ fps during pan/zoom.

### Mobile Performance Targets
4. **Mobile memory**: 6.31 MB used in Chrome-emulated mobile viewport (2x desktop). KLineChart should stay under 8 MB on mobile devices to avoid memory pressure. (Emulation only — verify on real iOS in Phase 22.)

5. **Mobile FPS**: 60fps is an estimated mobile cap (Chrome emulation; not a real iOS measurement). KLineChart must maintain consistent 60fps on mobile for smooth scrolling/interaction. Verify on real iOS in Phase 22.

6. **Mobile init time**: Expect 2-3x higher in production due to network latency. Current 34ms is local cache only.

### Bundle Size Targets
7. **Bundle size**: 193 KB uncompressed (55-65 KB gzip). Phase 20 (extension + indicators) will increase this; keep total <300 KB gzip if possible to stay within mobile data budget.

### Measurement Notes
8. **This is cached/warm-load performance**. Cold load (no cache) would be 2-3x slower due to CDN fetch and network latency. Measurements do NOT include Binance API network time (async, parallel with rendering).

---

## Verification Checklist

- [x] Real measurements from actual wrangler dev session
- [x] Chrome DevTools Performance API measurements (init time, memory)
- [x] Network timing from browser fetch (bundle size)
- [x] FPS measured via requestAnimationFrame
- [x] Source column populated for every row
- [x] No placeholder values (180ms, 11MB, 50KB, 58fps, 250ms, 8MB removed)
- [x] D1 seeded (verified with curl pre-check: `curl -sf http://localhost:8787/api/klines?limit=5` returned 2+ rows)
- [x] Charts render with real Binance data (1000+ candles)

---

*Baseline created: 2026-09-04 for Phase 18 (Full Preparation)*
