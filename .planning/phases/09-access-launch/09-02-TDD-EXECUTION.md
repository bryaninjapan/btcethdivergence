# Task 09-02-TDD: Cloudflare Access Service Token Verification
## Execution Status

**Date**: 2026-08-31  
**Status**: ⏸️ BLOCKED on Manual Cloudflare Access Setup  
**Current Phase**: Pre-TDD Dependency Check

---

## Current State Verification

### Environment
- ✅ Project deployed successfully to custom domain
  - Custom domain: `https://btcethdivergence.bryanlab.cc/` → HTTP 200
  - Workers.dev disabled: `https://btcethdivergence.gn01968711.workers.dev/` → HTTP 404 (as expected)
  - wrangler.jsonc: `"workers_dev": false` is active

- ✅ INGEST_TOKEN available
  - Location: `~/.config/btcethdivergence/ingest-token`
  - Value: `b42b4abeb806666c8d557ec74a9d47f13c701d00a6aaea41bb746f0dd7cb3bd6` (32 bytes hex)

- ❌ Cloudflare Access NOT configured
  - No Access application created on `btcethdivergence.bryanlab.cc`
  - No Access Service Token created
  - No policies configured

### Blocking Dependency

**CANNOT execute TDD tests without**:
1. Cloudflare Access application created on the custom domain
2. Service Token created and configured
3. CF_CLIENT_ID and CF_CLIENT_SECRET available

---

## TDD Tests (Pending Execution)

### Test 1: Service Token Passes Cloudflare Access (RED → GREEN)

**RED Phase** (Before Access policy configured):
```bash
CF_CLIENT_ID="<from-dashboard>"
CF_CLIENT_SECRET="<from-dashboard>"

curl -i -H "Cf-Access-Client-Id: ${CF_CLIENT_ID}" \
        -H "Cf-Access-Client-Secret: ${CF_CLIENT_SECRET}" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor

# Expected: HTTP 401 with header "Cf-Access-Denied: true"
# (Cloudflare Access denies access because no valid token policy exists)
```

**GREEN Phase** (After Access policy configured):
```bash
curl -i -H "Cf-Access-Client-Id: ${CF_CLIENT_ID}" \
        -H "Cf-Access-Client-Secret: ${CF_CLIENT_SECRET}" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor

# Expected: HTTP 401 WITHOUT "Cf-Access-Denied" header
# (Cloudflare Access LET the request through; app rejected for missing INGEST_TOKEN)
```

### Test 2: Dual-Layer Authentication (RED → GREEN)

```bash
CF_CLIENT_ID="<from-dashboard>"
CF_CLIENT_SECRET="<from-dashboard>"
INGEST_TOKEN="b42b4abeb806666c8d557ec74a9d47f13c701d00a6aaea41bb746f0dd7cb3bd6"

curl -i -H "Cf-Access-Client-Id: ${CF_CLIENT_ID}" \
        -H "Cf-Access-Client-Secret: ${CF_CLIENT_SECRET}" \
        -H "Authorization: Bearer ${INGEST_TOKEN}" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor

# Expected: HTTP 200 + valid response
# (Both layers authenticated successfully)
```

### Test 3: launchd Cron Integration (Real World)

After Test 2 passes, update and run:
```bash
# Update backfill-fetcher.mts with Service Token headers
# Update backfill-runner.sh with CF_CLIENT_ID/SECRET env vars
# Run launchd job

launchctl kickstart -k gui/$(id -u)/com.btcethdivergence.backfill

# Expected: Cron executes successfully, logs show:
# { inserted: N, skipped: M, cursor: X }
```

---

## Manual Cloudflare Dashboard Setup (REQUIRED FIRST)

### Step 1: Create Cloudflare Access Application

1. Go to **Cloudflare Dashboard** → **Zero Trust** → **Access** → **Applications**
2. Click **Create an application**
3. Fill in:
   - **Application name**: `BTC/ETH Divergence Tracker`
   - **Application type**: Select **Self-hosted**
   - **Application domain**: `https://btcethdivergence.bryanlab.cc`
   - Click **Next**

### Step 2: Create Service Token

1. Go to **Zero Trust** → **Access** → **Service Tokens**
2. Click **Create Service Token**
3. Fill in:
   - **Name**: `btcethdivergence-backfill`
   - **Client TTL**: 87600 hours (10 years, or shorter as needed)
   - Click **Generate token**
4. **Copy and save**:
   - `Client ID` → Save as `CF_CLIENT_ID`
   - `Client secret` → Save as `CF_CLIENT_SECRET`
   - ⚠️ The secret is only shown once; save immediately

### Step 3: Configure Access Policies

Back in the Access application settings:

#### Policy 1: Owner Email (for UI + data APIs)
1. Click **Add a policy**
2. **Policy name**: `Owner Email Only`
3. **Decision**: `Allow`
4. **Path-based rule** (expand "Choose a hostname and path"):
   - Hostname: `btcethdivergence.bryanlab.cc`
   - Paths: `/`, `/charts.html`, `/calculator.html`, `/api/records*`, `/api/klines*`
5. **Require**: Select **Email** as authentication method
6. **Email list**: Add `gn01968711@gmail.com`
7. Click **Save**

#### Policy 2: Service Token (for admin APIs)
1. Click **Add a policy**
2. **Policy name**: `Service Token for Admin APIs`
3. **Decision**: `Allow`
4. **Path-based rule**:
   - Hostname: `btcethdivergence.bryanlab.cc`
   - Paths: `/api/admin/*`
