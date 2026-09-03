# Phase 18B Learning: Baseline + Roadmap Finalization
## Plan-Check Iteration Summary (1-4)

**Date**: 2026-09-04  
**Phase**: 18B (Full Preparation — Baseline + Roadmap)  
**Scope**: Tasks 2.1B, 2.1C, 3.1 (performance baseline, migration checklist verification, 5-phase roadmap finalization + push)  
**Sessions**: 4 plan-check iterations → 0 blockers (final)

---

## Plan-Check Iteration Timeline

### Iteration 1: Initial Discovery (2026-09-03 15:41)
**Status**: 4 BLOCKERS, 6 WARNINGS, 4 INFO

**Key Findings for Phase 18B Tasks**:

From the full Phase 18 blockers:

1. **B2 - Timestamp conversion** (affects Task 2.1 baseline measurement)
   - Issue: Performance comparison vs. KLineChart must use correct timestamp format
   - Root cause: Baseline recorded ms, but plan assumed conversion to seconds
   - Finding: No conversion needed; both libraries use ms
   - Impact on 18B: Baseline measurement acceptance criteria must verify actual numbers, not template placeholders

2. **B3 - Branch not pushed (R18-08)**
   - Issue: Task 3.1 missing commit step
   - Root cause: Phase produces 3 new docs + ROADMAP edits; need explicit `git add + git commit` before push
   - Impact on 18B: R18-08 (branch push) is a Task 3.1 responsibility; must commit deliverables first

3. **B4 - Extension ESM-only** (deferred to Phase 20 but documented in 18B)
   - Issue: @klinecharts/extension cannot be used in Phase 18 demo with plain `<script src>`
   - Impact on 18B: Migration checklist (Task 2.1C) must flag this as "ESM-only, deferred to Phase 20"

**Iteration 1 Resolution**: MODE=revise automatically applied blocker fixes.

---

### Iteration 2: Refinement (2026-09-03 15:51)
**Status**: 0 BLOCKERS, 3 WARNINGS, 4 INFO

**Warnings Specific to Phase 18B Tasks**:

- **W1 (Task 1.2) - Fake data date** (not 18B but affects acceptance criteria clarity)
  - Finding: Task 1.2's expected label wrong; checker corrected to 2026-09-01
  - Lesson for 18B: Acceptance criteria must be precise; checker found even manual test assumptions were wrong

- **W2 (Task 2.1B) - Baseline verify vacuous**
  - Issue: Template has placeholder values (180ms / 11MB / 50KB / 58fps / 250ms / 8MB / 50fps)
  - Finding: Automated gate passes even if executor never replaces placeholders with real measurements
  - Impact: R18-06 ("性能基準數字已記錄到文件") could be marked complete with fake data
  - Fix: Strengthen verify to reject template values and require Source column

- **W3 (Task 2.1C + Task 3.1) - 6 tasks > 2-3 target**
  - Issue: Task 2.2 (migration checklist) + Task 2.1C (separated from Part A) = scope creep
  - Finding: User selected W6-B solution (split 18A demo vs. 18B assessment/roadmap) but not yet implemented
  - Lesson for 18B: Task 2.1 has 3 parts (A: compatibility, B: baseline, C: checklist); could be one merged task or three separate tasks

**Iteration 2 Key Learning for 18B**:
- Baseline measurement is not just about numbers; must verify real data, not templates
- Roadmap finalization (Task 3.1) is load-bearing for R18-07 + R18-08; cannot be skipped

---

### Iteration 3: Polish (2026-09-03 16:09)
**Status**: 0 BLOCKERS, 3 WARNINGS, 6 INFO

**Phase 18B Specific Improvements**:

After inline fixes:

- **W2 Fix**: Task 2.1B verify now rejects placeholder values
  - Added explicit check: no `180ms|11MB|50KB|58fps|250ms|8MB|50fps` in baseline table
  - Requires `Source` column with DevTools or Web Inspector notation
  - Ensures baseline is measured, not template-filled

- **W3 Fix (18B part)**: Task 2.1C verify thresholded to >= 4 marked items
  - Migration checklist must mark all 3 weeks + critical data transform as understood
  - Automated gate now enforces: `[ "$(grep -cE '✓ (Understand|VERIFIED)') -ge 4 ]`

- **New Info Finding (I6)**: Task 2.1B implicitly requires `wrangler dev` running
  - public/charts.html makes HTTP request to `/api/klines` (Worker endpoint)
  - Cannot measure without dev server + D1 seeded
  - Lesson: Task prerequisites (external services) must be documented

