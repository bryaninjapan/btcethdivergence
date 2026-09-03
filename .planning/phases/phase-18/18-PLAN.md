---
wave: 1
depends_on: none
files_modified:
  - public/index.html
  - package.json
  - .planning/phases/phase-18/
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

**Goal**: Verify klinecharts import works; create minimal demo page that renders BTCUSDT K-lines.

<read_first>
- package.json (klinecharts@10.0.3 already listed)
- public/charts.html (current lightweight-charts usage — reference for structure)
- 18-RESEARCH.md § 5 (Environment validation checklist)
</read_first>

<action>
1. Create `public/demo-klinechart.html` (standalone demo page, not integrated yet)
   - Import KLineChart UMD: `<script src="https://unpkg.com/klinecharts@10.0.3/dist/umd/klinecharts.min.js">`
   - Import @klinecharts/extension CDN (check URL from RESEARCH.md)
   - Create container: `<div id="chart"></div>` (500px × 400px)
   - Initialize: `KLineChart.init('chart', { kline: {} })`
   - Fetch BTCUSDT 1h candles from Binance REST API
   - Transform data (ms → s): `time: Math.floor(open_time / 1000)`
   - Call `applyNew()` or `setData()` equivalent to render 1000+ candles

2. Verify:
   - Demo loads in Chrome without console errors
   - Demo loads in Safari iOS without errors
   - Chart renders visible K-lines (not empty)
   - Y-axis scale visible, timestamps on X-axis correct

3. Document:
   - Record the exact CDN URLs used (extension, base library versions)
   - List any version incompatibilities found
   - Note any workarounds applied (e.g., polyfills, timing issues)
</action>

<acceptance_criteria>
- [ ] `public/demo-klinechart.html` exists and opens in browser without 404
- [ ] Chrome DevTools console shows zero errors, zero warnings on page load
- [ ] Chart renders with K-line candles visible (y-axis 3000-4000, timestamps correct)
- [ ] Timestamp conversion confirmed: first candle's `time` value is Unix seconds (not ms)
- [ ] Safari iOS can load and render the same page (test via remote debugging or iOS simulator)
- [ ] Binance API call succeeds (verified in Network tab: 200 OK, ~1000+ candles returned)
</acceptance_criteria>

<verify>
<automated>curl -s "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000" | jq '.[] | .time' | head -1</automated>
<fails_when>empty output, or exit code non-zero, or returned time value < 1000000000000 (invalid timestamp)</fails_when>
</verify>

---

### Task 1.2: Timestamp Conversion Verification (Critical Risk #1)

**Goal**: Prove that `Math.floor(open_time / 1000)` conversion is correct; KLineChart interprets seconds correctly.

<read_first>
- 18-RESEARCH.md § 2.1 (Timestamp Format — CRITICAL risk)
- public/demo-klinechart.html (after Task 1.1 creates it)
</read_first>

<action>
1. Add inline test to demo page:
   ```javascript
   const rawData = [
     { time: 1693526400000, open: 3600, high: 3700, low: 3600, close: 3650, volume: 100 },
     { time: 1693530000000, open: 3650, high: 3750, low: 3640, close: 3700, volume: 105 }
   ]
   const convertedData = rawData.map(d => ({
     ...d,
     time: Math.floor(d.time / 1000)  // Should be 1693526400, 1693530000 (seconds)
   }))
   console.log('Original:', rawData[0].time)
   console.log('Converted:', convertedData[0].time)
   console.assert(convertedData[0].time === 1693526400, 'Conversion failed')
   ```

2. Verify:
   - Conversion output is exactly 10 digits (not 13)
   - Chart renders without "Invalid time" errors
   - Timeline X-axis label shows correct date (Aug 31, 2023 8:00 AM)

3. Record:
   - Conversion formula: `Math.floor(open_time / 1000)`
   - Test case: 1693526400000 ms → 1693526400 s ✓
   - Verdict: Timestamp conversion VERIFIED SAFE
</action>

<acceptance_criteria>
- [ ] Console assertion passes: converted time is 10-digit Unix seconds
- [ ] Chart X-axis timeline label matches expected date (2023-08-31 08:00, or equivalent)
- [ ] No "Invalid date" or "Invalid timestamp" errors in console
- [ ] Visual inspection: K-lines appear in correct chronological order
</acceptance_criteria>

<verify>
<automated>node -e "console.assert(Math.floor(1693526400000 / 1000) === 1693526400, 'Timestamp conversion failed')"</automated>
<fails_when>AssertionError thrown (exit code non-zero)</fails_when>
</verify>

---

## Expansion Tasks (Waves 2-3)

### Task 2.1: Three-Repo Compatibility Assessment (Deep Level)