5. **Require**: Select **Service Token** (dropdown)
6. **Service Token**: Select the token created in Step 2
7. Click **Save**

#### Default Policy
- Should be set to **Block** (deny all other routes)
- Check that it's the last policy in the list

### Step 4: Test Access (Manual Browser)

1. Open incognito window
2. Visit `https://btcethdivergence.bryanlab.cc/`
3. Should redirect to Cloudflare Access login
4. Enter email `gn01968711@gmail.com`
5. Check email for OTP
6. Enter OTP
7. Should redirect to home page
8. Verify charts, calculator, records pages load

---

## Prepared Code Changes (Ready to Apply)

### Change 1: Update backfill-fetcher.mts with Service Token Headers

**File**: `scripts/backfill-fetcher.mts`

Add Service Token headers to both API calls:

```typescript
// In fetchCursor function
const cursorRes = await fetch(
  `${workerUrl}/api/admin/backfill-cursor?symbol=${encodeURIComponent(symbol)}`,
  {
    headers: {
      'Cf-Access-Client-Id': process.env.CF_CLIENT_ID || '',
      'Cf-Access-Client-Secret': process.env.CF_CLIENT_SECRET || '',
      'Authorization': `Bearer ${ingestToken}`,
    },
  },
);

// In main function - ingest call
const ingestRes = await fetch(`${workerUrl}/api/admin/ingest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cf-Access-Client-Id': process.env.CF_CLIENT_ID || '',
    'Cf-Access-Client-Secret': process.env.CF_CLIENT_SECRET || '',
    'Authorization': `Bearer ${ingestToken}`,
  },
  body: JSON.stringify({ symbol, klines: result.klines }),
});
```

### Change 2: Update backfill-runner.sh with Service Token Environment

**File**: `~/.config/btcethdivergence/backfill-runner.sh`

Add Service Token credentials (after retrieving them from dashboard):

```bash
#!/bin/bash
cd /Users/bryan/Documents/btcethdivergence
export WORKER_URL="https://btcethdivergence.bryanlab.cc"
export INGEST_TOKEN="$(cat ~/.config/btcethdivergence/ingest-token)"
export CF_CLIENT_ID="<paste-from-dashboard>"
export CF_CLIENT_SECRET="<paste-from-dashboard>"
export SYMBOL="BTCUSDT"
/Users/bryan/.local/bin/node ./node_modules/.bin/tsx scripts/backfill-fetcher.mts >> ~/.config/btcethdivergence/backfill.log 2>&1
```

### Change 3: Update GitHub Actions CI Secrets

**File**: `.github/workflows/fetch-binance.yml`

Update the workflow with the new environment variables:
```yaml
- name: Update BTC Klines
  env:
    WORKER_URL: ${{ secrets.WORKER_URL }}
    INGEST_TOKEN: ${{ secrets.INGEST_TOKEN }}
    CF_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}
    CF_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}
    SYMBOL: BTCUSDT
  run: node ./node_modules/.bin/tsx scripts/backfill-fetcher.mts
```

Plus add new secrets to GitHub:
- `CF_CLIENT_ID` (from Cloudflare dashboard)
- `CF_CLIENT_SECRET` (from Cloudflare dashboard)

---

## Execution Checkpoint

### ✅ Before Running TDD Tests

- [ ] **Manual Setup Complete**:
  - [ ] Cloudflare Access application created on `btcethdivergence.bryanlab.cc`
  - [ ] Service Token created in Cloudflare dashboard
  - [ ] CF_CLIENT_ID and CF_CLIENT_SECRET copied and available
  - [ ] Policy 1 (Owner Email) configured and tested
  - [ ] Policy 2 (Service Token) configured

- [ ] **Code Prepared**:
  - [ ] backfill-fetcher.mts updated with Service Token headers
  - [ ] backfill-runner.sh updated with CF_CLIENT_ID/SECRET env vars
  - [ ] GitHub Actions secrets added (CF_CLIENT_ID, CF_CLIENT_SECRET)

### ⏭️ Next: Run TDD Tests

Once checkpoint is complete, execute:

```bash
# Test 1: RED phase (before policy) + GREEN phase (after policy)
# Test 2: Dual-layer authentication
# Test 3: Live launchd cron execution
```

---

## Fallback Decision Tree

**If Test 1 Fails** (Access blocking Service Token):
- Fallback: Exclude `/api/admin/*` from Access, or use static IP bypass
- Impact: Cron automation remains vulnerable during syncs
- Mitigation: Implement IP-based rate limiting on cron endpoints

**If Test 2 Fails** (Dual-layer auth broken):
- Investigate: INGEST_TOKEN validation logic in `/api/admin/*` endpoints
- Fix: Update src/routes/admin.ts to ensure proper header parsing
- Re-run Test 2

**If Test 3 Fails** (Cron execution fails):
- Check launchd logs: `log stream --predicate 'process == "com.btcethdivergence.backfill"'`
- Verify env vars in backfill-runner.sh are correctly set
- Re-run manual cron: `launchctl kickstart -k gui/$(id -u)/com.btcethdivergence.backfill`

---

## Success Criteria (TDD Complete)

- ✅ Test 1: Service Token passes Cloudflare Access (both RED and GREEN phases)
- ✅ Test 2: Dual-layer authentication works (HTTP 200 response)
- ✅ Test 3: launchd cron executes successfully (data syncs, logs show inserted/skipped/cursor)
- ✅ Code changes applied and type-checked
- ✅ GitHub Actions secrets configured
- ✅ One live cron run completes successfully

**When all criteria met**: Proceed to full Phase 9-02 implementation
