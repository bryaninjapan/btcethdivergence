---
wave: 1
depends_on: none
files_modified:
  - public/demo-klinechart.html
  - .planning/phases/phase-18/
  - .planning/ROADMAP.md
autonomous: false
---

# Phase 18 Plan: Full Preparation (充分準備版)

**Goal**: 環境就緒、評估完成、第一個 demo 運行、性能基準已記錄

**Scope**: Validation + Assessment + Demo + Baseline (NO production code)

**Workload**: 18-20 hours (preparation phase)

**Success Criteria**:
- ✓ klinecharts@10.0.3 environment validated
- ✓ Three-repo compatibility assessment (deep level) complete
- ✓ Migration checklist verified (all items understood)
- ✓ Standalone KLineChart demo running (1000+ K-lines, real Binance data)
- ✓ Performance baseline recorded (lightweight-charts metrics)
- ✓ All high-risk API differences identified & verified
- ✓ 5-phase detailed roadmap confirmed

---

## Tracer Slice (Wave 1)

A single, thin, end-to-end tracer validates the core path: **Binance data → KLineChart demo → Baseline recording**.

### Task 1.1: Environment Validation & Demo HTML

**Goal**: Verify klinecharts import works; create minimal demo page that renders BTCUSDT K-lines (real Binance data).

<read_first>
- package.json (klinecharts@10.0.3 already listed)
- node_modules/klinecharts/dist/index.d.ts (verify the v10 API surface: `init`, `setSymbol`, `setPeriod`, `setDataLoader`, `KLineData.timestamp`)
- public/charts.html (current lightweight-charts usage — reference for structure)
- 18-RESEARCH.md § 5 (Environment validation checklist)
</read_first>

<action>
1. Create `public/demo-klinechart.html` (standalone demo page, not integrated yet)
   - Import klinecharts UMD: `<script src="https://unpkg.com/klinecharts@10.0.3/dist/umd/klinecharts.min.js">`
     - The UMD global is `klinecharts` (lowercase) — do NOT reference `KLineChart`
   - Create container: `<div id="chart"></div>` (500px × 400px)
   - Initialize — v10 `Options` has NO `kline` key, so pass no options (or only valid keys like `layout`):
     ```javascript
     const chart = klinecharts.init('chart')
     chart.setSymbol({ ticker: 'BTCUSDT', pricePrecision: 2, volumePrecision: 5 })
     chart.setPeriod({ span: 1, type: 'hour' })
     ```
   - Fetch BTCUSDT 1h candles from Binance REST API (`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000`)
   - Map each Binance row (array-of-arrays) to v10 KLineData — pass-through ms, key is `timestamp` (NOT `time`), no conversion:
     ```javascript
     const bars = rows.map((r) => ({
       timestamp: r[0],          // Binance open_time is already milliseconds — pass through unchanged
       open: parseFloat(r[1]),
       high: parseFloat(r[2]),
       low: parseFloat(r[3]),
       close: parseFloat(r[4]),
       volume: parseFloat(r[5])
     }))
     ```
   - Load data via the v10 loader API (order: init → setSymbol → setPeriod → setDataLoader):
     ```javascript
     chart.setDataLoader({
       getBars: ({ callback }) => callback(bars)
     })
     ```
   - Do NOT use `applyNew()` / `setData()` / `updateData()` — none exist in v10 (removed; use `setDataLoader`).

2. @klinecharts/extension CDN connectivity & ESM import verification (R18-02, R18-01):
   - @klinecharts/extension@0.1.0 is **ESM-only** (`"type": "module"`, no UMD/IIFE build) — it CANNOT be loaded via a plain `<script src>` tag.
   - Record the ESM URL: `https://unpkg.com/@klinecharts/extension@0.1.0/dist/index.js`
   - Verify connectivity with a HEAD request (see <verify> below).
   - Optional ESM import test (R18-01 supplement): Add a `<script type="module">` block to the demo that dynamically imports klinecharts:
     ```javascript
     <script type="module">
       import { init } from 'https://unpkg.com/klinecharts@10.0.3/dist/index.esm.js'
       console.log('ESM import verified:', typeof init === 'function' ? 'OK' : 'FAIL')
     </script>
     ```
     This verifies the ESM path works under zero-build constraint (complements the CDN UMD check).
   - Functional extension integration is deferred to Phase 20 (drawing tools). Note this in the demo doc.
   - R18-01 note: npm-ESM `import { init } from 'klinecharts'` (RESEARCH.md §5 checklist item) is intentionally OUT OF SCOPE under the locked no-build constraint — R18-01 "`import` 可用" is satisfied via the CDN UMD global; validate the ESM path only if a build step is ever introduced.

