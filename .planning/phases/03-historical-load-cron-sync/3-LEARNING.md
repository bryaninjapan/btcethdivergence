# Phase 3 Learning & Root Cause Analysis

**Date:** 2026-08-31
**Phase:** 3 (Historical Load & Cron Sync)
**Status:** Completed with key learnings

---

## Critical Issue: launchd plist Configuration

### Problem Statement

The original plist used an inline bash `-c` command string with complex shell escaping:

```xml
<string>
  cd /Users/bryan/Documents/btcethdivergence && \
  export WORKER_URL="https://btcethdivergence.gn01968711.workers.dev" && \
  export INGEST_TOKEN="$( cat ~/.config/btcethdivergence/ingest-token )" && \
  export SYMBOL="BTCUSDT" && \
  ./node_modules/.bin/tsx scripts/backfill-fetcher.mts >> ~/.config/btcethdivergence/backfill.log 2>&1
</string>
```

**Root Causes:**
1. **XML Escaping Complexity** — Special characters (`&`, `<`, `>`) in bash need XML entity escaping (`&amp;`, `&lt;`, `&gt;`), which is error-prone and easy to introduce stray characters
2. **launchd PATH Isolation** — launchd runs jobs with a minimal PATH (`/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`) that does not include user-local paths like `/Users/bryan/.local/bin`
3. **Working Directory Default** — launchd defaults to `/` as working directory; relative paths like `./node_modules/.bin/tsx` fail when CWD is not the project root
4. **tsx Resolution** — `npx tsx` or `$(npm bin)/tsx` require npm to be in PATH and a full npm lookup; **absolute paths to node are more reliable under launchd's constraints**

### Failure Mode

When plist contained:
- Inline bash -c string with XML escaping issues (stray backslash, malformed entities)
- No explicit `<key>WorkingDirectory</key>` element
- Relative path to tsx: `./node_modules/.bin/tsx`
- launchd default PATH

Result:
```bash
$ launchctl kickstart gui/$(id -u)/com.btcethdivergence.backfill
# Job exited with status 512 (shell not found / command not executable)
```

---

## Solution: External Script + Absolute Paths

### What Changed

**Before:**
```xml
<key>ProgramArguments</key>
<array>
  <string>/usr/bin/env</string>
  <string>bash</string>
  <string>-c</string>
  <string>cd /Users/bryan/Documents/btcethdivergence && ... (complex bash string)</string>
</array>
```

**After:**
```xml
<key>ProgramArguments</key>
<array>
  <string>/Users/bryan/.config/btcethdivergence/backfill-runner.sh</string>
</array>
```

Where `backfill-runner.sh` contains:
```bash
#!/bin/bash
cd /Users/bryan/Documents/btcethdivergence
export WORKER_URL="https://btcethdivergence.gn01968711.workers.dev"
export INGEST_TOKEN="$(cat ~/.config/btcethdivergence/ingest-token)"
export SYMBOL="BTCUSDT"
/Users/bryan/.local/bin/node ./node_modules/.bin/tsx scripts/backfill-fetcher.mts >> ~/.config/btcethdivergence/backfill.log 2>&1
```

### Why This Works

1. **Single Plist Argument** — No inline bash string, no XML escaping needed
2. **Explicit Working Directory** — Script starts with `cd /project` before any relative path
3. **Absolute Path to Node** — `/Users/bryan/.local/bin/node` bypasses launchd PATH isolation completely
4. **Readable Shell Script** — Easy to debug, version-control, and modify without XML entity escaping

### Verification

Live test at 2026-08-31 03:27 UTC:
```bash
$ launchctl kickstart gui/$(id -u)/com.btcethdivergence.backfill
$ tail -1 ~/.config/btcethdivergence/backfill.log
reached now; no new candles available
# Exit 0 ✅
```

---

## GSD Executor Constraints & Phase 3 Implications

This phase encountered the **GSD Executor boundary** — tools that orchestrate autonomous agent workflows have hard constraints on what they can execute:

### What GSD Executor CANNOT Do

**❌ Steal or guess secrets**
- Cannot infer `INGEST_TOKEN` or other sensitive values
- Phase 3 is **Owner Action** because fetcher needs the token from env vars or `.dev.vars`
- Executor can read `.dev.vars` from disk, but cannot assume its contents apply

**❌ Execute multi-hour real-time crawls without verification**
- Historical backfill takes 2–4 hours against live Binance + D1
- If something fails mid-crawl (network, rate limit, crash), executor has no way to know or recover
- Only the owner with direct terminal access can judge whether to pause, resume, or retry

**❌ Modify user system configuration (launchd, crontab, system services)**
- Creating or editing `~/Library/LaunchAgents/` files requires user understanding and approval
- If launchd job misconfigures, only owner should unload/load to see live behavior
- Executor cannot run `launchctl unload/load` on behalf of owner

### Phase 3 Design Decision

Because of these constraints, **Phase 3 tasks are all Owner Action**:

1. **Task 03-01: Historical Backfill** — Owner runs the fetcher loop
   - Requires: INGEST_TOKEN from env
   - Duration: 2–4 hours unattended, executor cannot monitor
   - Recovery: Only owner can resume from cursor

