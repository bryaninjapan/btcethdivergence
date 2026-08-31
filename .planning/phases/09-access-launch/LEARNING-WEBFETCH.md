# Phase 9 Session — WebFetch Official Documentation Research

**Date**: 2026-08-31  
**Session Focus**: Debugging Service Token 302 issues via official docs  
**Key Discovery**: Problem was Policy action type, not configuration

---

## 1. Service Token Duration vs Policy Session Duration (CRITICAL)

### WebFetch Query
```
Service Token duration and session lifetime, how they interact with Access policies
```

### Source
https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/

### Finding
**These are INDEPENDENT concepts:**

| Concept | Purpose | Lifetime |
|---------|---------|----------|
| **Service Token Duration** | Token itself expires | 1 year (our choice) |
| **Policy Session Duration** | User/token session in Access | 1 month (our choice) |

**Key Insight**: Service Token can be 1 year, Policy Session can be 1 month. **They don't need to match.**

**Impact**: Solved confusion about whether both durations need to be identical.

---

## 2. Service Token Authentication: Correct Headers & Format

### WebFetch Query
```
how to use service token curl headers Cf-Access-Client-Id Cf-Access-Client-Secret
```

### Source
https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/

### Finding
**Correct header format (CASE SENSITIVE):**
```
CF-Access-Client-Id: <CLIENT_ID>
CF-Access-Client-Secret: <CLIENT_SECRET>
```

**Error Case**: Using `Cf-Access-Client-Id` (lowercase 'f') returns 302 redirect  
**Success Case**: Using `CF-Access-Client-Id` (uppercase 'F') returns 200/401

**Response Behavior**:
- ✅ 200 OK or JSON = Authentication passed
- ❌ 302 Found = Authentication failed or policy misconfigured
- ⚠️ 401 Unauthorized = Service Token passed, but application layer (INGEST_TOKEN) failed

**Impact**: Fixed curl command headers from `Cf-Access-` to `CF-Access-`.

---

## 3. Service Token Policy Action: Must Be "Service Auth" ⭐ CRITICAL

### WebFetch Query
```
how to configure service token in access policy what happens when service token authentication fails 302
```

### Source
https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/

### Finding (Official Documentation)
> **"Make sure to set the policy action to 'Service Auth'; otherwise, Access will prompt for an identity provider login."**

**Behavior**:
- If Policy Action = "Allow" → 302 redirect (tries identity provider login)
- If Policy Action = "Service Auth" → 200/401 (accepts Service Token)

**Root Cause of 302 Issue**: Admin APIs Policy had Action = "Allow" instead of "Service Auth"

**Impact**: **This was THE bug.** Changed Admin APIs Policy action to "Service Auth" → Service Token auth started working.

---

## 4. Path Wildcard Syntax

### WebFetch Query
```
path syntax /api/* /api/records* wildcard examples
```

### Source
https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

### Finding
**Correct wildcard patterns:**

| Pattern | Matches | Status |
|---------|---------|--------|
| `/api/records*` | `/api/records`, `/api/records/123` | ✅ Correct |
| `/api/klines*` | `/api/klines`, `/api/klines/456` | ✅ Correct |
| `/api/admin*` | `/api/admin`, `/api/admin/backfill` | ✅ Correct |
| `/api/records/*` | Only single level under `/records` | ⚠️ Different behavior |

**Key Rule**: "At most one wildcard in between each slash"

**Impact**: Confirmed paths were correct format.

---

## 5. Dual-Layer Authentication Pattern (Discovered via Testing)

### Discovery Process
1. User got 302 initially (Cloudflare Access layer failing)
2. Fixed to get 401 (Cloudflare Access passing, application layer failing)
3. Added INGEST_TOKEN → 200 success

### Pattern
```
Request
  ↓
Cloudflare Access Layer 1
  - Checks: CF-Access-Client-Id & CF-Access-Client-Secret headers
  - Policy action must be: "Service Auth"
  - Result: 302 (fail) or passes through
  ↓
Application Layer 2
  - Checks: Authorization: Bearer $INGEST_TOKEN header
  - Validates token against code
  - Result: 401 (fail) or 200 (success)
  ↓
Response: {"ok":true,"data":{...}}
```

**Error Codes Mean**:
- 302 = Layer 1 failed (Cloudflare Access)
- 401 = Layer 1 passed, Layer 2 failed (INGEST_TOKEN)
- 200 = Both layers passed

