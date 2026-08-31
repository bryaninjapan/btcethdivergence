---
phase: 3
status: ⏳ OWNER ACTION (Execution-Only)
---

# Phase 3: Historical Load & Cron Sync

**Status:** All 3 tasks are **Owner Action** — require manual execution with live credentials and multi-hour crawl. No code to write; infrastructure and schema already exist (Phase 2).

## Quick Summary

Phase 3 is **execution-only**: owner runs the backfill fetcher to crawl 2021–present Binance klines, then sets up macOS `launchd` cron jobs for daily syncs. No autonomous work possible (needs `INGEST_TOKEN` secret and live D1 access).

### What Needs to Happen

1. **Clear stale cursor** — optional, for clean 2021-01 crawl
2. **Run fetcher loop** — multi-hour process (2–4h per symbol) until "reached now"
3. **Set up launchd** — daily jobs @ 02:00 UTC (BTCUSDT) and 18:00 UTC (ETHUSDT)
4. **Verify idempotency** — re-run doesn't duplicate data

---

## Owner Checklist

### Pre-Flight
- [ ] `INGEST_TOKEN` available (from Phase 2 GitHub secret or `.dev.vars`)
- [ ] Worker deployed and reachable: `https://btcethdivergence.gn01968711.workers.dev/api/health`
- [ ] macOS machine where `launchd` will run has network access to Worker

### Step 1: Clear Cursor (Optional)
```bash
npx wrangler d1 execute btcethdivergence --remote --command \
  "DELETE FROM backfill_state WHERE symbol='BTCUSDT'"
```

### Step 2: Backfill BTCUSDT (2–4 hours)
```bash
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts
```
**Expected output:** Runs repeatedly, logs `{ inserted: N, skipped: M }` each iteration, exits 0 with "reached now".

### Step 3: Backfill ETHUSDT (2–4 hours)
```bash
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=ETHUSDT \
npx tsx scripts/backfill-fetcher.mts
```

### Step 4: Verify Coverage
```bash
# Data span
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) as count, MIN(open_time) as earliest, MAX(open_time) as latest FROM klines GROUP BY symbol"

# Gap check (should be 0 or only Binance-side gaps)
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT symbol, COUNT(*) as gap_count FROM (
     SELECT symbol, open_time, open_time - LAG(open_time) OVER (PARTITION BY symbol ORDER BY open_time) as diff
     FROM klines
   ) WHERE diff > 3600 GROUP BY symbol"
```

### Step 5: Set Up launchd Cron
```bash
mkdir -p ~/.config/btcethdivergence
chmod 700 ~/.config/btcethdivergence
echo "$INGEST_TOKEN" > ~/.config/btcethdivergence/ingest-token
chmod 600 ~/.config/btcethdivergence/ingest-token
```

**Create `~/Library/LaunchAgents/com.btcethdivergence.backfill.plist`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.btcethdivergence.backfill</string>
  <key>Program</key>
  <string>/usr/bin/env</string>
  <key>ProgramArguments</key>
  <array>
    <string>env</string>
    <string>WORKER_URL=https://btcethdivergence.gn01968711.workers.dev</string>
    <string>INGEST_TOKEN=$(cat ~/.config/btcethdivergence/ingest-token)</string>
    <string>SYMBOL=BTCUSDT</string>
    <string>npx</string>
    <string>tsx</string>
    <string>/path/to/repo/scripts/backfill-fetcher.mts</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>~/.config/btcethdivergence/backfill.log</string>
  <key>StandardErrorPath</key>
  <string>~/.config/btcethdivergence/backfill-error.log</string>
</dict>
</plist>
```

**Create `~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist` (same, but ETHUSDT @ 18:00 UTC)**

### Step 6: Load Cron Jobs
```bash
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill.plist
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist
launchctl list | grep btcethdivergence
```

### Step 7: Verify Idempotency
```bash
# Before: count rows
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) as c FROM klines WHERE symbol='BTCUSDT'"

# Run fetcher once more (should insert 0)
WORKER_URL=... INGEST_TOKEN=... SYMBOL=BTCUSDT npx tsx scripts/backfill-fetcher.mts

# After: count should match
npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) as c FROM klines WHERE symbol='BTCUSDT'"
```

---

## Success Criteria (Owner-Verified)

| SC | Requirement | How to Verify |
|----|-------------|---------------|
| SC1 | 2021-01 → present klines, no unexplained gaps | Gap-check SQL above → gap_count=0 |
| SC2 | Re-run fetcher → idempotent (no dupes) | Insert 0, skipped > 0 on second run |
| SC3 | Daily cron runs @ scheduled times | Check `~/.config/btcethdivergence/backfill.log` after 02:00/18:00 UTC |

---

## Files (Phase 2 Dependency)

All infrastructure already exists from Phase 2:
- `scripts/backfill-fetcher.mts` — Cursor-aware fetcher
- `src/routes/admin.ts` — POST `/api/admin/ingest`
- `src/lib/kline-insert.ts` — Chunked batch insert
- `src/lib/backoff.ts` — Backoff/retry logic

---

## Troubleshooting

### Fetcher Exits Early (< 1000 klines)
Usually means "reached now" (end of recent data). Normal — continue to next symbol.

### launchd Cron Doesn't Run
```bash
# Check status
launchctl list com.btcethdivergence.backfill
# Watch logs
tail -f ~/.config/btcethdivergence/backfill.log
# Reload
launchctl stop com.btcethdivergence.backfill
launchctl start com.btcethdivergence.backfill
```

### Cursor Still Behind Latest Data
Clear it manually:
```bash
wrangler d1 execute --remote --command \
  "DELETE FROM backfill_state WHERE symbol='BTCUSDT'"
```

---

**Status:** ⏳ Awaiting Owner Execution | **Next:** Phase 4 (Records CRUD UI)

Last Updated: 2026-08-31
