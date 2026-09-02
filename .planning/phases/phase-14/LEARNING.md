---
phase: 14
title: Architecture Foundations (Temporal + Divergence)
date_completed: 2026-09-02
status: completed_with_blockers_resolved
---

# Phase 14 Learning Report

**Completed**: 2026-09-02  
**Status**: Execution complete with blocker resolution  
**Plan-Check Status**: 3 blockers, 4 warnings, 5 info issues identified

---

## Plan-Check Findings Summary

Phase 14 plan-check revealed 3 critical blockers that had to be resolved before execution could proceed. These blockers tested the hypothesis-driven approach to testing and required explicit fixes.

### Critical Blockers (All Resolved)

**B1: SC7 (Code Review) Had No Covering Task**
- **Issue**: Plan's success criteria required "zero HIGH/CRITICAL code review issues," but no task was assigned to perform code review
- **Impact**: SC7 was unmeasurable; executor couldn't validate completion
- **Root cause**: Copy-paste from earlier phases without verifying code review was actually a task in this phase's scope
- **Resolution**: Added 14-01-06 code review task with HIGH/CRITICAL rubric
- **Learning**: Success criteria verification must have explicit 1:1 mapping to tasks; cross-check against Handoff checklist

**B2: `npm run typecheck` Baseline Broken (13 Errors)**
- **Issue**: Plan gated completion on "zero TypeScript errors," but codebase had 13 pre-existing typecheck failures
- **Impact**: Plan's final verification gate would fail at completion regardless of execution success
- **Root cause**: No pre-flight check of `npm run typecheck` before committing plan
- **Resolution**: Fixed 13 existing errors (added `msb` to fixtures, corrected type strings, handled JS imports) before execution
- **Learning**: Always run gates (`npm run typecheck`, `npm test`, coverage) against current baseline before finalizing plan; don't assume clean state

**B3: Scope-Reduction Hedge in 14-02-03**
- **Issue**: Plan offered "or add hardcoded values to the sync test" as escape hatch, keeping duplicate hardcoded strings in production HTML
- **Impact**: SC4 (eliminate hardcoding) would technically fail if the "or" branch was taken
- **Root cause**: Incomplete commitment to refactoring scope
- **Resolution**: Committed to single approach: populate `<select>` and radios at runtime from `DIVERGENCE_TYPES`
- **Learning**: Never offer scope-reduction alternatives in plan tasks; make hard decisions before finalizing

### Warnings (Insights from Execution)

| # | Warning | Impact | Resolution |
|----|---------|--------|-----------|
| W1 | `temporal-api.ts` already existed (stale premise) | 2.5d estimate was inflated; execution was redundant rewrite risk | Reframed as "verify & commit existing" instead of "create"; saved ~2 days |
| W2 | SC2's "8+ backend modules" unattainable (only 4 real conversion sites) | Deliverable couldn't be literally met | Amended ROADMAP wording to "all modules that perform conversions" (3-4, not 8+) |
| W3 | Contradiction on admin.ts:38 (both "don't touch ms" and "fix it") | Conflicting execution directions | Deleted the admin.ts item; added regression assertion instead |
| W4 | Verification lacked negative assertions for "zero duplication" | SC5 relied only on human inspection | Added grep command: `rg "Timestamp\.fromMillis|Math\.floor" src/ | grep -v domains/temporal-api` |

### Informational Issues

| # | Issue | Type |
|----|-------|------|
| I1 | Test count claim off by ~20 | Minor estimation error |
| I2 | Per-file coverage (90%) not enforced | Soft gate, only global 85% |
| I3 | Performance timing assertions mismatched (100ms vs 500ms claimed) | Flaky test; spec updated to match implementation |
| I4 | Line counts wrong by ~10-30 lines | Cosmetic |
| I5 | Batch behavior spec looser than implementation | Spec tightened to match throw behavior |

---

## Key Insights

### 1. Pre-existing State Must Be Audited
- **W1** (temporal-api.ts already exists) and **B2** (typecheck baseline broken) both stem from not checking current state
- **Action for future**: Always do `git status` + run all verification gates before finalizing plan

### 2. Scope Reduction Must Be Explicit (Not Optional)
- **B3** (scope hedge) created ambiguity about what "success" meant
- **Action**: Hard-commit to scope; document tradeoffs if reduction is necessary, but don't leave "or" branches in task descriptions

### 3. Success Criteria Must Be Testable
- **B1** (code review) showed an unmeasurable criteria; executor couldn't know if they succeeded
- **Action**: For every SC, name the task + verification command that proves it's met

### 4. Verification Commands Are Executable Contracts
- **W4** (zero duplication) was unverified by automation; grep command makes it measurable
- **Action**: Prefer grep/test commands over manual inspection; make SCs falsifiable

---

## Plan-Check Process Observation

**This phase experienced only 1 formal plan-check** (generated 2026-09-02).

**Note**: The plan was finalized with 3 blockers identified. Execution proceeded with blockers resolved inline (code review task added, typecheck errors fixed, scope hedge removed). This represents successful **"identify blockers, resolve before executing"** discipline.

No post-execution re-check was conducted, so we don't have a second PLAN-CHECK.md showing "blockers now resolved → Ready to Execute."

---

## Execution Outcomes vs Plan

| Aspect | Plan | Actual | Variance |
|--------|------|--------|----------|
| Duration | 1.5 days | ~1.5 days | ✓ On target |
| Test count | 365+ | ~342 baseline + 36 new | Minor |
| Code review | B1 added mid-execution | ✓ Completed | Recovered |
| Typecheck gate | 13 errors pre-existing | ✓ All fixed before execution | Recovered |

---

## Recommendations for Phase 15+

1. **Pre-flight audit** (run `npm test`, `npm run typecheck`, `npm run test:coverage` against current baseline)
2. **Explicit 1:1 SC→Task mapping** (every success criterion must have a named task + verification command)
3. **Hard scope commitment** (no "or" alternatives in task descriptions)
4. **Automation over inspection** (grep, test assertions instead of manual verification)
5. **Post-execution plan-check** (re-verify all blockers are resolved, generate PLAN-CHECK-FINAL.md)

---

## Code Review Integration

Phase 14 required code review (B1 added 14-01-06). Code review findings were recorded separately in `14-REVIEW.md`.

---

**Status**: ✅ Phase 14 execution complete. All blockers resolved. Ready for Phase 15.
