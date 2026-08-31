# GitHub Actions Secrets Configuration for Phase 9-02

**Required Actions**: Update repository secrets in GitHub to support Service Token authentication.

---

## Update Existing Secrets

### WORKER_URL
**Current**: `https://btcethdivergence.gn01968711.workers.dev`  
**New**: `https://btcethdivergence.bryanlab.cc`  
**Reason**: workers.dev is now disabled (`workers_dev: false` in wrangler.jsonc)

**Steps**:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Find `WORKER_URL` secret
3. Click **Edit**
4. Replace value with `https://btcethdivergence.bryanlab.cc`
5. Click **Update secret**

---

## Add New Secrets

### CF_CLIENT_ID
**Value**: From Cloudflare Access Service Token dashboard (after creation)  
**Location**: Cloudflare → Zero Trust → Access → Service Tokens → `btcethdivergence-backfill` → Client ID

**Steps**:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. **Name**: `CF_CLIENT_ID`
4. **Value**: (paste from Cloudflare dashboard)
5. Click **Add secret**

### CF_CLIENT_SECRET
**Value**: From Cloudflare Access Service Token dashboard (after creation)  
**Location**: Cloudflare → Zero Trust → Access → Service Tokens → `btcethdivergence-backfill` → Client Secret

⚠️ **CRITICAL**: The secret is only shown once when created. Copy and save immediately before closing the dialog.

**Steps**:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. **Name**: `CF_CLIENT_SECRET`
4. **Value**: (paste from Cloudflare dashboard)
5. Click **Add secret**

---

## Verification

After adding secrets, verify in `.github/workflows/fetch-binance.yml`:

```yaml
env:
  WORKER_URL: ${{ secrets.WORKER_URL }}          # Updated
  INGEST_TOKEN: ${{ secrets.INGEST_TOKEN }}
  CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}      # New
  CF_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}  # New
  SYMBOL: ${{ inputs.symbol }}
  START_TIME_OVERRIDE: ${{ inputs.start_time_override }}
```

The workflow file has been updated; now GitHub Actions just needs the secrets to be configured.

---

## Timeline

1. **Create Cloudflare Service Token** (Manual Dashboard)
   - Get CF_CLIENT_ID and CF_CLIENT_SECRET

2. **Update GitHub Secrets** (This Page)
   - Add CF_CLIENT_ID
   - Add CF_CLIENT_SECRET
   - Update WORKER_URL

3. **Test in GitHub Actions**
   - Trigger workflow manually: Actions → Fetch Binance Klines (Backfill) → Run workflow
   - Monitor logs for successful execution

---

## Testing Checklist

After secrets are configured:

```bash
# Test 1: Manual workflow trigger
# - Go to GitHub Actions
# - Select "Fetch Binance Klines (Backfill)"
# - Click "Run workflow"
# - Verify successful completion

# Test 2: Check logs for expected output
# - Navigate to the workflow run
# - Expand the "Run backfill fetcher" step
# - Verify logs contain: { inserted: N, skipped: M, cursor: X }
# - No "Cf-Access-Denied" errors

# Test 3: Verify data actually synced
# - Check production database (D1 btcethdivergence)
# - Verify latest klines updated recently
```