**Goal**: Document API differences, version matrix, CDN vs npm trade-offs.

<read_first>
- 18-RESEARCH.md § 1, § 2 (three-repo analysis + API differences)
- 18-CONTEXT.md § Decisions (deep evaluation decision captured)
- .planning/technical-assessment.md (detailed API mapping)
</read_first>

<action>
Create document: `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md`

Sections:
1. **Version Matrix**
   - klinecharts@10.0.3: released date, license, maintenance status
   - @klinecharts/extension@latest: version, dependencies, compatibility with base
   - @klinecharts/pro@0.1.1: reference status (not for production)
   - Binance API: v3 endpoint, rate limits, backfill limits

2. **API Mapping Reference** (Function-by-function correspondence)
   - lightweight-charts → KLineChart
   - Example: `chart.createSeries()` → `KLineChart.init()`
   - Example: `series.setData()` → `chart.applyNew()`
   - Example: `onVisibleLogicalRangeChange()` → `subscribeAction('onVisibleRangeChange')`

3. **CDN vs npm Trade-offs**
   - CDN: Pros (zero build setup, cache), Cons (size, no tree-shake)
   - npm: Pros (bundling, tree-shake), Cons (build step, version management)
   - Recommendation: **CDN for demo + Phase 19-21 (keep no-build constraint), npm only if build is needed**

4. **Known Limitations**
   - Built-in indicators: NOT in KLineChart (unlike lightweight-charts indicators plugin)
   - Cross-browser: All major browsers supported (Chrome, Firefox, Safari, Edge)
   - Mobile: Touch events supported, gesture API compatible

5. **Risk Verification Checklist**
   - [ ] Timestamp ms→s: VERIFIED in Task 1.2 ✓
   - [ ] Event API: subscribeAction documented & ready for Phase 19
   - [ ] Style config: New syntax reference created (sample in RESEARCH.md)
</action>

<acceptance_criteria>
- [ ] `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md` created
- [ ] Version matrix includes all three repos + Binance API
- [ ] API mapping covers 10+ key functions (init, setData, applyNew, subscribeAction, etc.)
- [ ] CDN vs npm recommendation documented with trade-off analysis
- [ ] Risk verification checklist shows Timestamp VERIFIED, others documented
</acceptance_criteria>

<verify>
<automated>test -f .planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md && grep -c "klinecharts@10.0.3" .planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md</automated>
<fails_when>file missing, or no mention of klinecharts version (exit code non-zero)</fails_when>
</verify>

---

### Task 2.2: Performance Baseline — lightweight-charts Measurement

**Goal**: Measure and record lightweight-charts performance (init time, memory, bundle) as reference for KLineChart comparison.

<read_first>
- 18-RESEARCH.md § 4 (Performance Benchmark Plan — 5 tests)
- 18-CONTEXT.md § Decisions (measurement on Chrome + Safari iOS)
- public/charts.html (current implementation using lightweight-charts)
</read_first>

<action>
1. **Initialization Time** (Chrome DevTools)
   - Open `public/index.html` (with current lightweight-charts)
   - Chrome DevTools → Performance tab → Record
   - Measure time from page load to "charts rendered" (both BTC + ETH charts)
   - Record: lightweight-charts init time (ms)
   - Repeat 3 times, average

2. **Memory Usage** (Chrome DevTools)
   - Chrome DevTools → Memory tab → Take heap snapshot
   - Before: fresh load, before chart render
   - After: charts loaded + 1000+ candles rendered
   - Record: delta memory usage (MB)

3. **Bundle Size**
   - Check network tab: lightweight-charts UMD/ESM file size
   - Record: gzip size shown in Network tab

4. **Mobile (Safari iOS)**
   - Open `public/index.html` on iPhone/iPad with Safari Web Inspector
   - Use same timing methodology (performance.now() if possible, or Web Inspector timeline)
   - Record: init time + scroll FPS on mobile

5. **Create Baseline Table** (in new file or append to RESEARCH.md)
   ```markdown
   ## Performance Baseline (lightweight-charts — Reference)
   
   | Environment | Metric | Value | Unit |
   |-------------|--------|-------|------|
   | Chrome | Init time (1000 candles) | 180ms | ms |
   | Chrome | Memory delta | 11MB | MB |
   | Chrome | Bundle (gzip) | 50KB | KB |
   | Chrome | Scroll FPS | 58 | fps |
   | Safari iOS | Init time | 250ms | ms |
   | Safari iOS | Memory delta | 8MB | MB |
   | Safari iOS | Scroll FPS | 50 | fps |
   ```

6. **Record in file**: `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md`
</action>

