import { describe, expect, it } from 'vitest';
import klines from './klines';
import type { Env, Kline } from '../types';

/**
 * Minimal fake D1Database that records every bind() call and returns a
 * fixed set of rows. Lets us assert exactly what params reach the query
 * layer (in particular: seconds, not milliseconds).
 */
class FakeD1Database {
  public calls: unknown[][] = [];

  constructor(private readonly rows: Kline[] = []) {}

  prepare(_sql: string) {
    const self = this;
    return {
      bind(...params: unknown[]) {
        self.calls.push(params);
        return {
          all: async <T>() => ({ results: self.rows as unknown as T[] }),
        };
      },
    };
  }
}

function makeEnv(db: FakeD1Database): Env {
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
    const db = new FakeD1Database([SAMPLE_ROW]);
    const startMs = 1627473600000; // -> 1627473600 s
    const endMs = 1627477200000; // -> 1627477200 s

    const res = await klines.request(
      `/api/klines?symbol=BTCUSDT&start=${startMs}&end=${endMs}`,
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: Kline[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([SAMPLE_ROW]);

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
    const db = new FakeD1Database([]);
    // 1627473600999 ms -> 1627473600.999 s -> floored to 1627473600 s
    const res = await klines.request(
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
    const db = new FakeD1Database([]); // simulates no matching rows in D1
    const res = await klines.request(
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
    const db = new FakeD1Database([SAMPLE_ROW]);
    const res = await klines.request(
      '/api/klines?symbol=BTCUSDT&start=not-a-number&end=1627477200000',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it('rejects missing required query params with 400', async () => {
    const db = new FakeD1Database([SAMPLE_ROW]);
    const res = await klines.request('/api/klines?symbol=BTCUSDT', {}, makeEnv(db));

    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it('rejects negative timestamp query params with 400 (Phase 10 behavior change)', async () => {
    const db = new FakeD1Database([SAMPLE_ROW]);
    const res = await klines.request(
      '/api/klines?symbol=BTCUSDT&start=-1000&end=1627477200000',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0); // Guard prevents DB query
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('non-negative');
  });

  it('returns 500 with a generic message when the DB query throws', async () => {
    class ThrowingDb {
      prepare() {
        return {
          bind() {
            return {
              all: async () => {
                throw new Error('D1 connection lost');
              },
            };
          },
        };
      }
    }
    const res = await klines.request(
      '/api/klines?symbol=BTCUSDT&start=1627473600000&end=1627477200000',
      {},
      makeEnv(new ThrowingDb() as unknown as FakeD1Database),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Internal server error');
  });
});
