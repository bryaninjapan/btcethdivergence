# Phase 3 Plan Sketch — Historical Load & Cron Sync

**Owner decision**: launchd-based daily sync (zero cost, proven locally)

## Two Stages

### Stage 1: Historical Backfill (Data Completeness)
**Goal**: Fill D1 remote with 4+ years of BTCUSDT + ETHUSDT (2021-03-25 → 2026-08-31)

**Current state**: 3000 BTCUSDT rows (2021-03-25 → 2021-06-01) already in remote D1

**Method**: Run fetcher repeatedly locally until cursor reaches "now" (empty response from Binance)
```bash
# Stage 1: One-time historical crawl
WORKER_URL=https://btcethdivergence.gn01968711.workers.dev \
INGEST_TOKEN=$INGEST_TOKEN \
SYMBOL=BTCUSDT \
npx tsx scripts/backfill-fetcher.mts

# Repeat until "reached now" (exit 0 with no new rows)
# Then repeat for ETHUSDT
```

**Duration estimate**: ~2-4 hours (depends on rate limits)

**Success criteria**:
- Remote D1 `klines` table has BTCUSDT + ETHUSDT from 2021-03-25 → 2026-08-31
- Cursor stored in `backfill_state` at "now" (or latest fetched time)
- No duplicates (INSERT OR IGNORE ensures idempotency)

---

### Stage 2: Daily Schedule via launchd (Data Currency)
**Goal**: Keep D1 in sync with latest Binance candles (2026-09-01 onward)

**launchd plist** (create at `~/Library/LaunchAgents/com.btcethdivergence.backfill.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.btcethdivergence.backfill</string>
  
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>bash</string>
    <string>-c</string>
    <string>
      cd /Users/bryan/Documents/btcethdivergence && \
      export WORKER_URL="https://btcethdivergence.gn01968711.workers.dev" && \
      export INGEST_TOKEN="$( cat ~/.config/btcethdivergence/ingest-token )" && \
      export SYMBOL="BTCUSDT" && \
      npx tsx scripts/backfill-fetcher.mts >> ~/.config/btcethdivergence/backfill.log 2>&1
    </string>
  </array>
  
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  
  <key>StandardOutPath</key>
  <string>~/.config/btcethdivergence/backfill.stdout</string>
  
  <key>StandardErrorPath</key>
  <string>~/.config/btcethdivergence/backfill.stderr</string>
</dict>
</plist>
```

**Setup**:
```bash
# 1. Create config directory
mkdir -p ~/.config/btcethdivergence

# 2. Store INGEST_TOKEN securely (read at runtime)
echo "your_token_here" > ~/.config/btcethdivergence/ingest-token
chmod 600 ~/.config/btcethdivergence/ingest-token

# 3. Load launchd plist
launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill.plist

# 4. Verify it's loaded
launchctl list | grep btcethdivergence

# 5. Check logs
tail -f ~/.config/btcethdivergence/backfill.log
```

**Schedule**: 2 AM UTC every day
- After market close (midnight UTC is NYC close)
- Fetches the prior day's candles
- Cursor advances by max 1000 rows/run (reached-now tail exits cleanly)

**Success criteria**:
- launchd runs fetcher daily without manual intervention
- D1 remote stays in sync (cursor = "now" or 1 day behind)
- Log shows consistent `inserted > 0` or `reached now` exits

---

## Known Unknowns for Phase 3

1. **Rate limit behavior over 4+ years**: Binance `X-MBX-USED-WEIGHT-1M` logged; may need throttling or batching strategy if weight exceeds limits during historical crawl.
2. **Cursor persistence during crawl**: Backfill_state updates per call; if machine crashes mid-crawl, cursor is safe (re-run continues from where it left off).
3. **launchd persistence**: Will survive macOS sleep/wake? (usually yes, but monitor first week logs).
4. **ETHUSDT handling**: Same fetcher, just change SYMBOL env var. Can run ETHUSDT in evening (18:00 UTC) if needed to stagger Binance load.

---

## Phase 4+ Resilience (Not Phase 3)

- **CoinGecko fallback** (if Binance policies change)
- **Monitoring dashboard** (kline_sync_log audit table, SLA tracking)
- **Alert on missing days** (if launchd fails silently)

---

## Next Steps (Owner)

1. **Decide**: Run historical backfill now (Stage 1) or defer?
2. **If yes**: Execute `npm run backfill -- BTCUSDT` repeatedly until "reached now", then `ETHUSDT`
3. **Setup**: Create launchd plist (provided above) and `launchctl load` it
4. **Monitor**: Check logs for first week to verify daily runs

---

## Related Files

- `scripts/backfill-fetcher.mts` — the daily sync script (already built, tested)
- `src/lib/backoff.ts` — rate limit handling (429 retry, 418/451 abort)
- `src/routes/admin.ts` — ingest endpoint the fetcher POSTs to
- `.planning/phases/02-kline-backfill-engine/LEARNING.md` — Phase 2 findings (GitHub geo-block, etc.)
