import { timingSafeEqual } from 'crypto';
import { Context, Hono } from 'hono';
import { AuthenticationError, ValidationError } from '../lib/errors';
import { adminService } from '../services/admin.service';
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
    // Every throw inside try is already AuthenticationError, so rethrow as-is
    if (error instanceof AuthenticationError) throw error;
    // Should never reach here, but keep as safety net
    throw new AuthenticationError('Authorization check failed');
  }
}

admin.get('/api/admin/binance-spike', async (c) => {
  requireAuth(c, c.env);

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  if (!['BTCUSDT', 'ETHUSDT'].includes(symbol)) {
    throw new ValidationError('symbol', 'Symbol must be BTCUSDT or ETHUSDT');
  }

  const startTime = Date.now() - 2 * 60 * 60 * 1000;
  const data = await adminService.probeBinanceReachability(symbol, startTime);

  const response: ApiResponse<typeof data> = {
    ok: true,
    data,
  };
  return c.json(response);
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

  const { symbol, klines } = parsed.data;
  const res = await adminService.processIngest(c.env.DB, symbol, klines);

  const response: ApiResponse<{ inserted: number; skipped: number; cursor: number }> = {
    ok: true,
    data: { inserted: res.inserted, skipped: res.skipped, cursor: res.newCursor },
  };
  return c.json(response);
});

admin.get('/api/admin/backfill-cursor', async (c) => {
  requireAuth(c, c.env);

  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  const cursor = await adminService.getBackfillCursor(c.env.DB, symbol);

  const response: ApiResponse<{ symbol: string; cursor: number | null; default: number }> = {
    ok: true,
    data: { symbol, cursor, default: 1609459200 },
  };
  return c.json(response);
});

export default admin;