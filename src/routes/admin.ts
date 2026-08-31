import { timingSafeEqual } from 'crypto';
import { Context, Hono } from 'hono';
import { BinanceError, fetchKlines } from '../lib/binance';
import { getBackfillCursor, insertKlinesBatch, setBackfillCursor } from '../lib/db';
import {
  AuthenticationError,
  DatabaseError,
  ExternalServiceError,
  ValidationError,
} from '../lib/errors';
import { ingestSchema, validationMessage } from '../lib/validate';
import type { ApiResponse, Env } from '../types';

const admin = new Hono<{ Bindings: Env }>();

function requireAuth(c: Context<{ Bindings: Env }>, env: Env): void {
  const expected = `Bearer ${env.INGEST_TOKEN}`;
  const actual = c.req.header('Authorization') || '';

  try {
    // Compare only if lengths match (prevents length-based timing leak)
    if (expected.length !== actual.length) {
      throw new AuthenticationError('Invalid authorization header');
    }
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      throw new AuthenticationError('Invalid authorization header');
    }
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('Authorization check failed');
  }
}

async function attempt(host: string, symbol: string, startTime: number) {
  try {
    const result = await fetchKlines(host, symbol, startTime, 1);
    return { endpoint: host, status: 200, count: result.klines.length, weight: result.weight };
  } catch (error) {
    // Convert BinanceError to ExternalServiceError
    const binanceErr =
      error instanceof BinanceError ? error : new BinanceError(0, String(error));
    throw new ExternalServiceError('Binance API', `${binanceErr.message} (status: ${binanceErr.status})`, {
      endpoint: host,
      status: binanceErr.status,
    });
  }
}

admin.get('/api/admin/binance-spike', async (c) => {
  requireAuth(c, c.env);

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  if (!['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
    throw new ValidationError('symbol', 'Symbol must be BTCUSDT or ETHUSDT');
  }

  const startTime = Date.now() - 2 * 60 * 60 * 1000;

  try {
    const success = await attempt('https://api.binance.com', symbol, startTime);
    const response: ApiResponse<typeof success> = {
      ok: true,
      data: success,
    };
    return c.json(response);
  } catch (firstError) {
    // Try fallback endpoint
    try {
      const fallback = await attempt('https://data-api.binance.vision', symbol, startTime);
      const response: ApiResponse<typeof fallback> = {
        ok: true,
        data: fallback,
      };
      return c.json(response);
    } catch (fallbackError) {
      // Both endpoints failed
      const firstMsg =
        firstError instanceof ExternalServiceError
          ? firstError.message
          : String(firstError);
      const fallbackMsg =
        fallbackError instanceof ExternalServiceError
          ? fallbackError.message
          : String(fallbackError);
      throw new ExternalServiceError(
        'Binance API',
        `Both endpoints failed: api.binance.com failed, data-api.binance.vision also failed`,
        {
          primaryError: firstMsg,
          fallbackError: fallbackMsg,
        },
      );
    }
  }
});

admin.post('/api/admin/ingest', async (c) => {
  requireAuth(c, c.env);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('body', 'Invalid JSON body');
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('body', validationMessage(parsed.error));
  }

  try {
    const { symbol, klines } = parsed.data;
    const res = await insertKlinesBatch(c.env.DB, symbol, klines);
    const cursor = klines[klines.length - 1].open_time;
    await setBackfillCursor(c.env.DB, symbol, cursor);

    const response: ApiResponse<{ inserted: number; skipped: number; cursor: number }> = {
      ok: true,
      data: { inserted: res.inserted, skipped: res.skipped, cursor },
    };
    return c.json(response);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      throw error;
    }
    throw new DatabaseError(`Ingest failed: ${String(error)}`);
  }
});

admin.get('/api/admin/backfill-cursor', async (c) => {
  requireAuth(c, c.env);

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';

  try {
    const cursor = await getBackfillCursor(c.env.DB, symbol);
    const response: ApiResponse<{ symbol: string; cursor: number | null; default: number }> = {
      ok: true,
      data: { symbol, cursor, default: 1609459200 },
    };
    return c.json(response);
  } catch (error) {
    throw new DatabaseError(`Failed to get backfill cursor: ${String(error)}`);
  }
});

export default admin;