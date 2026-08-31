# Phase 9 PLAN Revision — TDD Service Token Validation

**Date**: 2026-08-31  
**Status**: Plan revision complete  
**Focus**: Address B1 blocker by inserting TDD verification phase

## Revisions Made to 09-PLAN.md

### 1. Added Sub-Task 09-02-TDD: Test-Driven Verification
**Lines 246–282**

Three concrete TDD tests that validate the Service Token approach before full deployment:
- **Test 1 (RED→GREEN)**: Service Token passes Cloudflare Access layer
- **Test 2 (RED→GREEN)**: Dual-layer auth (Service Token + INGEST_TOKEN) works
- **Test 3 (Real-world)**: launchd cron executes successfully with Service Token

**Fallback decision**: If any test fails → use conservative approach (IP bypass or exclude `/api/admin/*` from Access)

### 2. Updated Policy Configuration (Lines 292–304)
Split into two distinct policies:
- **Policy 1**: "Owner Email Only" for user routes (`/`, `/charts.html`, `/calculator.html`)
- **Policy 2**: "Service Token for Admin APIs" for `/api/admin/*` routes

### 3. Added Service Token Implementation Task (Lines 305–313)
Concrete sub-steps to re-wire the cron automation:
- Create Cloudflare Access Service Token (90-day expiration)
- Add token to `~/.config/btcethdivergence/backfill-runner.sh` and ETH runner
- Add token to GitHub Actions secret
- Update `scripts/backfill-fetcher.mts` to include Service Token header
- Re-point launchd runners to custom domain
- **Verify one live sync run succeeds** (checkpoint before final deployment)

### 4. Updated Route Coverage (Lines 315–322)
Explicit scope for each route type:
- User-facing routes → email OTP
- `/api/admin/*` → Service Token (after TDD validation)
- `/api/records`, `/api/klines` → decision deferred (currently public)

### 5. Updated Risk 2 Mitigation (Lines 364–372)
Changed from generic "Bypass for internal traffic" to concrete TDD-first approach:
- **TDD Verification** is the gating milestone
- **Checkpoint**: Live post-gate sync run must succeed
- **Fallback**: Only if TDD fails, use conservative approach

## Why This Resolves B1

The plan checker's B1 blocker was:
> "the plan never re-wires it" — gating the domain + retiring workers.dev "kills the app's only automated data pipeline, and nothing re-wires it"

The revision now **explicitly addresses the re-wiring**:
1. **Where**: New Sub-Task 09-02-TDD + Service Token Implementation (lines 246–313)
2. **How**: TDD tests validate the approach, then concrete steps update runners + CI
3. **When**: Before deployment (sub-task gates full implementation)
4. **Verify**: Live sync checkpoint ensures automation continues post-deployment

## Files Modified in This Session

- `.planning/phases/09-access-launch/09-PLAN.md` (expanded ~70 lines for TDD section + Service Token steps)
- `.planning/phases/09-access-launch/CONTEXT.md` (locked decisions already documented)
- `.planning/phases/09-access-launch/PLAN-REVISION.md` (this file, for audit trail)

## Next Steps

1. **Run plan check again** (optional) — checker should now recognize Service Token re-wiring tasks
2. **Or proceed to execution** — Phase 9 can now be executed with confidence that:
   - TDD validates the Service Token approach is sound before deployment
   - launchd runners will be updated and verified to work post-Access
   - Risk 2 (cron automation) is explicitly mitigated in the task sequence

---

**Recommendation**: The plan now includes concrete operational tasks to re-wire the cron automation. B1 blocker is resolved at the plan level. Phase 9 is ready for execution.
