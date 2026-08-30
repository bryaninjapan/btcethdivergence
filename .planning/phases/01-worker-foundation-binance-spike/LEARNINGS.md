---
phase: 1
type: learnings
date: 2026-08-30
---

# Phase 1 Plan Verification Learnings

## Summary

Three non-blocking warnings emerged from plan verification (W-01, W-02, W-03). All are execution-time catches, not planning-time blockers. Each reveals a pattern worth capturing to prevent repetition in Phase 2–9.

---

## W-01: First-Deploy Subdomain Registration Missing from user_setup

### What Happened

**Warning**: `workers.dev` subdomain not confirmed in user_setup; first deploy could hang.

**Root Cause**: Plan 01-01 Task 2 (deploy) assumes a workers.dev subdomain exists, but doesn't document the user_setup step to ensure it beforehand. Cloudflare Workers requires either an explicit subdomain or an account-level registration to auto-generate one.

**Evidence**: Task 2 says "deploy with `npx wrangler deploy`" but no user_setup prerequisite documents the subdomain.

### Why It Matters

- Deploy hangs if subdomain doesn't exist → blocks SC1 verification.
- User then wastes 5-10m debugging why `wrangler deploy` is stalled.
- The fix is one command: `npx wrangler subdomain register` (one-time per account).

### Fix Applied

Added to 01-01 user_setup (line 20):
```
"Workers subdomain available: run `npx wrangler subdomain register` before Task 2 if needed, 
or confirm with `npx wrangler deployments list --name btcethdivergence` that a workers.dev URL 
is available. The deployed URL is needed for all SC1/SC2/SC3/SC5 verify commands."
```

### Pattern to Prevent Repetition

**Rule: One-time CLI setup steps must be explicit in user_setup, not buried in task action.**

- **Why**: user_setup is the checklist users read before execution starts. If a command must run before a task, it goes here, not in task prose.
- **How to apply**: For each task, ask: "Does this task depend on a one-time or account-level setup?" If yes → add to user_setup with a verification command.
- **Related memories**: [[Cloudflare-IP-Blocking]], [[D1-100-Param-Limit]]

### Prevention for Phase 2+

- [ ] Every infrastructure task gets a user_setup audit: CLI auth, quotas, rate limits, DNS/subdomain setup.
- [ ] Verify commands go in user_setup, not task actions.
- [ ] Cross-link user_setup across plan files (01-02, 01-03 share "wrangler authenticated").

---

## W-02: String-to-Number Coercion Not Specified in parseKline

### What Happened

**Warning**: `parseKline` omits `Number()`/`parseFloat()` for indices 1–5 (open, high, low, close, volume). Binance returns these as strings; D1 will store them as text unless explicitly coerced.

**Root Cause**: Research flagged string-number coercion as the **single highest-leverage data-correctness risk** (PITFALLS.md Lesson 5), but the plan didn't capture the implementation detail. Task 1 action says "parse indices 0..5" without specifying the coercion method or test assertions.

**Evidence**: PITFALLS.md documents Binance returning `"29500.50"` (string) in indices 1–5; research called this out as most likely to cause silent data bugs.

### Why It Matters

- If coercion is missing, queries like `SUM(close)` return string concatenation, not arithmetic.
- Bug surfaces only in calculations (Phase 5+), not during fetch/insert → hard to RCA.
- User sees wrong P&L numbers or chart anomalies weeks later.
- Fix retroactively requires data reprocessing (all 110K+ klines must be re-inserted).

### Fix Applied

Updated 01-03 Task 1 action (line 59):
```
src/lib/binance.ts:
  - parseKline(...): ... apply **Number() or parseFloat() to indices 1–5** 
    (open, high, low, close, volume) to coerce Binance's string-typed numbers 
    to actual numbers before writing to D1.
  
src/lib/binance.test.ts:
  - vitest test asserting parseKline maps string-typed numbers correctly
  - **verify all numeric fields are actual numbers** (e.g., typeof parsed.open === 'number')
```

### Pattern to Prevent Repetition

**Rule: Research-flagged data-transform risks must be named in task action + test assertions, not just README notes.**

- **Why**: Risks buried in research get forgotten during implementation. Naming them explicitly in the task action forces the executor to see and handle them.
- **How to apply**: After research identifies a correctness trap, add a note to the implementing task: "Research flags X as highest-risk; verify with [specific assertion/test]."
- **Related memories**: [[Binance-API-Experience]], [[D1-100-Param-Limit]]

### Prevention for Phase 2+

- [ ] Every data-ingestion task includes type coercion tests.
- [ ] Every external API response gets a `parseX` function with explicit assertions.
- [ ] Pitfalls from research become `must_haves` in task specs.

---

## W-03: PROJECT.md Constraints Line Contradicts Locked Architecture

### What Happened

**Warning**: PROJECT.md line 54 still says `"Cloudflare Pages + Workers + D1"` but the project is locked to `"Cloudflare Workers (single deployable with Static Assets binding) + D1"` per ROADMAP research and 01-01/01-02/01-03 plans.

**Root Cause**: PROJECT.md was written *before* architecture research concluded; architecture decision was made and locked in ROADMAP + PLAN files, but PROJECT.md was never synced back.

**Evidence**: 
- PROJECT.md line 54: `"Tech stack": Cloudflare Workers (single deployable, ... ) + D1`
- But ROADMAP.md Architecture section recommends single Worker.
- All three PLAN files implement single Worker + Assets, not Pages.

### Why It Matters

- Contradictions confuse future readers (why is one doc different?).
- Phase 2+ planners might re-open the decision (waste time).
- Reference docs should always reflect locked decisions, not historical alternatives.

### Fix Applied

