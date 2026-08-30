# Phase 3 UAT Testing Plan

**Date:** 2026-08-31
**Status:** Ready to Execute
**Goal:** Validate Phase 3 success criteria through real-world usage before Phase 4 starts

---

## Test Objectives

1. ✅ **SC1 Verification** — Confirm full historical data loaded (2021-01 → present)
2. ✅ **SC2 Verification** — Confirm idempotency (no duplicates on re-run)
3. ✅ **SC3 Verification** — Confirm automated daily cron runs without manual intervention

---

## UAT Schedule

### Week 1 (2026-08-31 to 2026-09-06)

**Automated daily cron testing** — Let both jobs run at scheduled times without intervention:
- **BTCUSDT**: 02:00 UTC each day
- **ETHUSDT**: 18:00 UTC each day

**Daily checkpoint (10 min per day)**:
```bash
# After BTCUSDT fires (02:00 UTC + 2 min)
tail -1 ~/.config/btcethdivergence/backfill.log

# After ETHUSDT fires (18:00 UTC + 2 min)
tail -1 ~/.config/btcethdivergence/backfill-eth.log
```

**Expected output format**:
```json
{ "inserted": 0, "skipped": N, "cursor": 1788*N*N*N*N*, ... }
```
or
```
reached now; no new candles available
```

**Pass criteria for each day**:
- ✅ Log file exists and has new timestamp
- ✅ No error message (exit status 0)
- ✅ Correct JSON structure with `inserted` and `skipped` fields
- ✅ Cursor value >= previous cursor (monotonic advance)

---

## UAT Test Cases

### Test 1: Historical Data Completeness (SC1)
**Manual check** (run once at start):
```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) AS count, MIN(open_time) AS earliest, MAX(open_time) AS latest FROM klines GROUP BY symbol"
```

**Expected**:
```
BTCUSDT: count=49613, earliest=1609459200 (2021-01-01), latest=1788112800 (2026-08-30 18:00 UTC)
ETHUSDT: count=49613, earliest=1609459200 (2021-01-01), latest=1788112800 (2026-08-30 18:00 UTC)
```

**Status**: ✅ PASS (verified at 03:21 UTC 2026-08-31)

---

### Test 2: No Duplicates on Re-run (SC2)
**Manual re-run** (run once mid-week):
```bash
# Get before count
BEFORE=$(npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) FROM klines WHERE symbol='BTCUSDT'" | grep -o '[0-9]*' | tail -1)

# Re-run backfill over current data
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN="$(cat ~/.config/btcethdivergence/ingest-token)" \
SYMBOL=BTCUSDT \
/Users/bryan/.local/bin/node ./node_modules/.bin/tsx scripts/backfill-fetcher.mts

# Get after count
AFTER=$(npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) FROM klines WHERE symbol='BTCUSDT'" | grep -o '[0-9]*' | tail -1)

echo "Before: $BEFORE, After: $AFTER"
```

**Expected**:
```
Before: 49613, After: 49613  (no change — `INSERT OR IGNORE` prevented duplicates)
```

**Status**: ✅ PASS (crawl log showed `inserted: 0, skipped: 1000` on re-run)

---

### Test 3: Daily Cron Automation (SC3)

**Sub-test 3a: BTCUSDT launchd job**

- **Event**: 2026-08-31 02:00 UTC (next scheduled fire)
- **Checkpoint**: Wait for log at `~/.config/btcethdivergence/backfill.log`
- **Expected**: File exists, contains one new line, exit status from launchd log says success

```bash
# Check immediately after 02:00 UTC
sleep 120  # wait 2 minutes for launchd to execute
if [ -f ~/.config/btcethdivergence/backfill.log ]; then
  echo "✅ BTCUSDT job fired"
  tail -1 ~/.config/btcethdivergence/backfill.log
else
  echo "❌ BTCUSDT job did not fire"
  cat ~/.config/btcethdivergence/backfill.stderr 2>/dev/null || echo "No stderr"
fi
```

**Status**: Awaiting scheduled fire (2026-08-31 02:00 UTC)

---

**Sub-test 3b: ETHUSDT launchd job**