**Iteration 3 Key Learning**:
- Execution prerequisites matter: can't run Phase 18B Task 2.1B without working backend
- Checklist completion is verifiable (>= 4 items marked); baseline numbers must be real (not templates)

---

### Iteration 4: Final Hardening (2026-09-04 06:06)
**Status**: 0 BLOCKERS, 1 WARNING, 7 INFO

**Phase 18B Specific Improvements**:

1. **I4 - API Mapping Expansion** (for Task 2.1A compat assessment)
   - Expanded from 6 to 10+ functions
   - Added Event System, Navigation, Symbol/Period configuration
   - Ensures Task 2.1A compatibility assessment is comprehensive enough to guide Phase 19

2. **I6 - Wrangler Prerequisite** ✅
   - Explicit note added to Task 2.1B: "ensure `wrangler dev` is running and D1 has kline data"
   - Prevents silent failure during baseline measurement
   - Example: If `/api/klines` times out, baseline table will be empty; gate should catch this

3. **I7 - Enhanced Task 3.1 Verification** ✅
   - Task 3.1 automated verify now checks:
     - 5 phase headings present (Phases 18-22) ← ensures ROADMAP structure
     - Phase 18 status marked IN PROGRESS/🚧 ← proves phase update applied
     - 45+ requirements accounted ← ensures R18-01 to R22-07 coverage
     - Remote branch matches local HEAD ← ensures push succeeded
   - Manual verification: ROADMAP contains goals, deliverables, criteria for each phase

4. **I7 - Roadmap Success Criteria** ✅
   - Added explicit Success Criteria sections to Phases 19-22 (previously missing)
   - Phase 19: KLineChart migration success criteria (API mapping, event system, data transformation)
   - Phase 20: Drawing tools integration criteria (extension loads, toolbar renders, drawing tools work)
   - Phase 21: Indicators criteria (menu renders, indicators add/remove, colors/periods configurable)
   - Phase 22: Production criteria (performance meets target, responsive layout, E2E tests pass)

**Iteration 4 Final Status for 18B**: Ready to execute.

---

## Key Learnings for Phase 18B Execution

### 1. Baseline Measurement Requires Live Environment
**Why**: `public/charts.html` depends on `/api/klines` endpoint (Worker backend).
**Mitigation**: 
- Document external service requirements upfront
- Verify dev environment is running before starting measurement
- Auto-gate should test endpoint availability (not just chart load)

### 2. Template Placeholders Can Hide Incomplete Work
**Why**: W2 warning revealed that baseline table could be published with fake numbers (180ms / 11MB / 50KB etc.).
**Mitigation**:
- Automated verify rejects known placeholder values
- Require `Source` column (DevTools / Web Inspector) → forces real measurement
- Unit tests on acceptance criteria prevent template slip-through

### 3. Checklist Completion Needs Verification
**Why**: Task 2.1C migration checklist must be > 4 items marked ✓ before moving to Phase 19.
**Mitigation**:
- Thresholded automated gate (`>= 4`)
- Acceptance criteria lists all items explicitly (3 weeks + critical data transform)
- If executor skips items, gate fails immediately

### 4. Roadmap Finalization Is Not Optional
**Why**: Task 3.1 gates Phase 19+ planning; R18-07 (5-phase confirmed) + R18-08 (branch pushed) are hard dependencies.
**Mitigation**:
- Explicit commit step before push (lesson from B3 blocker)
- Verify checks phase status + requirement count + branch state
- Cannot proceed to Phase 19 without 18B complete

### 5. Risk Documentation Must Be Comprehensive
**Why**: Phase 18B's compatibility assessment (Task 2.1A) lists 10+ functions to prepare Phase 19 migration.
**Mitigation**:
- Document exact API signatures from `dist/index.d.ts` (not assumptions)
- List known limitations (e.g., extension ESM-only, deferred to Phase 20)
- Provide code examples for each mapping (lightweight-charts → KLineChart)

### 6. Success Criteria for Future Phases Must Be Explicit
**Why**: I7 improvement revealed Phases 19-22 lacked Success Criteria sections.
**Mitigation**:
- ROADMAP now defines measurable criteria for each phase
- Criteria derived from deliverables + requirements (not vague goals)
- Phase 19-22 success is checkable against ROADMAP before Phase 19 starts

---

## Task Breakdown for Phase 18B

