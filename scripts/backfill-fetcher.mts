import { decideBackoff, sleep } from '../src/lib/backoff';
import { BinanceError, fetchKlines } from '../src/lib/binance';

const BASE = 1609459200000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

async function fetchWithBackoff(
  symbol: string,
  startTimeMs: number,
): Promise<ReturnType<typeof fetchKlines>> {
  try {
    return await fetchKlines('https://api.binance.com', symbol, startTimeMs, 1000);
  } catch (err) {
    if (!(err instanceof BinanceError)) {
      console.error(`Unexpected fetch error: ${String(err)}`);
      process.exit(1);
    }
    const decision = decideBackoff(err);
    console.log(`${decision.message} (${err.message}); waiting ${decision.waitSeconds ?? 0}s`);
    if (decision.action !== 'retry') {
      process.exit(1);
    }
    await sleep((decision.waitSeconds ?? 0) * 1000);
    try {
      return await fetchKlines('https://api.binance.com', symbol, startTimeMs, 1000);
    } catch (retryErr) {
      console.error(
        `Retry failed: ${retryErr instanceof BinanceError ? retryErr.message : String(retryErr)}`,
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const workerUrl = requireEnv('WORKER_URL');
  const ingestToken = requireEnv('INGEST_TOKEN');
  const symbol = process.env.SYMBOL ?? 'BTCUSDT';
  const startTimeOverride = process.env.START_TIME_OVERRIDE;

  const cursorRes = await fetch(
    `${workerUrl}/api/admin/backfill-cursor?symbol=${encodeURIComponent(symbol)}`,
    { headers: { Authorization: `Bearer ${ingestToken}` } },
  );
  if (!cursorRes.ok) {
    console.error(`Failed to read cursor: HTTP ${cursorRes.status}`);
    process.exit(1);
  }
  const cursorData = (await cursorRes.json()) as { data?: { cursor: number | null } };
  const cursor = cursorData.data?.cursor ?? null;
  const startTimeMs = startTimeOverride
    ? Number(startTimeOverride)
    : cursor === null
      ? BASE
      : (cursor + 3600) * 1000;

  const result = await fetchWithBackoff(symbol, startTimeMs);

  if (result.weight) {
    console.log(`X-MBX-USED-WEIGHT-1M: ${result.weight}`);
  }

  if (result.klines.length === 0) {
    console.log('reached now; no new candles available');
    process.exit(0);
  }

  const ingestRes = await fetch(`${workerUrl}/api/admin/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ingestToken}`,
    },
    body: JSON.stringify({ symbol, klines: result.klines }),
  });
  if (!ingestRes.ok) {
    const envelope = (await ingestRes.json().catch(() => null)) as { error?: string } | null;
    console.error(
      `Ingest failed: HTTP ${ingestRes.status}${envelope?.error ? `: ${envelope.error}` : ''}`,
    );
    process.exit(1);
  }
  const ingestData = (await ingestRes.json()) as {
    data?: { inserted: number; skipped: number; cursor: number };
  };
  const { inserted, skipped, cursor: newCursor } = ingestData.data ?? {
    inserted: 0,
    skipped: 0,
    cursor: 0,
  };
  const done = result.klines.length < 1000;
  console.log(`{ inserted: ${inserted}, skipped: ${skipped}, cursor: ${newCursor} }`);
  console.log(`done: ${done}`);
  process.exit(0);
}

void main();