Updated PROJECT.md line 54 from:
```
"Tech stack": Cloudflare Workers + D1
```
to:
```
"Tech stack": Cloudflare Workers (single deployable,含 Static Assets binding) + D1 
— 不使用 Pages，單一 Worker 專案服務靜態資源和 API（架構已鎖定於 Phase 1 ROADMAP INFRA-01）
```

### Pattern to Prevent Repetition

**Rule: After phase research/planning, sync PROJECT.md + STATE.md with locked decisions; mark architecture decisions as `LOCKED` in PROJECT.md.**

- **Why**: PROJECT.md is the single source of truth for scope + constraints. If it contradicts ROADMAP/PLAN, future phases will re-litigate settled decisions.
- **How to apply**: At phase transition, diff PROJECT.md against ROADMAP.md / PLAN.md. For any field that changed (tech stack, scope, constraints), update PROJECT.md with a note: `— 架構已鎖定於 [phase reference]`
- **Related memories**: [[Project-Architecture]]

### Prevention for Phase 2+

- [ ] PROJECT.md audit at every phase start: does it reflect current ROADMAP/STATE?
- [ ] Lock notation for architecture decisions: `LOCKED: single Worker (Phase 1 research)`.
- [ ] STATE.md tracks which decisions are locked vs. revisable.

---

## Execution Confidence

**All three warnings are pre-execution catches:**
- ✅ W-01: Clarifies user_setup; unblocks deploy.
- ✅ W-02: Hardens data correctness; prevents silent bugs.
- ✅ W-03: Aligns reference docs; prevents re-litigation.

**None require replanning.** Proceed to execution with fixes above.

---

---

## Second Verification Pass (2026-08-30 22:44) — W-01, W-02, W-03 Round 2

### Context

After fixing the first three warnings (workers.dev subdomain, parseKline coercion, PROJECT.md sync), a second `MODE=check` pass revealed three new, non-blocking issues in the **verification logic and test coverage**, not the task logic itself. All three were immediately fixable without replanning.

### **W-01 (Round 2) — Task 1's dry-run fails before public/ directory exists**

**Problem**: 01-01 T1 writes `wrangler.jsonc` with `assets.directory: ./public`, then runs `wrangler deploy --dry-run`. Wrangler validates that the configured directory exists (workers-sdk#8100), but `public/` is only created in 01-01 T2.

**Why It Matters**: First verification gate of the entire phase can fail mid-task, blocking all downstream work.

**Fix Applied**: Updated 01-01 T1 action to include `mkdir -p public` (even empty directory satisfies wrangler's validation). Updated verify to include `test -d public` checkpoint before dry-run.

**Pattern**: **Task sequences that configure paths must ensure those paths exist (or be created in parallel) before the next task's verify step runs.**

---

### **W-02 (Round 2) — Spike endpoint's blocked-case verification contradicts the task logic**

**Problem**: 
- Task action: "On both hosts fail → return HTTP 502 + `jsonError(..., 502)` (ok:false)"
- Verify: Uses `curl -sf` which exits non-zero on 502, treating a **correct blocked outcome** as a test failure
- Expected body: `"ok":true` (contradicts the 502 definition)

**Why It Matters**: SC5 explicitly contemplates a blocked outcome; if both Binance hosts are unreachable, returning 502 + fallback ladder info is the **correct behavior**. But the test red-flags it.

**Fix Applied**: Changed verify to use `curl -s` (no `-f` flag) and accept **two valid outcomes**:
1. Success: `ok:true + count:1` (Binance reachable)
2. Blocked: HTTP 502 + `ok:false + 'Binance blocked'` (fallback ladder exercised, deliberate error handling)

**Pattern**: **Verification logic must align with task logic. If a task defines an error response (502) as a valid outcome, the verify cannot use flags that fail on that status. Accept both success and expected-error cases.**

---

### **W-03 (Round 2) — PUT validation path never tested**

**Problem**: 01-02 T3 specifies `updateRecordSchema.safeParse` for PUT /api/records/:id, but the verify block only tests POST. SC3 requires both POST and PUT invalid bodies to be rejected; a regression in the PUT guard would pass the phase gate.

**Why It Matters**: Incomplete coverage means a hidden bug in PUT logic survives to Phase 2.

**Fix Applied**: Added two PUT-specific verify commands:
1. `curl -X PUT ... -d '{"type":"nonsense"}'` → 400 with Zod error
2. `GET /api/records | grep` to confirm the row was NOT mutated (validation blocked the UPDATE)

**Pattern**: **When a task specifies validation for multiple methods (POST, PUT), every method must have a covering verify command. Incomplete test coverage = hidden bugs.**

---

## Next Steps

1. **Phase 1 execution**: Run `gsd-dispatch 1` with all six warnings fixed (first pass + second pass).
2. **Phase 2 planning**: Carry forward prevention patterns:
   - Path configuration must exist before downstream verifies run
   - Verification logic must match task logic (error responses defined by task = valid test outcomes)
   - Test coverage must be complete across all specified methods
3. **Cross-phase pattern**: Add three patterns to `.planning/intel/PATTERNS.md` for future phases:
   - Pattern 1: One-time setup → user_setup checklist (W-01 first pass)
   - Pattern 2: External API response → parseX + type assertions (W-02 first pass)
   - Pattern 3: Locked decision → PROJECT.md notation (W-03 first pass)
   - **Pattern 4**: Task sequences with path dependencies → mkdir before verify (W-01 second pass)
   - **Pattern 5**: Error-path verification → accept expected error codes in test logic (W-02 second pass)
   - **Pattern 6**: Multi-method validation → verify all methods, not just the primary (W-03 second pass)

