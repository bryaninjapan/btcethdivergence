import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { errorMiddleware } from '../lib/error-middleware';
import { createMockD1Database } from '../lib/test-db';
import admin from './admin';
import type { Env, Kline } from '../types';

const INGEST_TOKEN = 'super-secret-token-value-1234567890';

function makeEnv(db: unknown): Env {
  return { DB: db as Env['DB'], INGEST_TOKEN };
}

function createApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.onError((err, c) => errorMiddleware(err, c));
  app.route('/', admin);
  return app;
}

function okResponse(rows: unknown[], weight: string | null = null): Response {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name === 'X-MBX-USED-WEIGHT-1M' ? weight : null),
    },
    json: async () => rows,
  } as unknown as Response;
}

const SAMPLE_KLINE_TUPLE = [
  1627473600000, '30000', '30100', '29900', '30050', '100', 1627473600000, '30000', '100', '0', '0', '0',
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/admin/binance-spike — route contract', () => {
  it('returns the primary probe result with a valid token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([SAMPLE_KLINE_TUPLE], '80')));

    const app = createApp();
    const res = await app.request(
      '/api/admin/binance-spike?symbol=BTCUSDT',
      { headers: { Authorization: `Bearer ${INGEST_TOKEN}` } },
      makeEnv(createMockD1Database()),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { endpoint: string; count: number } };
    expect(body.ok).toBe(true);
    expect(body.data.endpoint).toBe('https://api.binance.com');
    expect(body.data.count).toBe(1);
  });

  it('rejects an invalid symbol with 400', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const app = createApp();
    const res = await app.request(
      '/api/admin/binance-spike?symbol=SOLUSDT',
      { headers: { Authorization: `Bearer ${INGEST_TOKEN}` } },
      makeEnv(createMockD1Database()),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('requires authentication (401 without token)', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const app = createApp();
    const res = await app.request(
      '/api/admin/binance-spike?symbol=BTCUSDT',
      {},
      makeEnv(createMockD1Database()),
    );

    expect(res.status).toBe(401);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/ingest — route contract', () => {
  const K1: Kline = { open_time: 100, open: 10, high: 12, low: 9, close: 11, volume: 1 };
  const K2: Kline = { open_time: 200, open: 11, high: 13, low: 10, close: 12, volume: 2 };

  it('inserts klines and returns inserted/skipped/cursor', async () => {
    const db = createMockD1Database();
    const app = createApp();

    const res = await app.request(
      '/api/admin/ingest',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${INGEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: 'BTCUSDT', klines: [K1, K2] }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { inserted: number; skipped: number; cursor: number };
    };
    expect(body.ok).toBe(true);
    // Route contract: cursor is derived from processIngest's newCursor.
    expect(body.data).toEqual({ inserted: 2, skipped: 0, cursor: K2.open_time });
    expect(db.rowsOf('klines')).toHaveLength(2);
  });

  it('rejects an invalid ingest body with 400 before touching the DB', async () => {
    const db = createMockD1Database();
    const app = createApp();

    const res = await app.request(
      '/api/admin/ingest',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${INGEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: 'BTCUSDT', klines: [] }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(db.rowsOf('klines')).toHaveLength(0);
  });

  it('requires authentication (401 without token)', async () => {
    const app = createApp();
    const res = await app.request(
      '/api/admin/ingest',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'BTCUSDT', klines: [K1] }),
      },
      makeEnv(createMockD1Database()),
    );

    expect(res.status).toBe(401);
  });
});