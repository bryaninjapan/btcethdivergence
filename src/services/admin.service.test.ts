import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { adminService } from './admin.service';
import { ErrorCode } from '../lib/errors';
import type { Kline } from '../types';

const K1: Kline = { open_time: 100, open: 10, high: 12, low: 9, close: 11, volume: 1 };
const K2: Kline = { open_time: 200, open: 11, high: 13, low: 10, close: 12, volume: 2 };

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

function failResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => [],
  } as unknown as Response;
}

const SAMPLE_KLINE_TUPLE = [
  1627473600000, '30000', '30100', '29900', '30050', '100', 1627473600000, '30000', '100', '0', '0', '0',
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adminService.getBackfillCursor', () => {
  it('returns null when no cursor is stored', async () => {
    const db = createMockD1Database();

    const cursor = await adminService.getBackfillCursor(db as unknown as D1Database, 'BTCUSDT');

    expect(cursor).toBeNull();
  });

  it('returns the stored cursor after setBackfillCursor', async () => {
    const db = createMockD1Database();
    await adminService.setBackfillCursor(db as unknown as D1Database, 'BTCUSDT', 1609459200);

    const cursor = await adminService.getBackfillCursor(db as unknown as D1Database, 'BTCUSDT');

    expect(cursor).toBe(1609459200);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('first');

    await expect(
      adminService.getBackfillCursor(db as unknown as D1Database, 'BTCUSDT'),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to get backfill cursor'),
    });
  });
});

describe('adminService.setBackfillCursor', () => {
  it('persists the cursor for a symbol', async () => {
    const db = createMockD1Database();

    await adminService.setBackfillCursor(db as unknown as D1Database, 'ETHUSDT', 12345);

    const rows = db.rowsOf('backfill_state');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: 'ETHUSDT', cursor_open_time: 12345 });
  });

  it('upserts (updates in place) when the symbol already has a cursor', async () => {
    const db = createMockD1WithData({
      backfill_state: [{ symbol: 'BTCUSDT', cursor_open_time: 100, updated_at: 1 }],
    });

    await adminService.setBackfillCursor(db as unknown as D1Database, 'BTCUSDT', 200);

    const rows = db.rowsOf('backfill_state');
    expect(rows).toHaveLength(1);
    expect(rows[0].cursor_open_time).toBe(200);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('run');

    await expect(
      adminService.setBackfillCursor(db as unknown as D1Database, 'BTCUSDT', 123),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to set backfill cursor'),
    });
  });
});

describe('adminService.probeBinanceReachability', () => {
  it('returns the primary endpoint result when it succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([SAMPLE_KLINE_TUPLE], '100')));

    const result = await adminService.probeBinanceReachability('BTCUSDT', 1627473600000);

    expect(result).toEqual({
      endpoint: 'https://api.binance.com',
      status: 200,
      count: 1,
      weight: '100',
    });
    const fetchUrl = String((vi.mocked(fetch) as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(fetchUrl).toContain('api.binance.com/api/v3/klines');
    expect(fetchUrl).toContain('symbol=BTCUSDT');
    expect(fetchUrl).toContain('startTime=1627473600000');
  });

  it('falls back to data-api.binance.vision when the primary endpoint fails', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(failResponse(429))
      .mockResolvedValueOnce(okResponse([SAMPLE_KLINE_TUPLE], null));

    vi.stubGlobal('fetch', mockFetch);

    const result = await adminService.probeBinanceReachability('ETHUSDT', 1627473600000);

    expect(result.endpoint).toBe('https://data-api.binance.vision');
    expect(result.status).toBe(200);
    expect(result.count).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws ExternalServiceError when both endpoints fail', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(failResponse(429))
      .mockResolvedValueOnce(failResponse(418));

    vi.stubGlobal('fetch', mockFetch);

    await expect(
      adminService.probeBinanceReachability('BTCUSDT', 1627473600000),
    ).rejects.toMatchObject({
      code: ErrorCode.SERVICE_ERROR,
      message: expect.stringContaining('Both endpoints failed'),
    });
  });
});

describe('adminService.processIngest', () => {
  it('inserts klines, advances the cursor, and reports inserted/skipped/newCursor', async () => {
    const db = createMockD1Database();

    const res = await adminService.processIngest(db as unknown as D1Database, 'BTCUSDT', [K1, K2]);

    expect(res).toEqual({ inserted: 2, skipped: 0, newCursor: K2.open_time });
    expect(db.rowsOf('klines')).toHaveLength(2);
    const state = db.rowsOf('backfill_state');
    expect(state[0]).toMatchObject({ symbol: 'BTCUSDT', cursor_open_time: K2.open_time });
  });

  it('preserves skipped counts for already-present klines', async () => {
    const db = createMockD1WithData({
      klines: [{ symbol: 'BTCUSDT', ...K1 }],
    });

    const res = await adminService.processIngest(db as unknown as D1Database, 'BTCUSDT', [K1, K2]);

    expect(res).toEqual({ inserted: 1, skipped: 1, newCursor: K2.open_time });
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('batch');

    await expect(
      adminService.processIngest(db as unknown as D1Database, 'BTCUSDT', [K1]),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Ingest failed'),
    });
  });
});