- **Event**: 2026-08-31 18:00 UTC (next scheduled fire)
- **Checkpoint**: Wait for log at `~/.config/btcethdivergence/backfill-eth.log`
- **Expected**: File exists, contains one new line, exit status indicates success

```bash
# Check immediately after 18:00 UTC
sleep 120  # wait 2 minutes for launchd to execute
if [ -f ~/.config/btcethdivergence/backfill-eth.log ]; then
  echo "✅ ETHUSDT job fired"
  tail -1 ~/.config/btcethdivergence/backfill-eth.log
else
  echo "❌ ETHUSDT job did not fire"
  cat ~/.config/btcethdivergence/backfill-eth.stderr 2>/dev/null || echo "No stderr"
fi
```

**Status**: Awaiting scheduled fire (2026-08-31 18:00 UTC)

---

### Test 4: Idempotency Under Cron (Continuous)

**Automated check** — Each daily cron run verifies idempotency by design:
- Cron fetches from `cursor + 3600` (next hour after last stored candle)
- `INSERT OR IGNORE` prevents duplicates
- Expected: `inserted` >= 0, `skipped` >= 0, sum = total fetched

**Pass criteria**:
- No duplicate rows created (verify via weekly `dup_groups = 0` check)
- Cursor monotonically increases (never goes backward)
- Log shows `{ "inserted": N, "skipped": M, ... }` each run

---

## Week 1 Checkpoint (2026-09-06 Evening)

After 7 days of automatic cron runs (14 job executions total):

```bash
# Verify no duplicates accumulated
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) AS dup_groups FROM (SELECT symbol, open_time FROM klines GROUP BY symbol, open_time HAVING COUNT(*) > 1)"

# Check updated row counts
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) FROM klines GROUP BY symbol"
```

**Expected**:
```
dup_groups: 0
BTCUSDT: ~49625 (baseline 49613 + 7 days * ~1-2 new candles/day if market is active)
ETHUSDT: ~49625
```

**Pass criteria**:
- ✅ No duplicate rows
- ✅ Row counts increased monotonically (never decreased)
- ✅ All 14 cron executions logged without error
- ✅ Cursor in D1 matches max stored open_time for each symbol

---

## Rollback Plan (If Critical Issue Found)

If any job fails after Phase 4 starts:

```bash
# Emergency disable both jobs
launchctl unload ~/Library/LaunchAgents/com.btcethdivergence.backfill.plist
launchctl unload ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist

# Verify they're unloaded
launchctl list | grep btcethdivergence  # should return nothing

# Notify: "Phase 3 cron disabled pending investigation"
```

To re-enable after fix:
```bash
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill.plist
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist
```

---

## Pass/Fail Criteria

**Phase 3 UAT PASS if**:
- ✅ Test 1 (SC1): Data span correct, gap verification passed
- ✅ Test 2 (SC2): Re-run produced zero new rows (idempotency proven)
- ✅ Test 3a (BTCUSDT cron): Job fires every 24h at 02:00 UTC, logs success
- ✅ Test 3b (ETHUSDT cron): Job fires every 24h at 18:00 UTC, logs success
- ✅ Test 4 (Idempotency): 7 days of runs without duplicates

**Phase 3 UAT FAIL if**:
- ❌ Any cron job fails to execute (no log file created after scheduled time)
- ❌ Any job produces corrupted log (invalid JSON, error message)
- ❌ Duplicate rows detected after re-run or during Week 1
- ❌ Cursor goes backward or row count decreases

---

## Next Phase Gate

✅ **Phase 3 UAT gates Phase 4**: Do not proceed to Records CRUD implementation until:
1. BTCUSDT cron has fired at least once (observed at 02:00 UTC)
2. ETHUSDT cron has fired at least once (observed at 18:00 UTC)
3. No failures detected

Estimated Phase 4 start: **2026-09-01 after first full 24h cycle completes**

---

## UAT Closure

Once all tests PASS and no issues are found during Week 1:
- Archive UAT results to `.planning/phases/03-historical-load-cron-sync/UAT-RESULTS.md`
- Close Phase 3 officially
- Proceed to Phase 4 (Records CRUD) planning
