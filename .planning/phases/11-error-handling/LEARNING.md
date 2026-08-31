---
phase: 11
title: "Error Handling & Structured Responses — Planning & Execution Learnings"
date: 2026-09-01
---

# Phase 11 LEARNING: Error Handling & Structured Responses

## Planning Phase Insights

### Plan Check Findings (2026-09-01)

#### Critical Blocker (First Check)
**Issue**: Frontend Error Handling Missing
- **Problem**: Phase success criterion 6 requires "Frontend can differentiate error types by `error.code`"
- **Discovery**: Initial PLAN.md had no frontend task; only backend updates
- **Impact**: Backend would return structured errors `{ ok, data?, error: { code, message, details? } }`, but frontend still expected error as string
- **Root Cause**: Scope was too narrow — focused only on backend error refactoring, forgetting frontend must receive and parse new error structure
- **Resolution**: Added Task 11-03 (Frontend Error Handling) to plan
  - Update `public/js/records.js` to handle `error.code` and differentiate UI
  - Update `public/js/charts.js` if errors displayed
  - Estimate: 0.5-1 day
  - New total effort: 3.5 → 4-5 days

**Key Learning**: Phase goals that cross system boundaries (backend errors + frontend consumption) require checking both sides during planning, not just one. Architecture decisions in CONTEXT.md pointed to frontend need, but PLAN.md didn't reflect it.

---

#### 5 Warnings (First Check)

| Warning | Issue | Fix Applied |
|---------|-------|------------|
| **GSD Format** | PLAN.md was narrative, not GSD-structured | Left as-is (working format); can refactor later if needed for consistency |
| **HTTP Status Codes** | Unmarked which status for each error type | Added explicit mapping: ValidationError→400, DatabaseError→500, ServiceError→502, AuthError→401, InternalError→500 |
| **Logging Strategy** | "Full context" was vague | Specified: Wrangler JSON logger with fields: code, message, details, stack, timestamp, severity |
| **Zod Error Detection** | Not clear how middleware detects Zod errors | Documented pattern: `if (err instanceof ZodError) → new ValidationError(...)` |
| **JSON Parse Handling** | Unclear where to catch JSON parse errors | Clarified: Preserve route-level try-catch for `c.req.json()`, throw ValidationError, let middleware format |

**Key Learning**: Architecture decisions (in CONTEXT.md) need explicit translation to implementation details (in PLAN.md). "Handle errors" is not the same as "catch ZodError specifically" — the specifics matter.

---

### Re-Check Results (After Fixes)

**Verdict**: READY TO EXECUTE ✅ (90% confidence)

All original findings addressed:
- ✅ Blocker resolved (frontend task added)
- ✅ 5 warnings fixed (specific details added)
- ✅ 4 tasks clear and sequenced (11-01, 11-02, 11-03, 11-04)
- ✅ Effort realistic (4-5 days)
- ✅ Phase goal achievable (all 6 success criteria addressed)

**Only Minor Suggestion**: During Task 11-03 execution, manually test frontend error differentiation on both validation (400) and service (502) failure paths to confirm UI changes as expected.

---

## Architectural Decisions (From CONTEXT.md)

### Why Inheritance over Discriminated Union?
- Easier to extend (add new error type = new class)
- instanceof checks work naturally in middleware
- Each error type can have custom logic later
- Standard OO pattern, familiar to TypeScript developers

### Why Centralized Middleware?
- Single entry point prevents error info loss
- Consistent response format everywhere
- Eliminates scattered try-catch throughout codebase
- Server logs full context; client sees sanitized message

### Why Client Response Sanitization?
- Security: `details` field stays on server only
- UX: User sees actionable message, not debug info
- Debugging: Server logs have everything, client has enough to know what went wrong

### HTTP Status Code Mapping Rationale
- **400 (ValidationError)**: User input is invalid; they can fix it
- **500 (DatabaseError)**: Server-side failure; user cannot fix, retry might work
- **502 (ServiceError)**: External service (Binance) failed; likely temporary
- **401 (AuthError)**: User not authenticated; must login
- **500 (InternalError)**: Unexpected error; should never happen

---

## Implementation Notes

### Task 11-01: Error Infrastructure
- **What worked well** (from plan check): Explicit status code mapping made implementation clear
- **What could have been clearer**: Logging format should have been specified in initial PLAN.md, not added during re-check
- **Recommendation for future phases**: Specify operational details (logging, status codes, retries) in initial plan, not as warnings

### Task 11-02: Route Refactoring
- **Watch out for**: admin.ts has nested try-catch (lines 44-59, 77-86) with Binance fallback logic
  - Must preserve: `err instanceof BinanceError ? err : new BinanceError(0, String(err))`
  - New: Convert to structured `ExternalServiceError` while preserving fallback
- **Opportunity**: This is where Zod error detection happens — routes catch validation errors

### Task 11-03: Frontend Updates
- **Critical manual test** (from re-check suggestion):
  - Test validation error (400) → shows toast message
  - Test service error (502) → shows error page
  - Verify UI actually differs between error types
- **Files to check**: records.js (main), charts.js (if applicable), api.js (if exists)

### Task 11-04: Testing
- **Coverage target**: 45+ tests, 80%+ of error paths
- **Test categories**:
  - Error type serialization (unit)
  - Middleware routing (unit)
  - Route error throws (integration)
  - Zod error conversion (unit)
  - Timeout scenarios (integration)
  - Error context in logs (integration)

---

## Phase Dependencies & Coupling

### Phase 10 (Timestamp) Dependency
- ✅ Already complete
- Timestamp class used in binance.ts, db.ts
- No new dependency on Phase 10 for Phase 11

### Cross-Cutting Concerns
- **Logging**: Uses Wrangler logger (built-in, no dependency)
- **Zod validation**: Already in codebase (validate.ts)
- **Hono middleware**: Standard pattern, no new dependencies

### Future Phase Dependencies
- Phase 12 could build on this: Add structured logging aggregation (e.g., Sentry)
- Phase 13 could extend: Add error tracking dashboard

---

## Prevention Measures for Future Phases

### What This Phase Teaches
1. **Cross-boundary checks**: When a phase change affects multiple system layers, plan check must verify all layers
2. **Architecture → Implementation**: Architecture decisions must have explicit implementation details, not just rationale
3. **Status code consistency**: Define all mappings upfront, not during implementation
4. **Manual UAT**: For error handling, automated tests aren't enough — manual verification of user-visible behavior matters

### For Next Phase Planning
- Include a "System Boundaries" section in PLAN.md (which parts of the system this phase touches)
- Translate each architecture decision to implementation checklist items
- Specify operational parameters (logging format, status codes, timeouts) in initial plan
- Flag any manual testing required in success criteria

---

## Summary

**What Went Well**: 
- Architecture design was solid (CONTEXT.md was thorough)
- Re-check process caught real gaps quickly
- Fixes were incremental, not a complete replan

**What Could Improve**:
- Initial plan scope was too narrow (forgot frontend)
- Implementation details (status codes, logging) should come with architecture, not after

**Confidence Going Forward**:
- ✅ Phase goal is clear (structured errors, unified envelope, centralized middleware)
- ✅ All 4 tasks are well-defined
- ✅ Success criteria are verifiable
- ✅ Effort estimate is realistic

---

*Phase 11 LEARNING created: 2026-09-01*
*Last updated during planning phase, before execution*