### Task 2.1A: Compatibility Assessment
**Deliverables**: `.planning/phases/phase-18/18-COMPATIBILITY-ASSESSMENT.md`
- Version matrix (klinecharts@10.0.3, extension@0.1.0, pro@0.1.1, Binance v3)
- API mapping (10+ functions re-verified against installed types)
- CDN vs npm trade-offs
- Known limitations (extension ESM-only, data-aggregator deferred)
- Risk checklist rewritten for v10 (no ms→s risk, loader API, ESM-only extension)

**Acceptance Criteria (from I4 expansion)**:
- [ ] Version matrix complete for all three repos
- [ ] API mapping covers 10+ key functions (Event System, Chart Navigation added)
- [ ] Every mapping re-verified against v10.0.3 `dist/index.d.ts`
- [ ] Known limitations documented (extension ESM-only, data-aggregator deferred to v3.1)
- [ ] Risk matrix updated (ms→s removed; loader API + timestamp contract + ESM-only listed)

### Task 2.1B: Performance Baseline
**Prerequisites** (from I6): `wrangler dev` running + D1 seeded
**Deliverables**: `.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md`
- Chrome init time, memory, bundle size
- Safari iOS metrics
- All rows must have Source column (DevTools / Web Inspector)
- No template placeholder values (180ms / 11MB / 250ms / 50fps / etc.)

**Acceptance Criteria (from W2 + I6 fixes)**:
- [ ] Chrome measurements: init time, memory delta, bundle size (no placeholders)
- [ ] Safari iOS measurements: init time, memory, FPS (minimum 3 rows)
- [ ] Source column present for every row (DevTools version noted)
- [ ] All placeholder values replaced with real numbers
- [ ] Total table rows: >= 7 (4 Chrome + 3 Safari iOS)

### Task 2.1C: Migration Checklist Verification
**Deliverables**: `.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md`
- Week 1-3 sections reviewed and marked ✓ Understand
- Critical data transform VERIFIED
- All clarifications resolved or escalated

**Acceptance Criteria (from W3 + I7 fixes)**:
- [ ] All 3 week sections marked ✓ (or clarifications listed)
- [ ] Critical data transform marked ✓ VERIFIED
- [ ] Total marked items >= 4
- [ ] No "unclear" items without resolution
- [ ] Flag wrong ms→s guidance in source migration-checklist.md

### Task 3.1: Finalize 5-Phase Roadmap + Push
**Deliverables**: Updated ROADMAP.md + `feature/klinechart-migration` pushed to origin
- Phases 18-22 all have goals, deliverables, Success Criteria
- Phase 18 marked IN PROGRESS or COMPLETE
- All 45 requirements (R18-01 to R22-07) accounted for
- Branch pushed with commit containing all Phase 18 artifacts

**Acceptance Criteria (from W-1 + I7 fixes)**:
- [ ] ROADMAP.md shows all 5 phases with goals + deliverables + reqs
- [ ] **NEW**: Every phase (19-22) has explicit Success Criteria section (I7 improvement)
- [ ] Phase 18 marked 🚧 IN PROGRESS
- [ ] All 45 requirements mapped across 5 phases
- [ ] **NEW**: Automated verify checks phase status + requirement count (I7 enhancement)
- [ ] `feature/klinechart-migration` pushed to origin (verified via `git ls-remote`)
- [ ] **NEW**: Commit includes demo-klinechart.html + 18-COMPATIBILITY-ASSESSMENT.md + 18-BASELINE-LIGHTWEIGHT.md + 18-MIGRATION-CHECKLIST-VERIFIED.md + ROADMAP.md (W-1 fix)

---

## Commits in This Session

1. **333596b** - docs(18): add learning document (before revisions)
2. **2753ffc** - fix(18): resolve W1-W3 plan-check warnings
3. **71f3c5c** - fix(18): add explicit commit step to Task 3.1 before push
4. **82cea63** - refactor(18): apply all plan-check info improvements (I1-I7)

---

## Phase 18B Success Checklist

Phase 18B (Baseline + Roadmap Finalization) ready when:
- [ ] Baseline numbers recorded (Chrome + Safari iOS, all real measurements) ✅ (gate fixed in I6)
- [ ] Migration checklist verified (4+ items marked ✓) ✅ (gate fixed in W3)
- [ ] Compatibility assessment complete (10+ API mappings) ✅ (expanded in I4)
- [ ] 5-phase roadmap finalized (Phases 19-22 with Success Criteria) ✅ (added in I7)
- [ ] Branch committed + pushed to origin ✅ (commit step added in W-1)
- [ ] No blockers remain (0/0) ✅

---

*Learning document created: 2026-09-04 (Session 2) — captures all 4 plan-check iterations for Phase 18B execution*
