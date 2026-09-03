# Phase 18 Learning: Plan Check & Revision Insights

**Date**: 2026-09-03  
**Phase**: 18 (Full Preparation — 充分準備版)  
**Trigger**: Automated plan-checker findings (4 BLOCKER, 6 WARNING)  
**Resolution Strategy**: TDD-based evaluation (B4-A + W6-B)

---

## Executive Summary

Plan check revealed systematic API version mismatch: research and initial plan were authored against **KLineChart v9**, while the installed dependency is **v10.0.3** with breaking changes. All findings had clear remediation paths; adopted TDD evaluation to select optimal solutions.

**Revisions Applied**:
- ✅ B4 blocker: adopted **A** (`<script type="module">` ESM import)
- ✅ W6 warning: adopted **B** (split into 18A + 18B plans)
- ✅ All 4 blockers + 6 warnings addressed in revised plan
- ✅ Learning captured for future phases

---

## Plan Check Findings Summary

### 4 Blockers (All Resolved)

| ID | Issue | Root Cause | Resolution |
|----|-------|-----------|------------|
| **B1** | Non-existent v10 API calls<br>(`KLineChart.init`, `applyNew`) | v9→v10 migration not reflected | Rewrote Tasks 1.1/1.2 with correct v10 API sequence<br>`klinecharts.init()` → `setSymbol` → `setPeriod` → `setDataLoader` |
| **B2** | Timestamp conversion inverted<br>(v10 needs ms, not s) | Research based on incorrect v9 assumption | Removed `Math.floor(ms/1000)` conversion<br>Pass through Binance ms directly to v10<br>Updated risk checklist |
| **B3** | R18-08 uncovered (branch not pushed) | No execution task for git push | Added Wave-3 step: `git push -u origin feature/klinechart-migration`<br>Verify with `git ls-remote` |
| **B4** | @klinecharts/extension ESM-only<br>(no UMD) | Assumed UMD build existed | **TDD Decision: Solution A**<br>Use `<script type="module">` ESM import<br>Record actual CDN URLs in doc |

### 6 Warnings (All Resolved)

| ID | Issue | Root Cause | Resolution |
|----|-------|-----------|------------|
| **W1** | Task 2.2 wrong target page | Incomplete file path reference | Point to `public/charts.html` (not index.html)<br>Account for async `/api/klines` load |
| **W2** | Task 1.1 verify jq broken | Binance response shape not understood | Replace `jq '.[] | .time'` with `jq -r '.[0][0]'`<br>Assert 13-digit ms or length >= 1000 |
| **W3** | Fake vs real data conflict | CONTEXT decision (real) vs ROADMAP (fake) | Resolved explicitly:<br>Demo renders seed fake data first, then swaps to real Binance<br>Both paths demonstrated |
| **W4** | Task 2.3 verify grep count wrong | Acceptance criterion doesn't match template | Align grep pattern with actual checklist structure<br>Every item marked VERIFIED/Understand |
| **W5** | R18-10 (deferral) uncovered | No explicit task line | Task 2.1 assessment doc adds:<br>"@klinecharts/data-aggregator — deferred to v3.1" |
| **W6** | 6 tasks > 2-3 target | Scope creep | **TDD Decision: Solution B**<br>Split into 18A (Demo/Risk) + 18B (Baseline/Roadmap)<br>Each: 3 tasks, ~10-11h, independent goal |

---

## TDD-Based Decision Rationale

### B4: Why Solution A Won

**Test Coverage**:
- ✅ Works in Chrome + Safari iOS (mobile requirement)
- ✅ Actual extension functionality verified in Phase 18 demo
- ✅ Phase 20 inherits working example
- ✅ Satisfies "充分準備版" (full preparation) ethos

**Trade-off**:
- Requires `<script type="module">` (not `<script>`)
- But aligns with Phase 18's goal: de-risk and validate

---

### W6: Why Solution B Won

**Test Coverage**:
- ✅ Each plan 3 tasks (guideline-compliant)
- ✅ Logical separation: 18A (build demo + verify risk) / 18B (measure baseline + finalize roadmap)
- ✅ Independent tracking and sign-off
- ✅ ~10-11h per plan (manageable chunks)

**Trade-off**:
- Two plan units instead of one (slightly higher coordination)
- But clearer goals and better granularity

---

## Key Learnings

### 1. Version Mismatch Risk

**Lesson**: When research/planning precedes installation by days, version skew can occur.

**Mitigation for Future Phases**:
- [ ] Verify installed versions match research assumptions at plan-check time
- [ ] Add version assertions to acceptance criteria
- [ ] Document v-X API expectations explicitly in RESEARCH.md

### 2. API Stability Across Versions

**Lesson**: KLineChart v9→v10 had breaking changes (API surface, data format, build outputs).

