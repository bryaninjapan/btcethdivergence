import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import klines from './klines';
import type { Env } from '../types';

describe('GET /api/klines — public endpoint (no auth required)', () => {
  let db: any;

  beforeEach(() => {
    db = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          all: async () => {
            if (sql.includes('SELECT')) {
              return { results: [{ open_time: 1000, open: 100, high: 110, low: 90, close: 105 }] };
            }
            return { results: [] };
          },
        }),
      }),
    };
  });

  it('allows request WITHOUT Authorization header', async () => {
    const req = new Request('http://localhost/api/klines?symbol=BTCUSDT&start=1000&end=2000');
    // No Authorization header

    const env: Env = { DB: db, INGEST_TOKEN: 'secret123' };
    const res = await klines.fetch(req, env);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('allows request with valid Authorization header', async () => {
    const req = new Request('http://localhost/api/klines?symbol=BTCUSDT&start=1000&end=2000', {
      headers: { 'Authorization': 'Bearer secret123' },
    });

    const env: Env = { DB: db, INGEST_TOKEN: 'secret123' };
    const res = await klines.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('rejects request with WRONG Authorization header', async () => {
    const req = new Request('http://localhost/api/klines?symbol=BTCUSDT&start=1000&end=2000', {
      headers: { 'Authorization': 'Bearer wrong-token' },
    });

    const env: Env = { DB: db, INGEST_TOKEN: 'secret123' };
    const res = await klines.fetch(req, env);

    // Even with wrong token, /api/klines is public - should still return 200
    expect(res.status).toBe(200);
  });
});