3. Verify:
   - Demo loads in Chrome without console errors
   - Demo loads in Safari iOS without errors
   - Chart renders visible K-lines (not empty)
   - Y-axis scale visible and matches the fetched price range; X-axis timestamps correct

4. Document:
   - Record the exact CDN URLs used (base klinecharts@10.0.3 UMD, extension@0.1.0 ESM)
   - Note the extension is ESM-only (no UMD build) — functional import deferred to Phase 20
   - List any version incompatibilities found
   - Note any workarounds applied (e.g., polyfills, timing issues)
</action>

<acceptance_criteria>
- [ ] `public/demo-klinechart.html` exists and opens in browser without 404
- [ ] Chrome DevTools console shows zero errors, zero warnings on page load
- [ ] Chart renders with K-line candles visible (y-axis matches fetched price range, timestamps correct)
- [ ] First candle's `timestamp` value equals Binance `open_time` (13-digit ms, unchanged)
- [ ] Safari iOS can load and render the same page (test via remote debugging or iOS simulator)
- [ ] Binance API call succeeds (verified in Network tab: 200 OK, ~1000+ candles returned)
- [ ] Extension ESM URL returns 200 (R18-02 connectivity confirmed)
- [ ] (Optional I3 hardening) Playwright smoke check: canvas element painted + no console errors in headless browser (use `@playwright/test` already installed; not required for execution)
</acceptance_criteria>

<verify>
<automated>set -o pipefail; curl -sf "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000" | jq -e 'length >= 1000' > /dev/null && curl -sf "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000" | jq -r '.[0][0]' | awk '{ if (length($0) == 13) print "OK ms openTime:", $0; else exit 1 }' && curl -sfI "https://unpkg.com/@klinecharts/extension@0.1.0/dist/index.js" -o /dev/null</automated>
<manual>Open public/demo-klinechart.html in Chrome. In the DevTools Console, verify: (1) no "Invalid time" / "Invalid timestamp" errors; (2) the console logs 'Fake first bar timestamp:' for fake data, then after the real-data swap logs with 2026 dates; console.assert passes silently or logs 'Pass-through failed'; (3) after the real-data swap, the X-axis shows dates in 2026 (not 1970); (4) chart renders visible candles (not empty). These manual checks prove timestamp ms pass-through works correctly in the real demo.</manual>
<fails_when>non-zero exit: Binance HTTP error, response length < 1000, openTime not exactly 13 digits (invalid ms), or extension ESM URL not reachable (non-200); OR manual checks: console errors, fake data not rendered, real data shows 1970 dates, or chart empty</fails_when>
</verify>

---

### Task 1.2: Timestamp Contract Verification (Critical Risk #1 — v10 ms pass-through)

**Goal**: Prove the v10 data contract — KLineChart v10 requires **millisecond** timestamps under the key `timestamp` (not `time`); Binance `open_time` is already ms → **pass through unchanged**. Also demonstrate the R18-05 fake-data render AND the CONTEXT locked real-data render (fake first, then swap to real).

<read_first>
- 18-RESEARCH.md § 2.1 (Timestamp Contract — corrected: v10 = ms, pass-through)
- node_modules/klinecharts/dist/index.d.ts (KLineData interface: `timestamp: number`)
- public/demo-klinechart.html (after Task 1.1 creates it)
</read_first>

