# Phase 4 Learnings — Records Core CRUD

**Date**: 2026-08-31  
**Source**: Plan Check findings  
**Status**: Completed despite plan check blockers; fixes applied in execution

## Key Findings

### BLOCKER-01: 04-01 Plan Was Outdated
**Issue**: Plan stated "DELETE is the only missing route" but the code already existed before execution started.

**Facts**:
- `deleteRecord()` already existed at `db.ts:87-90` ✅
- `DELETE /api/records/:id` already existed at `records.ts:66-81` ✅  
- `records.test.ts` already had 9/9 passing tests ✅

**Root Cause**: Plan check analyzed the plan without accounting for prior execution context.

**Learning**: 
- When a blocker claims code is missing but exists in git, verify git history first
- Plan check runs against the plan text + current source, not against assumptions about what "should" be missing

### BLOCKER-02: 04-02 Time Parsing Bug (epoch units mismatch)
**Issue**: `parseEpoch` returned `Date.parse()` result (milliseconds) but API contract uses seconds.

**Impact**: Storing times as 1000x the correct value
```
// WRONG
const ts = Date.parse(value);  // Returns milliseconds
// Stored as: 1704067200000 (ms) instead of 1704067200 (seconds)
```

**Fix Applied**:
```
const ts = Math.floor(Date.parse(value) / 1000);  // Divide by 1000 for seconds
```

**Learning**:
- API boundaries are a critical fact-check point for plan verification
- Always verify the units contract (ms vs s) when handling unix timestamps
- `Date.parse()` returns milliseconds; division by 1000 is mandatory when the API expects seconds

### WARNING-01: Missing Commit Step in 04-02
**Issue**: Plan omitted the final `git commit` step after deployment.

**Added**:
```bash
git add public/index.html public/js/ public/css/
git commit -m "feat(phase-4): records UI — table, create/edit form, delete dialog"
```

**Learning**: 
- Every plan's final verification should include the commit step explicitly
- "Deploy" ≠ "Commit" — both are part of the definition of "done"

## Pattern Observations

1. **Plan checks are adversarial**: They assume plan text is the source of truth about what *should* be built, not what *has* been built. This is correct when executed in isolation but requires cross-checking with git history in a live codebase.

2. **API contracts are where plans go wrong**: The timezone/unit mismatches happen at boundaries. Facts like "API expects seconds" should be baked into the plan's "must_haves" section.

3. **Timestamp handling is error-prone**: 
   - `Date.parse()` always returns milliseconds
   - Unix epoch conventions vary (seconds vs milliseconds)
   - Always document the units in type definitions or constants

## Recommendations for Future Phases

- **Pre-plan-check**: Run a git diff against the plan's claimed missing code. If it exists, update the plan's framing to "verify + deploy" instead of "add".
- **API contract facts**: Include explicit unit declarations (`start/end are millisecond timestamps`) in the plan's "must_haves" → "truths" section.
- **Commit step**: Always include `git add` + `git commit` as the final verification step in every phase plan.
