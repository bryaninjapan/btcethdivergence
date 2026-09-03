# Phase 18A Learning: Demo + Risk Verification
## Plan-Check Iteration Summary (1-4)

**Date**: 2026-09-04  
**Phase**: 18A (Full Preparation — Demo + Risk)  
**Scope**: Tasks 1.1, 1.2, 2.1A (environment validation, timestamp verification, compatibility assessment)  
**Sessions**: 4 plan-check iterations → 0 blockers (final)

---

## Plan-Check Iteration Timeline

### Iteration 1: Initial Discovery (2026-09-03 15:41)
**Status**: 4 BLOCKERS, 6 WARNINGS, 4 INFO

**Critical Blockers Identified**:

1. **B1 - Non-existent v10 API calls** 
   - Issue: Tasks referenced `KLineChart.init()`, `applyNew()` which don't exist in v10
   - Root cause: Plan authored against v9 mental model; actual package is v10.0.3
   - Finding: `dist/index.d.ts` revealed correct v10 surface: `klinecharts.init`, `setSymbol`, `setPeriod`, `setDataLoader`
   - Lesson: Research/planning can drift from reality if done days before implementation. Must verify against installed package at plan-check time.

2. **B2 - Timestamp conversion inverted**
   - Issue: Plan said "KLineChart v10 requires seconds, convert with Math.floor(ms/1000)"
   - Root cause: Assumed v9 API (seconds); v10 actually requires milliseconds same as lightweight-charts
   - Finding: `KLineData.timestamp: number` in types is milliseconds. Binance `open_time` already ms → pass-through, no conversion
   - Lesson: Timestamp contracts are load-bearing. Must verify exact field names AND units against type definitions, not documentation.

3. **B3 - Branch not pushed (R18-08)**
   - Issue: Task 3.1 step 5 said only `git push`, no preceding commit
   - Root cause: Plan didn't include creating + committing Phase 18 deliverables
   - Finding: Phase produces 3 new docs + ROADMAP edits; all uncommitted pre-push
   - Lesson: Plan-checker catches downstream blockers (what good is a plan if its outputs never reach version control?).

4. **B4 - @klinecharts/extension ESM-only**
   - Issue: Plan assumed UMD build available for `<script src>` import
   - Root cause: npm metadata check missed: `"type": "module"` means ESM-only, no UMD/IIFE
   - Finding: Must use `<script type="module">` or npm for extension loading
   - Lesson: Check npm package metadata upfront (`package.json` `"type"`, `exports`, `main`). Don't assume UMD exists.

**Iteration 1 Resolution**: Automated MODE=revise applied all blocker fixes.

---

### Iteration 2: Refinement (2026-09-03 15:51)
**Status**: 0 BLOCKERS, 3 WARNINGS, 4 INFO

**Warnings Reduced from 6→3**:

- **W1 (new) - Task 1.2 fake date wrong**: Expected "Aug 31, 2023 08:00" but timestamp 1693526400000 = 2026-09-01T00:00:00Z
  - Finding: JavaScript date calculation confirmed; executor will be confused by mismatch
  - Fix: Corrected expected date in Task 1.2 acceptance to 2026-09-01

- **W2 (new) - Baseline verify gate vacuous**: Placeholder values in template satisfy verification without real measurement
  - Finding: Automated verify counts `^| Chrome` rows (template has 4); gate passes with fake data
  - Fix: Strengthen verify to reject template placeholder values, require `Source` column

- **W3 (new) - 6 tasks exceed 2-3 target**: Single plan has 6 tasks after initial revision
  - Finding: W6-B proposed solution (split into 18A + 18B); this was a structural issue, not API issue
  - Option A: Consolidate tasks; Option B: Split into two plans
  - Lesson: Task granularity affects plan cohesion. TDD-style acceptance testing helps validate task boundaries.

**Iteration 2 Key Learning**: 
- All 4 iteration-1 blockers resolved ✓
- Warnings are not blockers but reveal execution risks
- User selected W6-B (split) as preferred structure (but not yet implemented in code)

---

### Iteration 3: Polish (2026-09-03 16:09)
**Status**: 0 BLOCKERS, 3 WARNINGS, 6 INFO

**Same 3 Warnings + 3 Info Items**:

After manual inline fixes (W1-W3 addressed):
- W1 ✅ Success Criteria added to ROADMAP Phases 19-22
- W2 ✅ Task 1.1 verify hardened (pipefail + curl -sf + length check)
- W3 ✅ Task 2.1 Part C verify thresholded to >= 4

**Info Items (Optional Improvements)**:
- I1: ESM import not tested (only CDN UMD) — optional `<script type="module">` check
- I2: Task 1.2 automated verify is tautology (hardcoded assert) — should point at actual data
- I3: Demo render verification manual-only — could use Playwright
- I4: Task 2.1 Part A acceptance says 10+ functions, lists 6 — missing guidance
- I5: 4 tasks exceed 2-3 target (not blocker, but sub-optimal)
- I6: Task 2.1 Part B implicitly needs `wrangler dev` running — not documented