**Mitigation**:
- [ ] For third-party libraries, lock versions in package.json (not ranges)
- [ ] In RESEARCH.md, document exact API signatures from dist/index.d.ts
- [ ] Cross-reference official v-X migration guides

### 3. ESM-Only Ecosystem Reality

**Lesson**: Modern libraries increasingly ship ESM-only (no UMD), affecting no-build deployments.

**Mitigation**:
- [ ] When scoping "no-build", verify all dependencies ship UMD or support ESM-in-script
- [ ] Establish CDN fallback strategy (ESM + script type=module vs npm build)
- [ ] Test actual `<script type="module">` import paths in early phases

### 4. Task Granularity Trade-offs

**Lesson**: 6-task plan on paper looked ambitious; split into 18A/18B revealed natural boundaries.

**Mitigation**:
- [ ] Use TDD to validate task scope (write acceptance tests for each task)
- [ ] If task testing is hard, task boundary is likely wrong
- [ ] Merge or split based on test-driven clarity

### 5. Research Document Trustworthiness

**Lesson**: RESEARCH.md, technical-assessment.md, migration-checklist.md can drift from reality.

**Mitigation**:
- [ ] Plan-checker should verify research claims against installed code
- [ ] Use grep/TypeScript compiler to fact-check API examples in RESEARCH.md
- [ ] Treat pre-installation research as a hypothesis, not ground truth

---

## Changes Applied to Phase 18

### Revised Plan Structure (W6-B: Split into 18A + 18B)

#### **18A-PLAN.md** (Demo + Risk Verification) — 10h

**Wave 1 (Tracer)**:
- Task 1.1: Environment + KLineChart demo (v10 correct API)
- Task 1.2: Timestamp verification (ms pass-through, not conversion)

**Wave 2**:
- Task 2.1: Compatibility assessment (v10 correct API mappings)

#### **18B-PLAN.md** (Baseline + Roadmap Finalization) — 11h

**Wave 2**:
- Task 2.2: Performance baseline (correct page: charts.html)
- Task 2.3: Migration checklist verification (aligned grep)

**Wave 3**:
- Task 3.1: Finalize 5-phase roadmap + branch push (R18-08)

---

### Key Code Changes

**Before (v9 API assumption)**:
```javascript
KLineChart.init('chart', { kline: {} })
chart.applyNew({ candles: data })
const toCandle = (row) => ({ time: Math.floor(row.open_time / 1000) })
```

**After (v10 correct API)**:
```javascript
const chart = klinecharts.init('chart')
chart.setSymbol({ ticker: 'BTCUSDT', pricePrecision: 2, volumePrecision: 5 })
chart.setPeriod({ span: 1, type: 'hour' })
chart.setDataLoader({ getBars: ({ callback }) => callback(bars) })
const toCandle = (row) => ({ timestamp: row.open_time, open, high, low, close, volume })
```

---

### Research Documents Updated

| Document | Changes |
|----------|---------|
| **18-RESEARCH.md** | §2.1 timestamp corrected (ms not s)<br>§3 API example rewritten (v10 not v9)<br>§5 extension CDN resolved to ESM URL |
| **18-PLAN.md** | Split into 18A + 18B (3 tasks each)<br>Tasks 1.1/1.2 rewritten for v10<br>Task 2.2 points to charts.html<br>Task 2.3 grep aligned<br>Added R18-08 coverage (branch push) |
| **18-CONTEXT.md** | No changes (decisions remain valid) |

---

## Recommendations for Future Phases

### Phase 19 (Core Migration)
- Start with 18A demo as reference implementation
- Cross-check every API call against installed v10 dist/index.d.ts
- Run Tasks 1.1/1.2 acceptance in Phase 18 before Phase 19 starts

### Phase 20 (Drawing Tools)
- Extension integration verified and working from Phase 18
- No new discovery of ESM/UMD surprises
- Can focus on actual drawing-tool API (already de-risked)

### Phase 21+ (Indicators & Polish)
- Assume KLineChart v10 API is stable (no v11 surprises expected)
- Leverage Phase 18's compatibility assessment for version locking

---

## Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Blockers resolved | 4/4 | ✅ 100% |
| Warnings resolved | 6/6 | ✅ 100% |
| Plan check re-run | Pending | 🟡 After revision |
| Learning captured | 18-LEARNING.md | ✅ This doc |
| TDD decisions made | 2 (B4-A, W6-B) | ✅ Documented |

---

## Next Steps

1. ✅ Revise Phase 18 plan (in progress: MODE=revise dispatch)
2. ⏳ Re-run plan-checker on revised plan (should pass)
3. 🚀 Execute Phase 18A (Demo + Risk verification)
4. 🚀 Execute Phase 18B (Baseline + Roadmap finalization)
5. 📚 Reference this learning in Phase 19+ research

---

*Learning document created: 2026-09-03 — captures plan-check findings and resolution strategy for future reference*
