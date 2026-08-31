---
phase: 3
title: "Historical Load & Cron Sync — Implementation Notes"
date: 2026-08-31
---

# Phase 3 Implementation Notes

Reference for manual backfill execution and launchd cron setup.

---

## Backfill Execution Strategy

### Multi-Run Loop (Fetcher Driven)

The fetcher is designed to run **repeatedly** until completion:

```bash
# Run 1: Fetch first 1000 klines, advance cursor
WORKER_URL=... INGEST_TOKEN=... SYMBOL=BTCUSDT npx tsx scripts/backfill-fetcher.mts
# Output: { inserted: 1000, skipped: 0, cursor: 1627473600 }

# Run 2: Fetch next 1000, advance cursor
npx tsx scripts/backfill-fetcher.mts
# Output: { inserted: 1000, skipped: 0, cursor: 1634135200 }

# ... repeat until:
npx tsx scripts/backfill-fetcher.mts
# Output: reached now (exit 0) — crawl complete
```

**Why repeated runs instead of one long batch:**
- Respects rate limits (Binance throttles large requests)
- Backoff pauses happen between runs
- Progress is visible (logs per run)
- Can be interrupted/resumed safely

### Cursor-Driven Resumption

Each run:

1. **Fetch cursor:** `GET /api/admin/backfill-cursor?symbol=BTCUSDT`
2. **Compute start:** `startTime = cursor + 3600` (next hour)
3. **Fetch Binance:** `GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&startTime=...&limit=1000`
4. **POST to Worker:** Ingest the 1000 (or fewer) candles
5. **Update cursor:** `setBackfillCursor(symbol, lastCandle.open_time)`

**Result:** Each run advances the cursor forward; stopping/restarting is safe.

---

## launchd Cron Setup (macOS)

### Why launchd (Not crontab)?

| Feature | launchd | crontab |
|---------|---------|--------|
| Granularity | Minute-level scheduling | Minute-level |
| Output capture | StandardOutPath / StandardErrorPath | Email/syslog only |
| Environment variables | Can be set in plist | Limited |
| Retry/backoff | Can implement in script | Manual |
| Timezone | Uses system timezone | UTC by default |

**launchd chosen because:**
- Direct log file capture (easy debugging)
- Can pass environment variables via plist
- Integrates with macOS natively

### Plist Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Unique identifier -->
  <key>Label</key>
  <string>com.btcethdivergence.backfill</string>
  
  <!-- Command to run -->
  <key>Program</key>
  <string>/usr/bin/env</string>
  
  <!-- Arguments (including env vars) -->
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
  
  <!-- Schedule: 02:00 UTC every day -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  
  <!-- Log files -->
  <key>StandardOutPath</key>
  <string>~/.config/btcethdivergence/backfill.log</string>
  <key>StandardErrorPath</key>
  <string>~/.config/btcethdivergence/backfill-error.log</string>
  
  <!-- Auto-restart on failure -->
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
```

### Timezone Considerations

**launchd uses system timezone.** To run @ 02:00 UTC reliably:

1. Check system timezone:
```bash
date +%Z
# Result: UTC, PST, EST, etc.
```

2. If **not UTC**, adjust the Hour:
   - PST = UTC - 8 → 02:00 UTC = 18:00 PST (previous day)
   - EST = UTC - 5 → 02:00 UTC = 21:00 EST (previous day)

3. Example for PST:
```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key>
  <integer>18</integer>
  <key>Minute</key>
  <integer>0</integer>
  <key>Day</key>
  <!-- Run on next calendar day at 18:00 (accounts for PST-8 offset) -->
</dict>
</dict>
```

---

## Idempotency Verification

### The INSERT OR IGNORE Pattern

```sql
INSERT OR IGNORE INTO klines (symbol, open_time, ...) VALUES (...);
```

**How it works:**
1. DB checks if `(symbol, open_time)` PK exists
2. If exists: silently skip (no error, no insert)
3. If new: insert normally

**Result:** Running the same klines twice → second run inserts 0, skipped > 0.

### Verification Test

```bash
# Step 1: Record initial count
BEFORE=$(npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) as c FROM klines WHERE symbol='BTCUSDT'" | jq '.results[0].c')