**Iteration 3 Key Learning**:
- TDD-based selection of solutions worked: B4-A (ESM module) and W6-B (split plans) were validated before reverting to current unified plan
- Info items are execution guidance, not blockers
- Checker reached iteration limit (max_iterations: 3) but didn't block completion

---

### Iteration 4: Final Hardening (2026-09-04 06:06)
**Status**: 0 BLOCKERS, 1 WARNING, 7 INFO

**Applied All Info Improvements**:

1. **I1 - ESM import check** ✅
   - Added optional `<script type="module">` block to Task 1.1
   - Complements CDN UMD verify under no-build constraint

2. **I2 - Realistic verify** ✅
   - Replaced hardcoded `console.assert` with manual checks pointing at actual demo data
   - Automated gate tests Binance API + extension CDN; manual gate validates in-page behavior

3. **I3 - Playwright smoke check** ✅
   - Added optional hardening: headless test for canvas rendering + zero console errors
   - Uses @playwright/test already installed; flagged as optional (not required)

4. **I4 - API mapping expansion** ✅
   - Expanded Task 2.1 Part A from 6 functions to 10+
   - Added Event System mappings, Chart Navigation methods, Symbol/Period configuration
   - Candidates: `subscribeAction`, `unsubscribeAction`, `scrollToTimestamp`, `resetData`, `setSymbol`, `setPeriod`

5. **I5 - Task scope acceptance** ✅
   - Documented that 4 tasks are acceptable as-is (cohesive + wave-gated)
   - Below 5+ blocker threshold; split to 18A+18B remains optional

6. **I6 - Wrangler prerequisite** ✅
   - Added explicit note: "ensure `wrangler dev` is running and D1 is seeded before baseline measurement"
   - Public/charts.html requires `/api/klines` endpoint (Worker → D1)

7. **I7 - Enhanced verification** ✅
   - Task 3.1 automated verify now checks:
     - 5 phase headings (Phases 18-22)
     - Phase 18 status marked IN PROGRESS/🚧
     - 45+ requirements accounted
     - Remote branch matches local HEAD

**Iteration 4 Final Status**: Ready to execute.

---

## Key Learnings for Phase 18A Execution

### 1. Version Mismatch Is High-Risk
**Why**: v9/v10 API break spans initialization, data loading, events, styling, and types.
**Mitigation**: 
- Verify installed package version before writing acceptance criteria
- Cross-reference every API call against `node_modules/*/dist/index.d.ts`
- Document exact type signatures (not assumptions from docs)

### 2. Timestamp Contracts Are Critical
**Why**: Binance sends ms; lightweight-charts expects ms; v10 expects ms. But v9 expected seconds (per old docs).
**Mitigation**:
- Use TDD to test actual data transformation (Task 1.2 fake-then-real swap validates both paths)
- Assert field name (`timestamp` not `time`) + unit (ms not s) explicitly
- Test with real Binance data; don't assume documentation matches implementation

### 3. ESM-Only Ecosystem Is Real
**Why**: @klinecharts/extension ships only ESM, no UMD. Breaks "no-build" constraint with plain `<script src>`.
**Mitigation**:
- Check `package.json` `"type": "module"` early
- Know CDN can deliver ESM via `<script type="module">`
- Document which libraries require build step vs. CDN ESM compatibility

### 4. Verify Gates Must Be Specificity
**Why**: Automated verify passing on template placeholders (W2) or tautologies (I2) gives false confidence.
**Mitigation**:
- Never assert hardcoded constants; point at data produced by the actual task
- Verify rejects fake/template values explicitly
- Pair automated gates with manual visual confirmation for rendering tasks

### 5. Task Completeness Requires Commit Steps
**Why**: Git push without commit (B3/W-1) silently fails to preserve work.
**Mitigation**:
- Explicit `git add + git commit` before `git push` in plan steps
- Verify includes branch content check, not just existence
- Document commit message to reference phase/requirements

### 6. Plan-Checker Catches Downstream Risks
**Why**: Blockers surface when checker works backwards from success criteria (goal-backward verification).
**Mitigation**:
- Success criteria must be achievable without additional context
- Dependencies between tasks must be explicit (Wave-1 gates Wave 2-3)
- Acceptance criteria must be verifiable (manual or automated, but not vacuous)

---

## Commits in This Session

1. **333596b** - docs(18): add learning document (before revisions)
2. **2753ffc** - fix(18): resolve W1-W3 plan-check warnings (Success Criteria + verify hardening + count threshold)
3. **71f3c5c** - fix(18): add explicit commit step to Task 3.1 before push
4. **82cea63** - refactor(18): apply all plan-check info improvements (I1-I7)

---

## Phase 18A Success Checklist

Phase 18A (Demo + Risk Verification) ready when:
- [ ] demo-klinechart.html loads both fake + real Binance data correctly
- [ ] Timestamp ms pass-through verified (no 1970-date bug)
- [ ] Extension ESM URL confirmed reachable (200 OK)
- [ ] Compatibility assessment doc created (10+ API mappings)
- [ ] No blockers remain (0/0) ✅
- [ ] All known risks identified and documented ✅

---

*Learning document created: 2026-09-04 (Session 2) — captures all 4 plan-check iterations for Phase 18A execution*
