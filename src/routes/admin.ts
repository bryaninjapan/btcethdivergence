import { timingSafeEqual } from 'crypto';
import { Context, Hono } from 'hono';
import { BinanceError, fetchKlines } from '../lib/binance';
import { getBackfillCursor, insertKlinesBatch, setBackfillCursor } from '../lib/db';
import { jsonError, jsonOk } from '../lib/response';
import { ingestSchema, validationMessage } from '../lib/validate';
import type { Env } from '../types';

const admin = new Hono<{ Bindings: Env }>();

function auth(c: Context<{ Bindings: Env }>, env: Env): Response | null {
  const expected = `Bearer ${env.INGEST_TOKEN}`;
  const actual = c.req.header('Authorization') || '';

  try {
    // Compare only if lengths match (prevents length-based timing leak)
    if (expected.length !== actual.length) {
      return jsonError('Unauthorized', 401);
    }
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      return jsonError('Unauthorized', 401);
    }
  } catch {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

async function attempt(host: string, symbol: string, startTime: number) {
  const result = await fetchKlines(host, symbol, startTime, 1);
  return { endpoint: host, status: 200, count: result.klines.length, weight: result.weight };
}

admin.get('/api/admin/binance-spike', async (c) => {
  const denied = auth(c, c.env);
  if (denied) return denied;

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  if (!['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
    return jsonError('Invalid symbol', 400);
  }
  const startTime = Date.now() - 2 * 60 * 60 * 1000;

  try {
    const success = await attempt('https://api.binance.com', symbol, startTime);
    return jsonOk(success);
  } catch (err) {
    const first = err instanceof BinanceError ? err : new BinanceError(0, String(err));
    try {
      const fallback = await attempt('https://data-api.binance.vision', symbol, startTime);
      return jsonOk(fallback);
    } catch (err2) {
      const second = err2 instanceof BinanceError ? err2 : new BinanceError(0, String(err2));
      return jsonError(
        `Binance blocked: api.binance.com ${first.status}, data-api.binance.vision ${second.status}`,
        502,
      );
    }
  }
});

admin.post('/api/admin/ingest', async (c) => {
  const denied = auth(c, c.env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${validationMessage(parsed.error)}`, 400);
  }

  try {
    const { symbol, klines } = parsed.data;
    const res = await insertKlinesBatch(c.env.DB, symbol, klines);
    const cursor = klines[klines.length - 1].open_time;
    await setBackfillCursor(c.env.DB, symbol, cursor);
    return jsonOk({ inserted: res.inserted, skipped: res.skipped, cursor });
  } catch (error) {
    console.error(`Ingest failed: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

admin.get('/api/admin/backfill-cursor', async (c) => {
  const denied = auth(c, c.env);
  if (denied) return denied;

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  const cursor = await getBackfillCursor(c.env.DB, symbol);
  return jsonOk({ symbol, cursor, default: 1609459200 });
});

export default admin;