# Step 2: Run fetcher once more (should insert nothing)
WORKER_URL=... INGEST_TOKEN=... SYMBOL=BTCUSDT npx tsx scripts/backfill-fetcher.mts
# Output should show: { inserted: 0, skipped: N }

# Step 3: Check count unchanged
AFTER=$(npx wrangler d1 execute btcethdivergence --remote --command \
  "SELECT COUNT(*) as c FROM klines WHERE symbol='BTCUSDT'" | jq '.results[0].c')

if [ "$BEFORE" -eq "$AFTER" ]; then
  echo "✅ Idempotent: count unchanged ($BEFORE = $AFTER)"
else
  echo "❌ Not idempotent: count changed ($BEFORE → $AFTER)"
fi
```

---

## Gap Detection

### Corrected SQL (Phase 3 deviation note)

The plan's original gap-check query was invalid (window function in WHERE clause). Here's the corrected version:

```sql
SELECT symbol, COUNT(*) as gap_count FROM (
  SELECT symbol, open_time,
    open_time - LAG(open_time) OVER (PARTITION BY symbol ORDER BY open_time) as diff
  FROM klines
) WHERE diff > 3600 GROUP BY symbol;
```

**How it works:**
1. Window function `LAG(open_time)` gets the previous candle's time
2. Compute `diff = current_time - previous_time`
3. Expected: diff = 3600 (1 hour)
4. Any gap > 3600 indicates missing candles

**Expected result:** gap_count = 0 (or only gaps that Binance itself lacks, e.g., market closures)

---

## Logging & Debugging

### launchd Logs

```bash
# Standard output (success logs)
tail -f ~/.config/btcethdivergence/backfill.log

# Errors
tail -f ~/.config/btcethdivergence/backfill-error.log

# System log (launchd scheduler)
log stream --predicate 'process == "launchd"' --level debug
```

### Manually Run in Foreground (for debugging)

```bash
# Same env vars as cron
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$(cat ~/.config/btcethdivergence/ingest-token) \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts
```

---

## Troubleshooting

### Fetcher Exits Early
**Symptom:** First run returns only 100 klines, exits "reached now"

**Cause:** Binance returns fewer candles (e.g., at end of history or rate-limited)

**Fix:** Run again; fetcher resumes from cursor. Eventually reaches true "now".

### launchd Never Runs
**Symptom:** Logs show no activity at scheduled time

**Checks:**
```bash
# Verify job is loaded
launchctl list | grep btcethdivergence

# If listed but not running, check error
launchctl log level debug
log stream --predicate 'process == "launchd"' --level debug
tail -f ~/.config/btcethdivergence/backfill-error.log

# Manually trigger to test
launchctl start com.btcethdivergence.backfill
```

### Worker Returns 401 from launchd
**Cause:** `INGEST_TOKEN` not passed correctly or expired

**Fix:**
```bash
# Verify token file exists and is readable
cat ~/.config/btcethdivergence/ingest-token

# Test curl directly
curl -H "Authorization: Bearer $(cat ~/.config/btcethdivergence/ingest-token)" \
  https://btcethdivergence.gn01968711.workers.dev/api/admin/backfill-cursor?symbol=BTCUSDT
```

---

## Performance Expectations

### Crawl Time
- **Per symbol:** 2–4 hours (Binance has ~20K hourly candles from 2021-01 to present)
- **Total (BTCUSDT + ETHUSDT):** ~6 hours
- **Factors:** Network latency, backoff delays, Binance response times

### DB Growth
- **Per candle:** ~150 bytes (8 numeric columns + metadata)
- **BTCUSDT:** 20K candles ≈ 3 MB
- **ETHUSDT:** 20K candles ≈ 3 MB
- **Total:** ~6 MB (negligible for D1 storage)

---

**Last Updated:** 2026-08-31