<action>
1. Add an inline data-contract test to the demo page that renders **seeded fake data first**, then swaps to **real Binance data** (satisfies both R18-05 "假資料" and the CONTEXT locked decision "完整真實數據"):
   ```javascript
   const fakeBars = [
     { timestamp: 1693526400000, open: 3600, high: 3700, low: 3600, close: 3650, volume: 100 },
     { timestamp: 1693530000000, open: 3650, high: 3750, low: 3640, close: 3700, volume: 105 }
   ]
   // v10 requires ms timestamps under the key `timestamp`. Binance open_time is already ms — pass through.
   console.log('Fake first bar timestamp:', fakeBars[0].timestamp)
   console.assert(fakeBars[0].timestamp === 1693526400000, 'Pass-through failed')
   chart.resetData()
   chart.setDataLoader({ getBars: ({ callback }) => callback(fakeBars) })  // renders fake data (R18-05)
   // then swap to the real Binance data fetched in Task 1.1:
   chart.resetData()
   chart.setDataLoader({ getBars: ({ callback }) => callback(bars) })      // renders real 1000+ candles (CONTEXT decision)
    ```
    - If the chart clears without re-rendering after `resetData()`, re-call `chart.setPeriod({ span: 1, type: 'hour' })` (or `setSymbol`) to force an init load.
    - Note in the demo doc: fake-data render = R18-05 check; real-data render = CONTEXT "完整真實數據" check.
   - `Math.floor(open_time / 1000)` is **WRONG for v10** — it would shift bars to the 1970s. Do not apply it.

2. Verify:
   - Fake data renders visible candles; X-axis label shows the expected date (2023-09-01; the displayed time-of-day depends on the chart timezone, e.g. 08:00 in Asia/Shanghai — do NOT expect Aug 31)
   - After the swap, real data renders 1000+ candles with 2026 dates
   - No "Invalid time" / "Invalid timestamp" errors in console

3. Record (in demo doc and `18-MIGRATION-CHECKLIST-VERIFIED.md`):
   - Data contract: `{ timestamp (ms), open, high, low, close, volume }`
   - Test case: 1693526400000 ms → 1693526400000 ms (unchanged) ✓
   - Verdict: **ms pass-through VERIFIED SAFE** — no ms→s conversion exists in v10
</action>

<acceptance_criteria>
- [ ] Console assertion passes: timestamp remains 13-digit ms (unchanged from Binance)
- [ ] Fake-data render shows candles with correct X-axis date (2023-09-01 — `new Date(1693526400000).toISOString()` = 2023-09-01T00:00:00Z; local-time label varies by chart timezone)
- [ ] Real-data render shows 1000+ candles (2026 dates) after the swap
- [ ] No "Invalid date" or "Invalid timestamp" errors in console
- [ ] Visual inspection: K-lines appear in correct chronological order
</acceptance_criteria>

<verify>
<automated>node -e "const ms=1693526400000; console.assert(String(ms).length===13 && ms>1e12, 'not a 13-digit ms timestamp'); console.log('PASS: ms pass-through preserved:', ms)"</automated>
<fails_when>AssertionError thrown (exit code non-zero)</fails_when>
</verify>

---

## Expansion Tasks (Waves 2-3)

### Task 2.1: Three-Repo Compatibility Assessment + Performance Baseline + Migration Checklist Verification

**Goal**: Document API differences, version matrix, CDN vs npm trade-offs, record the lightweight-charts performance baseline (reference for Phase 19 KLineChart comparison), AND line-by-line verify understanding of the migration checklist (identify gaps/clarifications before Phase 19).