**Impact**: Understanding this pattern allowed debugging methodically.

---

## 6. GitHub Actions Secrets Configuration

### WebFetch Query
```
how to add secrets to github actions repository settings
```

### Source
https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions

### Finding
**Web UI Steps**:
1. GitHub Repo → Settings tab
2. Left sidebar → Security → Secrets and variables → Actions
3. New repository secret
4. Name: `CF_CLIENT_ID`, Secret: `<value>`
5. Add secret
6. Repeat for `CF_CLIENT_SECRET`

**CLI Alternative**:
```bash
gh secret set CF_CLIENT_ID
# Prompts for value, paste and Enter
gh secret set CF_CLIENT_SECRET
# Prompts for value, paste and Enter
```

**Impact**: Ready for GitHub Actions integration.

---

## 7. GitHub Actions Workflow Syntax (Using Secrets)

### WebFetch Query
```
how to use secrets in workflow file env variables ${{ secrets.SECRET_NAME }}
```

### Source
https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions

### Finding
**Usage**:
```yaml
env:
  CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}
  CF_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}
```

**Scope Hierarchy**:
1. Step-level env (highest priority)
2. Job-level env
3. Workflow-level env (lowest priority)

**Important**: Cannot reference variables within same `env` map
- ✅ Correct: `CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}`
- ❌ Wrong: `URL: ${{ CF_CLIENT_ID }}/api`

**Impact**: Ready to implement workflow file.

---

## Key Insights from This Session

### What Went Wrong (Root Causes)
1. **Policy Action** — Set to "Allow" instead of "Service Auth" → 302 responses
2. **Header Case** — Used `Cf-Access-Client-Id` instead of `CF-Access-Client-Id` → 302 responses
3. **Misunderstanding Durations** — Thought Service Token Duration and Policy Duration needed to match → They don't

### What Was Right All Along
1. ✅ Service Token created correctly (1 year duration is fine)
2. ✅ Application paths correct (`/api/records*`, `/api/admin*`)
3. ✅ Dual-layer auth architecture correct
4. ✅ backfill-fetcher.mts code already had auth headers
5. ✅ INGEST_TOKEN handling correct

### Debugging Strategy That Worked
1. First: Verify Cloudflare Access connectivity (curl to Frontend UI/Data APIs)
2. Second: Test Service Token manually (curl with headers to Admin API)
3. Third: Check -v output to see actual headers sent
4. Fourth: Query official docs when getting unexpected behavior
5. Fifth: Check response metadata (service_token_status field)

---

## Files Modified This Session

1. **CLOUDFLARE-ZERO-TRUST-GUIDE.md**
   - Simplified structure
   - Updated to document 1 month token duration
   - Added "Service Auth" action requirement to Policy section

2. **scripts/backfill-fetcher.mts**
   - Fixed header case: `CF-Access-Client-Id` and `CF-Access-Client-Secret`

3. **~/.config/btcethdivergence/backfill-runner.sh**
   - Added `export CF_CLIENT_ID`
   - Added `export CF_CLIENT_SECRET`
   - Updated WORKER_URL from `workers.dev` to `bryanlab.cc`

4. **.github/workflows/fetch-binance.yml**
   - Ready for secrets integration (pending)

---

## Final Status

✅ **Phase 9 Service Token Authentication: WORKING**

```json
{
  "ok": true,
  "data": {
    "symbol": "BTCUSDT",
    "cursor": 1788184800,
    "inserted": 20,
    "skipped": 0
  }
}
```

**Test Result**: `bash ~/.config/btcethdivergence/backfill-runner.sh` successfully inserts 20 kline records via authenticated endpoint.

---

## Lessons for Future Phases

1. **Always check official docs first** — Configuration mistakes often appear as mysterious HTTP responses (302, 401, etc.)
2. **Case sensitivity matters** — HTTP headers, action types, path syntax all have specific formats
3. **Dual-layer auth requires debug strategy** — Test each layer independently
4. **Log files are your friend** — Redirected output to `~/.config/btcethdivergence/backfill.log` revealed actual behavior
5. **Metadata in responses** — JSON metadata (like `service_token_status: true/false`) reveals what Cloudflare actually recognized

---

**Session completed: 2026-08-31**  
**Duration**: Multiple debugging iterations  
**Result**: Phase 9 Service Token authentication fully operational  
**Next**: GitHub Actions integration + launchd scheduling
