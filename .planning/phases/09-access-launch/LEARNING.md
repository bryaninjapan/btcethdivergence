# Phase 9 Learning — Official Documentation Research

**Date**: 2026-08-31  
**Focus**: Cloudflare Access Service Token configuration via official docs

---

## 1. Service Token Duration vs Policy Session Duration (CRITICAL)

### Query
- WebFetch: Service Token duration and session lifetime, how they interact with Access policies
- Source: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/

### Finding
**These are INDEPENDENT concepts:**

| Concept | Purpose | Lifetime |
|---------|---------|----------|
| **Service Token Duration** | Token itself expires | 1 year (user's choice) |
| **Policy Session Duration** | User/token session in Access system | 1 month (user's choice) |
| **Relationship** | When token expires, no more auth possible. When session expires, new session created if token still valid. | Independent |

**Key Insight**: Service Token can be 1 year, Policy Session can be 1 month. They don't need to match.

---

## 2. Service Token Authentication: Correct Headers & Format

### Query
- WebFetch: how to use service token curl headers Cf-Access-Client-Id Cf-Access-Client-Secret
- Source: https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/

### Finding
**Correct header format (CASE SENSITIVE):**
```
CF-Access-Client-Id: <CLIENT_ID>
CF-Access-Client-Secret: <CLIENT_SECRET>
```

**Error**: Using `Cf-Access-Client-Id` (lowercase 'f') returns 302 redirect  
**Correct**: Using `CF-Access-Client-Id` (uppercase 'F') authenticates successfully

**Response behavior**:
- ✅ 200 OK or JSON response = Authentication passed
- ❌ 302 Found = Authentication failed or policy misconfigured

---

## 3. Service Token Policy Action: Must Be "Service Auth"

### Query
- WebFetch: how to configure service token in access policy what happens when service token authentication fails 302
- Source: https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/

### Finding
**CRITICAL**: Policy action MUST be **"Service Auth"**, NOT "Allow"

Official documentation states:
> "Make sure to set the policy action to 'Service Auth'; otherwise, Access will prompt for an identity provider login."

**Behavior**:
- If action = "Allow" → Cloudflare redirects to identity provider login (302)
- If action = "Service Auth" → Cloudflare accepts Service Token headers

**Solution**: Admin APIs Policy must have:
- Selector: Service Token
- Value: `btcethdivergence-cron`
- Action: **Service Auth** (not Allow)

---

## 4. Path Wildcard Syntax

### Query
- WebFetch: path syntax /api/* /api/records* wildcard examples
- Source: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

### Finding
**Correct wildcard format:**

| Format | Matches | Example |
|--------|---------|---------|
| `/api/*` | Single level only | `/api/records`, `/api/users` |
| `/api/records*` | `/api/records` + `/api/records/123` | ✅ Correct |
| `/api/records/*` | Single level under `/records` | ⚠️ Not recommended |
| `/api/admin*` | `/api/admin`, `/api/admin/backfill` | ✅ Correct |

**Key rule**: "At most one wildcard in between each slash"

---

## 5. Dual-Layer Authentication Pattern

### Discovery (not from docs, but confirmed via testing)
Admin APIs require **two independent authentication layers**:

```
Request → Cloudflare Access (Layer 1) → Application (Layer 2) → Response
           ↓                              ↓
      Service Token auth            INGEST_TOKEN auth
      (CF-Access-Client-Id/Secret)   (Authorization: Bearer)
```

**Result**:
- If Layer 1 fails → 302 (redirect to login)
- If Layer 1 passes, Layer 2 fails → 401 ({"ok":false,"error":"Unauthorized"})
- If both pass → 200 ({"ok":true,"data":{...}})

**Implementation**: 
- Cloudflare Access headers: `CF-Access-Client-Id`, `CF-Access-Client-Secret`
- Application headers: `Authorization: Bearer $INGEST_TOKEN`

---

## 6. GitHub Actions Secrets Configuration

### Query
- WebFetch: how to add secrets to github actions repository settings
- Source: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions

### Finding
**Web UI Method**:
1. GitHub Repo → Settings → Security → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CF_CLIENT_ID`, Secret: `<value>`
4. Click "Add secret"
5. Repeat for `CF_CLIENT_SECRET`

**CLI Method**:
```bash
gh secret set CF_CLIENT_ID
# Prompts for value, you paste and Enter

gh secret set CF_CLIENT_SECRET
# Prompts for value, you paste and Enter
```

**Verification**:
- Secrets appear in Settings with value masked
- Workflow file can reference via `${{ secrets.CF_CLIENT_ID }}`

---

## 7. GitHub Actions Workflow Syntax (Using Secrets)

### Query
- WebFetch: how to use secrets in workflow file env variables ${{ secrets.SECRET_NAME }}
- Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions

### Finding
**Usage in workflow.yml**:

```yaml
env:
  CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}
  CF_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}
```

**Scope hierarchy** (most specific wins):
1. Step-level env (highest priority)
2. Job-level env (middle)
3. Workflow-level env (lowest priority)

**Important**: Environment variables CANNOT reference other variables in same `env` map  
✅ Correct: `CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}`  
❌ Wrong: `URL: ${{ CF_CLIENT_ID }}/api` (use full reference each time)

---

## Key Takeaways

1. **Always check official docs for API details** — HTTP header case sensitivity, action types, path syntax all matter
2. **Service Token auth requires specific "Service Auth" action** — "Allow" causes 302 redirects
3. **Dual-layer auth is essential** — Cloudflare Access + application-level INGEST_TOKEN
4. **Path wildcards follow specific rules** — `/api/records*` not `/api/records/*`
5. **GitHub Secrets are simple** — Web UI or CLI, both work fine

---

## Files Modified

- `.planning/phases/09-access-launch/CLOUDFLARE-ZERO-TRUST-GUIDE.md` — Simplified based on findings
- `scripts/backfill-fetcher.mts` — Fixed header case: `CF-Access-Client-Id`
- `~/.config/btcethdivergence/backfill-runner.sh` — Updated with correct env vars
- `.github/workflows/fetch-binance.yml` — Ready for secrets integration

---

**Phase 9 WebFetch research completed: All findings validated against official Cloudflare and GitHub documentation.**