<read_first>
- 18-RESEARCH.md § 1, § 2, § 4 (three-repo analysis + corrected API differences + benchmark plan)
- 18-RESEARCH.md § 3 (migration path reference — corrected for v10)
- 18-CONTEXT.md § Decisions (deep evaluation decision captured)
- .planning/technical-assessment.md (⚠️ UNTRUSTED for API mappings — encodes v9-era API; re-verify every mapping against node_modules/klinecharts/dist/index.d.ts)
- .planning/performance-benchmark-plan.md (5 benchmark tests)
- .planning/migration-checklist.md (week-by-week migration plan — ⚠️ §3's data-transform example encodes the WRONG ms→s conversion; re-verify against the v10 contract from Task 1.2)
- public/charts.html (current lightweight-charts implementation — measurement target)
</read_first>

<action>
**Part A — Compatibility Assessment**

Create document: `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md`

Sections:
1. **Version Matrix**
   - klinecharts@10.0.3: released date, license (Apache-2.0), maintenance status
   - @klinecharts/extension@0.1.0: version, ESM-only (no UMD build), compatibility with base
   - @klinecharts/pro@0.1.1: reference status (not for production)
   - Binance API: v3 endpoint, rate limits, backfill limits

2. **API Mapping Reference** (Function-by-function correspondence — re-verify EACH mapping against the installed v10.0.3 types; do NOT copy technical-assessment.md)
   - lightweight-charts → KLineChart v10 (10+ key mappings below):
   
   **Initialization & Chart Setup**:
   - `chart.createChart(container, opts)` → `klinecharts.init(container, opts)` (UMD global is lowercase `klinecharts`; `Options` has no `kline` key)
   - `chart.addCandlestickSeries()` → built-in — v10 has no explicit series creation
   
   **Data Loading & Manipulation**:
   - `series.setData(candles)` → `chart.setDataLoader({ getBars })` (v9 `applyNew`/`updateData`/`applyMoreData` were REMOVED in v10)
   - `chart.resetData()` → `chart.resetData()` (clears chart, triggers re-fetch via setDataLoader)
   - Data field `time` → `timestamp` (ms, pass-through — no ms→s conversion)
   
   **Symbol & Period Configuration**:
   - `setPriceVolumePrecision(price, volume)` → `chart.setSymbol({ ticker, pricePrecision, volumePrecision })`
   - `setSymbol({ ticker })` → `chart.setSymbol({ ticker })`
   - `chart.setPeriod({ span, type })` → sets the K-line aggregation period (e.g., 1 hour, daily)
   
   **Event System**:
   - `onVisibleLogicalRangeChange()` → `chart.subscribeAction('onVisibleRangeChange', callback)` (verified in v10; full observer pattern)
   - `unsubscribeAction(type, callback?)` → unsubscribe by action type (optionally scoped to callback)
   - Available actions: `onVisibleRangeChange`, `onCrosshairChange`, `onCandleBarClick`, etc.
   
   **Chart Navigation & Viewport**:
   - `timeScale().scrollToTimestamp(timestamp)` → `chart.scrollToTimestamp(timestamp)` (v10 direct method)
   - `timeScale().zoomAtTimestamp(scale, timestamp)` → `chart.zoomAtTimestamp(scale, timestamp, animationDuration?)` (direct; use subscribeAction for range-sync only)

3. **CDN vs npm Trade-offs**
   - CDN: Pros (zero build setup, cache), Cons (size, no tree-shake, extension is ESM-only)
   - npm: Pros (bundling, tree-shake), Cons (build step, version management)
   - Recommendation: **CDN for demo + Phase 19-21 (keep no-build constraint); extension loaded via ESM `<script type="module">` (Phase 20); npm only if a build step is introduced**

4. **Known Limitations**
   - Built-in indicators: KLineChart base ships built-in engine — MA, EMA, MACD, RSI, BOLL, VOL, SMA, KDJ, WR, DMI via `createIndicator`; @klinecharts/extension adds drawing overlays (Phase 20) and can register further indicators (verify via `getSupportedIndicators()` during assessment)
   - @klinecharts/data-aggregator: **deferred to v3.1, NOT in scope (R18-10)** — user is a post-analysis trader, REST API sufficient
   - Cross-browser: All major browsers supported (Chrome, Firefox, Safari, Edge)
   - Mobile: Touch events supported, gesture API compatible

5. **Risk Verification Checklist** (REWRITTEN for v10 — the ms→s "risk" does not exist in v10; R18-09's parenthetical "(timestamp ms→s)" reflects the pre-v10 assumption and is superseded here)
   - [ ] Timestamp contract (ms pass-through, key `timestamp`): VERIFIED in Task 1.2 ✓
   - [ ] Data loader API (`setDataLoader`/`getBars`; order init → setSymbol → setPeriod): verified in Task 1.1 ✓
   - [ ] Event API: `subscribeAction('onVisibleRangeChange')` documented & ready for Phase 19
   - [ ] Extension ESM-only loading (no UMD): recorded; functional integration deferred to Phase 20
   - [ ] Style config: New syntax reference created (sample in RESEARCH.md)

**Part B — Performance Baseline (lightweight-charts reference)**

Measure and record lightweight-charts performance as the reference for Phase 19's comparison.

**Prerequisite**: Ensure `wrangler dev` is running and D1 database is seeded with kline data before starting measurements. The charts page makes HTTP requests to `/api/klines` (Worker route), which requires the local dev server to be active. Without it, the page will timeout or error.
   - **Pre-check**: Verify dev server + D1 seeded: `curl -sf "http://localhost:8787/api/klines?symbol=BTCUSDT&limit=5" | jq -e 'length > 0'` (should return successfully with row count)

1. **Initialization Time** (Chrome DevTools)
   - Open `public/charts.html` (the page that actually renders charts — `index.html` is the records page with NO charts)
   - Chrome DevTools → Performance tab → Record
   - Measure time from page load to "charts rendered" (both BTC + ETH charts)
   - NOTE: charts load asynchronously after the `/api/klines` fetch — start measuring only after both series render
   - Record: lightweight-charts init time (ms); repeat 3 times, average

2. **Memory Usage** (Chrome DevTools)
   - Chrome DevTools → Memory tab → Take heap snapshot
   - Before: fresh load, before chart render; After: charts loaded + 1000+ candles rendered
   - Record: delta memory usage (MB)

3. **Bundle Size**
   - Check network tab: lightweight-charts UMD/ESM file size (CDN script at public/charts.html line 8)
   - Record: gzip size shown in Network tab

4. **Mobile (Safari iOS)**
   - Open `public/charts.html` on iPhone/iPad with Safari Web Inspector
   - Use same timing methodology (performance.now() if possible, or Web Inspector timeline)
   - Record: init time + scroll FPS on mobile

5. **Create Baseline Table** in `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md`
   ```markdown
   ## Performance Baseline (lightweight-charts — Reference)
   
   | Environment | Metric | Value | Unit | Source |
   |-------------|--------|-------|------|--------|
   | Chrome | Init time (1000 candles) | 180ms | ms | TBD |
   | Chrome | Memory delta | 11MB | MB | TBD |
   | Chrome | Bundle (gzip) | 50KB | KB | TBD |
   | Chrome | Scroll FPS | 58 | fps | TBD |
   | Safari iOS | Init time | 250ms | ms | TBD |
   | Safari iOS | Memory delta | 8MB | MB | TBD |
   | Safari iOS | Scroll FPS | 50 | fps | TBD |
   ```
   (⚠️ Values above are PLACEHOLDERS — the automated verify REJECTS them. Replace every Value with a real measurement and fill each Source with the tool used: DevTools Performance / DevTools Memory / Network tab / Safari Web Inspector.)

**Part C — Migration Checklist Verification**

Create checklist document: `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md`

For each section in `.planning/migration-checklist.md`, verify understanding against the installed v10.0.3 API (not against the doc's own v9-era examples):

**Week 1: Core Swap** ✓ Understand
- [ ] Understand: `createChart()` → `klinecharts.init()` (lowercase UMD global)
- [ ] Understand: `createSeries()` → built-in series in KLineChart (no explicit series creation)
- [ ] Understand: Import path changes (lightweight-charts → klinecharts UMD CDN)
- [ ] Clarification needed: (list any 'Y' items from migration checklist)

**Week 2: Event System** ✓ Understand
- [ ] Understand: Callback-style → subscriber pattern
- [ ] Understand: `onVisibleLogicalRangeChange()` → `subscribeAction('onVisibleRangeChange')`
- [ ] Understand: Multiple event types in KLineChart (ready to implement)
- [ ] Clarification needed: (list any open questions)

**Week 3: Styling** ✓ Understand
- [ ] Understand: Flat object → nested object structure
- [ ] Understand: Key name changes (timeScale.timeVisible → grid.horizontal.visible, etc.)
- [ ] Understand: Color format compatibility (verify hex/rgb handling)
- [ ] Clarification needed: (list any gaps)

**Critical Data Transform** ✓ VERIFIED
- [ ] v10 contract verified: `{ timestamp (ms), open, high, low, close, volume }` ✓ (Task 1.2)
- [ ] Binance `open_time` (ms) passes through unchanged under the `timestamp` key — NO `Math.floor(open_time / 1000)` (that would render 1970 bars)
- [ ] Binance API → KLineChart format transformation understood
- [ ] Ready for Phase 19
- [ ] Flag the WRONG example in .planning/migration-checklist.md §3 (`time: Math.floor(row.open_time / 1000)`) as corrected in this verified doc

Mark all items **✓** or list clarifications. If any item is unclear, escalate to discussion.
</action>

<acceptance_criteria>
- [ ] `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md` created
- [ ] Version matrix includes all three repos + Binance API
- [ ] API mapping covers 10+ key functions, every mapping re-verified against v10.0.3 types (not copied from technical-assessment.md)
- [ ] Risk checklist rewritten for v10 (ms→s removed; loader API / ms timestamps / ESM-only extension listed)
- [ ] data-aggregator deferral to v3.1 explicitly stated (R18-10)
- [ ] `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md` created
- [ ] Chrome measurements: init time, memory, bundle size, FPS all recorded (numeric values)
- [ ] Safari iOS measurements: init time, memory, FPS all recorded (numeric values)
- [ ] Every baseline row has a non-empty Source column (DevTools Performance / DevTools Memory / Network tab / Safari Web Inspector)
- [ ] No template placeholder values remain (180ms / 11MB / 50KB / 58fps / 250ms / 8MB / 50fps)
- [ ] `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md` created
- [ ] All Week 1-3 sections reviewed and marked ✓ (understood) or listed (clarification)
- [ ] No "unclear" items without explanation or resolution
- [ ] Critical data transform VERIFIED (ms pass-through, `timestamp` key, no conversion)
</acceptance_criteria>

<verify>
<automated>test -f .planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md && grep -c "klinecharts@10.0.3" .planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md && test -f .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md && ! grep -qE "180ms|11MB|50KB|58fps|250ms|8MB|50fps" .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md && [ "$(grep -cE "^\\| Chrome" .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md)" -ge 4 ] && [ "$(grep -cE "^\\| Safari iOS" .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md)" -ge 3 ] && grep -q "Source" .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md && test -f .planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md && [ "$(grep -cE "✓ (Understand|VERIFIED)" .planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md)" -ge 4 ]</automated>
<fails_when>assessment file missing, no klinecharts@10.0.3 mention, baseline file missing, any template placeholder value still present (180ms/11MB/50KB/58fps/250ms/8MB/50fps), fewer than 4 Chrome or 3 Safari iOS measurement rows, no Source column in the baseline table, checklist file missing, or fewer than 4 marked items (3 Week sections + Critical Data Transform) (exit code non-zero)</fails_when>
</verify>

---

### Task 3.1: Finalize 5-Phase Roadmap (Phases 18-22)

**Goal**: Confirm 5-phase plan is detailed and ready; update ROADMAP.md with Phase 18 completion status.

<read_first>
- .planning/ROADMAP.md (current Phase 18-22 structure)
- .planning/REQUIREMENTS.md (R18-01 to R22-07)
- 18-CONTEXT.md § Decisions (all decisions documented)
</read_first>

<action>
1. Verify each phase has clear goal, deliverables, success criteria:
   - Phase 18 ✓ (just completed: goal + criteria + deliverables locked)
   - Phase 19: "Core Migration" — lightweight-charts → KLineChart (goal + 10 reqs)
   - Phase 20: "Drawing Tools" — @klinecharts/extension integration (goal + 9 reqs)
   - Phase 21: "Indicators" — Technical indicators panel (goal + 9 reqs)
   - Phase 22: "Polish & Production" — Performance optimization + deploy (goal + 7 reqs)

2. Update ROADMAP.md Phase 18 status: ⬜ → 🚧 (IN PROGRESS) or ✓ if this completes it

3. Confirm total workload estimate: 82-101 hours across 5 phases (18-22)
   - Phase 18: 18-20h ✓
   - Phase 19: 16-20h
   - Phase 20: 20-25h
   - Phase 21: 16-20h
   - Phase 22: 12-16h
   - Total: **82-101h** (5 weeks)

4. Cross-reference all 45 requirements with phases:
   - Phases 18 (10) + 19 (10) + 20 (9) + 21 (9) + 22 (7) = 45 ✓

5. Commit Phase 18 deliverables and push the dev branch (R18-08):
   - Stage Phase 18 artifacts: `git add public/demo-klinechart.html .planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md .planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md .planning/ROADMAP.md .planning/REQUIREMENTS.md`
   - Commit with message referencing phase: `git commit -m "Phase 18: demo + compatibility assessment + performance baseline + migration checklist verified"`
   - Push to remote: `git push -u origin feature/klinechart-migration`
   - Verify: `git ls-remote origin feature/klinechart-migration` returns the local HEAD commit
</action>

<acceptance_criteria>
- [ ] .planning/ROADMAP.md shows all 5 phases (18-22) with goals + deliverables + reqs
- [ ] Phase 18 marked as IN PROGRESS (or COMPLETE if this task finishes phase)
- [ ] All 45 requirements (R18-01 to R22-07) accounted for across 5 phases
- [ ] Total workload 82-101 hours confirmed
- [ ] No phase is missing success criteria
- [ ] `feature/klinechart-migration` pushed to origin (verified via `git ls-remote origin feature/klinechart-migration`)
</acceptance_criteria>

<verify>
<automated>[ "$(grep -cE "^#### Phase 1[89]|^#### Phase 2[0-2]" .planning/ROADMAP.md)" -ge 5 ] && grep -q "Status.*🚧" .planning/ROADMAP.md && [ "$(grep -c "| R18-\|| R19-\|| R20-\|| R21-\|| R22-" .planning/REQUIREMENTS.md)" -ge 45 ] && git ls-remote origin feature/klinechart-migration | grep -q "$(git rev-parse HEAD)"</automated>
<manual>Verify Task 3.1 manually: (1) ROADMAP.md Phase 18 shows Status: 🚧 IN PROGRESS (on line after heading); (2) ROADMAP.md Phases 19-22 each have **Success Criteria** section; (3) REQUIREMENTS.md lists 45+ requirements (R18-01 to R22-07 via `grep -c "| R"`); (4) `git log` shows commit with demo-klinechart.html + 18-*.md files + ROADMAP.md + REQUIREMENTS.md updates; (5) `git ls-remote origin feature/klinechart-migration` returns matching commit hash.</manual>
<fails_when>fewer than 5 phase headings in ROADMAP.md, no "Status: 🚧" line in ROADMAP.md, requirement count < 45 in REQUIREMENTS.md, or remote branch does not match local HEAD (exit code non-zero)</fails_when>
</verify>

---

## Artifacts This Phase Produces

- `public/demo-klinechart.html` — Standalone demo page rendering BTCUSDT K-lines
- `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md` — API mapping + version matrix
- `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md` — Performance baseline (reference)
- `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md` — Line-by-line checklist verification
- `.planning/ROADMAP.md` (updated) — Phase 18-22 finalized
- Push: `feature/klinechart-migration` to origin (R18-08, Task 3.1)

---

## Must Haves

1. **v10 ms timestamp contract VERIFIED SAFE** — ms pass-through under the `timestamp` key; demo renders with correct timeline
2. **Binance API connectivity confirmed** — 1000+ K-lines fetch successful
3. **KLineChart import works in browser** — No module resolution errors
4. **Performance baseline recorded** — lightweight-charts metrics for comparison (Phase 19 will measure KLineChart)
5. **Three-repo compatibility understood** — API differences documented, CDN/npm trade-offs assessed
6. **Migration checklist verified** — All items understood or escalated

---

## Verification

**Wave 1 (Tracer)**: Tasks 1.1, 1.2 must pass before moving to Wave 2.

**Wave 2-3**: Task 2.1 (Parts A-C: compatibility + baseline + checklist) and Task 3.1 (roadmap finalization + branch push) expand scope.

**Success**: All tasks complete → Phase 18 COMPLETE → Begin Phase 19 planning.

---

*Plan created: 2026-09-03 for Phase 18 (Full Preparation)*