<acceptance_criteria>
- [ ] `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md` created
- [ ] Chrome measurements: init time, memory, bundle size, FPS all recorded
- [ ] Safari iOS measurements: init time, memory, FPS all recorded
- [ ] Values are numeric (not estimates like "fast" or "good")
- [ ] Source noted for each measurement (Chrome DevTools, Safari Web Inspector, etc.)
</acceptance_criteria>

<verify>
<automated>test -f .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md && grep -E "^\\| Chrome" .planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md | wc -l</automated>
<fails_when>file missing, or fewer than 3 Chrome measurements (exit code non-zero)</fails_when>
</verify>

---

### Task 2.3: Migration Checklist Verification

**Goal**: Line-by-line verify understanding of migration checklist items; identify any gaps or clarifications needed before Phase 19.

<read_first>
- .planning/migration-checklist.md (week-by-week migration plan with examples)
- 18-CONTEXT.md § Decisions (deep evaluation chosen)
- 18-RESEARCH.md § 3 (migration path reference)
</read_first>

<action>
Create checklist document: `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md`

For each section in `.planning/migration-checklist.md`, verify understanding:

**Week 1: Core Swap** ✓ Understand
- [ ] Understand: `createChart()` → `init()`
- [ ] Understand: `createSeries()` → built-in series in KLineChart
- [ ] Understand: Import path changes (lightweight-charts → klinecharts)
- [ ] Clarification needed: (list any 'Y' items from migration checklist)

**Week 2: Event System** ✓ Understand
- [ ] Understand: Callback-style → subscriber pattern
- [ ] Understand: `onVisibleLogicalRangeChange()` → `subscribeAction()`
- [ ] Understand: Multiple event types in KLineChart (ready to implement)
- [ ] Clarification needed: (list any open questions)

**Week 3: Styling** ✓ Understand
- [ ] Understand: Flat object → nested object structure
- [ ] Understand: Key name changes (timeScale.timeVisible → grid.horizontal.visible, etc.)
- [ ] Understand: Color format compatibility (verify hex/rgb handling)
- [ ] Clarification needed: (list any gaps)

**Critical Data Transform** ✓ VERIFIED
- [ ] `Math.floor(open_time / 1000)` tested and working ✓
- [ ] Binance API → KLineChart format transformation understood
- [ ] Ready for Phase 19

Mark all items **✓** or list clarifications. If any item is unclear, escalate to discussion.
</action>

<acceptance_criteria>
- [ ] `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md` created
- [ ] All Week 1-3 sections reviewed and marked ✓ (understood) or listed (clarification)
- [ ] No "unclear" items without explanation or resolution
- [ ] Critical data transform VERIFIED (timestamp tested)
</acceptance_criteria>

<verify>
<automated>test -f .planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md && grep -c "VERIFIED" .planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md</automated>
<fails_when>file missing, or fewer than 3 VERIFIED items (exit code non-zero)</fails_when>
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
</action>

<acceptance_criteria>
- [ ] .planning/ROADMAP.md shows all 5 phases (18-22) with goals + deliverables + reqs
- [ ] Phase 18 marked as IN PROGRESS (or COMPLETE if this task finishes phase)
- [ ] All 45 requirements (R18-01 to R22-07) accounted for across 5 phases
- [ ] Total workload 82-101 hours confirmed
- [ ] No phase is missing success criteria
</acceptance_criteria>

<verify>
<automated>grep -c "^#### Phase" .planning/ROADMAP.md</automated>
<fails_when>fewer than 5 phases listed (exit code non-zero)</fails_when>
</verify>

---

## Artifacts This Phase Produces

- `public/demo-klinechart.html` — Standalone demo page rendering BTCUSDT K-lines
- `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md` — API mapping + version matrix
- `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md` — Performance baseline (reference)
- `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md` — Line-by-line checklist verification
- `.planning/ROADMAP.md` (updated) — Phase 18-22 finalized

---

## Must Haves

1. **Timestamp conversion (Math.floor) VERIFIED SAFE** — Demo renders with correct timeline
2. **Binance API connectivity confirmed** — 1000+ K-lines fetch successful
3. **KLineChart import works in browser** — No module resolution errors
4. **Performance baseline recorded** — lightweight-charts metrics for comparison (Phase 19 will measure KLineChart)
5. **Three-repo compatibility understood** — API differences documented, CDN/npm trade-offs assessed
6. **Migration checklist verified** — All items understood or escalated

---

## Verification

**Wave 1 (Tracer)**: Tasks 1.1, 1.2 must pass before moving to Wave 2.

**Wave 2-3**: Tasks 2.1-3.1 expand scope (compatibility, baseline, roadmap finalization).

**Success**: All tasks complete → Phase 18 COMPLETE → Begin Phase 19 planning.

---

*Plan created: 2026-09-03 for Phase 18 (Full Preparation)*
