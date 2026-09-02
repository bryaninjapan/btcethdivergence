import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import klines from './klines';
import { errorMiddleware } from '../lib/error-middleware';
import { createMockD1Database, createMockD1WithData, type MockD1Database } from '../lib/test-db';
import type { Env, Kline } from '../types';

/**
 * Mount `klines` under a Hono instance with the same error-handling wiring
 * used in production (src/index.ts registers `app.onError` before
 * `app.route('/', klines)`). Testing the bare `klines` router in isolation
 * bypasses that `onError` handler entirely, so thrown AppErrors
 * (ValidationError, DatabaseError) fall through to Hono's default 500
 * plain-text response instead of the structured JSON envelope the route
 * actually produces in production.
 */
const app = new Hono<{ Bindings: Env }>();
app.onError((err, c) => errorMiddleware(err, c));
app.route('/', klines);

/**
 * The shared MockD1 in-memory database records every bind() call and applies
 * the klines WHERE/BETWEEN semantics over its seeded rows. Lets us assert
 * exactly what params reach the query layer (in particular: seconds, not
 * milliseconds).
 */
function makeEnv(db: MockD1Database): Env {
  return { DB: db as unknown as Env['DB'], INGEST_TOKEN: 'unused' };
}

const SAMPLE_ROW: Kline = {
  open_time: 1627473600,
  open: 30000,
  high: 30100,
  low: 29900,
  close: 30050,
  volume: 100,
};

describe('GET /api/klines — timestamp conversion (Phase 1 CR-01)', () => {
  it('converts millisecond query params to seconds before querying the DB', async () => {
    const db = createMockD1WithData({ klines: [{ symbol: "BTCUSDT", ...SAMPLE_ROW }] });
    const startMs = 1627473600000; // -> 1627473600 s
    const endMs = 1627477200000; // -> 1627477200 s

    const res = await app.request(
      `/api/klines?symbol=BTCUSDT&start=${startMs}&end=${endMs}`,
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: Kline[] };
    expect(body.ok).toBe(true);
    // MockD1 stores full rows (incl. the symbol column used for filtering),
    // so compare against the kline projection fields rather than the seed.
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject(SAMPLE_ROW);

    // The critical assertion: DB must receive SECONDS, not the raw ms input.
    expect(db.calls).toHaveLength(1);
    const [symbolParam, startParam, endParam] = db.calls[0];
    expect(symbolParam).toBe('BTCUSDT');
    expect(startParam).toBe(1627473600);
    expect(endParam).toBe(1627477200);
    // Guard against the original bug: raw ms values must never be forwarded.
    expect(startParam).not.toBe(startMs);
    expect(endParam).not.toBe(endMs);
  });

  it('floors fractional millisecond timestamps when converting to seconds', async () => {
    const db = createMockD1Database();
    // 1627473600999 ms -> 1627473600.999 s -> floored to 1627473600 s
    const res = await app.request(
      '/api/klines?symbol=ETHUSDT&start=1627473600999&end=1627477200500',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const [, startParam, endParam] = db.calls[0];
    expect(startParam).toBe(1627473600);
    expect(endParam).toBe(1627477200);
  });

  it('returns an empty array (not an error) when the ms range maps outside stored data', async () => {
    const db = createMockD1Database(); // simulates no matching rows in D1
    const res = await app.request(
      '/api/klines?symbol=BTCUSDT&start=9999999999000&end=9999999999999',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: Kline[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('rejects non-numeric timestamp query params with 400', async () => {
    const db = createMockD1WithData({ klines: [{ symbol: "BTCUSDT", ...SAMPLE_ROW }] });
    const res = await app.request(
      '/api/klines?symbol=BTCUSDT&start=not-a-number&end=1627477200000',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(db.calls).toHaveLength(0);
  });

  it('rejects missing required query params with 400', async () => {
    const db = createMockD1WithData({ klines: [{ symbol: "BTCUSDT", ...SAMPLE_ROW }] });
    const res = await app.request('/api/klines?symbol=BTCUSDT', {}, makeEnv(db));

    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it('rejects negative timestamp query params with 400 (Phase 10 behavior change)', async () => {
    const db = createMockD1WithData({ klines: [{ symbol: "BTCUSDT", ...SAMPLE_ROW }] });
    const res = await app.request(
      '/api/klines?symbol=BTCUSDT&start=-1000&end=1627477200000',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0); // Guard prevents DB query
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(body.error?.message).toContain('non-negative');
  });

  it('returns 500 with a generic message when the DB query throws', async () => {
    const db = createMockD1Database();
    db.failNext('all');
    const res = await app.request(
      '/api/klines?symbol=BTCUSDT&start=1627473600000&end=1627477200000',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      ok: boolean;
      error?: { code: string; message: string; details?: unknown };
    };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('DATABASE_ERROR');
    // Generic, sanitized message — must never leak the original driver error.
    expect(body.error?.message).not.toContain('D1 connection lost');
    expect(body.error?.details).toBeUndefined();
  });
});