2. **Task 03-02: launchd Setup** — Owner creates plist files and loads them
   - Requires: System file permissions, `launchctl` command access
   - Validation: Only owner can test `launchctl kickstart` and interpret results

3. **Task 03-03: Idempotency Re-check** — Owner re-runs backfill over loaded data
   - Verification: Only owner can compare before/after row counts and judge "no duplicates"

### Lesson for Future Phases

When a phase requires:
- Long-running async operations (>30 sec)
- Multi-step human judgment (e.g., "does the log look right?")
- System-level configuration (files, permissions, daemons)
- Sensitive data in environment

**Mark tasks as Owner Action in the plan**, not as autonomous executor tasks. Executor can verify *code* (typecheck, test, build); it cannot verify *runtime behavior* or *operational decisions*.

---

## Key Takeaways

### For launchd Jobs Going Forward

1. **Use external shell scripts**, not inline plist bash strings
2. **Absolute paths** to interpreters and binaries
3. **Explicit cd** at script start, not relying on `<key>WorkingDirectory</key>` alone
4. **Test via `launchctl kickstart`** before waiting for scheduled fire
5. **Monitor logs** for first 7 days to catch any edge cases

### For GSD Phase Planning

1. **Executor-vs-Owner boundary is real** — Know which tasks require human judgment
2. **Secret handling** — Always mark tasks that need env secrets as Owner Action
3. **Long-running ops** — Crawls, deployments, or waiting for external systems need owner approval
4. **System config** — Never assume executor can modify user files without explicit scope

### For Schema & Migration Design (Learned Laterally)

- **D1 batch insert chunking** — 14 rows/statement (98 params) is safe; 16 rows/statement hits limit
- **INSERT OR IGNORE** — Simple, works; better than upsert for idempotency when PK is (symbol, open_time)
- **Cursor management** — Store in seconds; Binance API takes milliseconds; divide conversion is cheap

---

## Blocked Issues That Got Resolved

| Issue | Root Cause | Resolution | Status |
|-------|-----------|-----------|--------|
| BTCUSDT plist exit 512 | Inline bash -c + XML escaping + PATH isolation | External script + absolute paths | ✅ Fixed |
| npx tsx PATH isolation | launchd minimal PATH | Direct `/Users/bryan/.local/bin/node` | ✅ Fixed |
| ETHUSDT plist missing | Original plan had only BTCUSDT template | Created identical script & plist for ETHUSDT | ✅ Fixed |
| Cursor stale behind max kline | Phase 2 left cursor at 2021-05-06; max kline was 2021-07-28 | Owner cleared cursor before Phase 3 crawl | ✅ Fixed |
| SC1 gap verification SQL | Original query used LAG() alias in WHERE (invalid) | Rewrote with subquery; 7 gaps verified live vs Binance | ✅ Fixed |

---

## What Worked Well

1. **Two-stage approach** (historical backfill + daily cron) — Logical separation, easy to debug
2. **Cursor-aware fetcher** — Reusable for both manual crawl and scheduled sync
3. **INSERT OR IGNORE pattern** — Idempotency guaranteed with zero complexity
4. **Binance live gap verification** — Provided proof that data loss is not happening
5. **Early launchd testing** — Caught plist issues immediately via `launchctl kickstart`

---

## Metrics

| Metric | Value |
|--------|-------|
| **Historical data span** | 2021-01-01 00:00 UTC → 2026-08-30 18:00 UTC (5 years 8 months) |
| **Rows per symbol** | 49,613 (1h candlestick, no gaps except 7 Binance-side downtimes) |
| **Backfill duration** | ~1 hour per symbol (2 hours total, rate limits were gentle) |
| **Cron execution time** | <1 sec (fetcher finds "reached now", no new candles) |
| **Storage size** | ~2 MB per symbol (D1 SQLite) |
| **Idempotency test** | Re-run over 1000 rows: 0 inserted, 1000 skipped ✅ |

---

## Recommendations for Phase 4

1. **Records CRUD** will likely need `<created_at>`, `<updated_at>` timestamps — consider using D1 datetime type or Unix seconds (consistent with kline `open_time`)
2. **Tags as JSON array or separate junction table?** — JSON is simpler for owner's private use case; junction table if many-to-many queries needed
3. **No manual launchd needed** — Phase 4 is frontend + API, no new cron jobs
4. **Test Records CRUD early** — Unit tests + API tests before UI, to avoid design churn

---

## Files Modified

- `~/.config/btcethdivergence/backfill-runner.sh` — Created (BTCUSDT script)
- `~/.config/btcethdivergence/backfill-runner-eth.sh` — Created (ETHUSDT script)
- `~/Library/LaunchAgents/com.btcethdivergence.backfill.plist` — Fixed (removed inline bash -c)
- `~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist` — Fixed (replaced with script-based)
- `.planning/phases/03-historical-load-cron-sync/3-VERIFICATION.md` — Updated (SC3 now PASS)

---

## Next Phase Gate

✅ **Phase 3 is COMPLETE** (all SC pass, UAT plan ready)

UAT runs for 7 days (2026-08-31 to 2026-09-06) confirming no failures; then proceed to Phase 4 (Records CRUD).
