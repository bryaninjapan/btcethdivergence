#!/bin/bash
# Template for ~/.config/btcethdivergence/backfill-runner.sh
# USAGE: After creating Service Token in Cloudflare:
#   1. Copy this file to ~/.config/btcethdivergence/backfill-runner.sh
#   2. Replace <CF_CLIENT_ID> and <CF_CLIENT_SECRET> with actual values
#   3. chmod +x ~/.config/btcethdivergence/backfill-runner.sh

cd /Users/bryan/Documents/btcethdivergence
export WORKER_URL="https://btcethdivergence.bryanlab.cc"
export INGEST_TOKEN="$(cat ~/.config/btcethdivergence/ingest-token)"
export CF_CLIENT_ID="<paste-CF_CLIENT_ID-here>"
export CF_CLIENT_SECRET="<paste-CF_CLIENT_SECRET-here>"
export SYMBOL="BTCUSDT"
/Users/bryan/.local/bin/node ./node_modules/.bin/tsx scripts/backfill-fetcher.mts >> ~/.config/btcethdivergence/backfill.log 2>&1
