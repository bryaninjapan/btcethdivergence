import { describe, expect, it } from 'vitest';
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { klinesService } from './klines.service';
import { ErrorCode } from '../lib/errors';
import type { Kline } from '../types';

const K1: Kline = { open_time: 100, open: 10, high: 12, low: 9, close: 11, volume: 1 };
const K2: Kline = { open_time: 200, open: 11, high: 13, low: 10, close: 12, volume: 2 };
const K3: Kline = { open_time: 300, open: 12, high: 14, low: 11, close: 13, volume: 3 };
const K4: Kline = { open_time: 400, open: 13, high: 15, low: 12, close: 14, volume: 4 };

const BTC: (Kline & { symbol: string })[] = [
  { ...K1, symbol: 'BTCUSDT' },
  { ...K2, symbol: 'BTCUSDT' },
  { ...K3, symbol: 'BTCUSDT' },
  { ...K4, symbol: 'BTCUSDT' },
];

const ETH: (Kline & { symbol: string })[] = [
  { ...K1, symbol: 'ETHUSDT' },
  { ...K2, symbol: 'ETHUSDT' },
];

describe('klinesService.queryKlines', () => {
  it('returns matching klines for a valid range', async () => {
    const db = createMockD1WithData({ klines: BTC });

    const rows = await klinesService.queryKlines(db as unknown as D1Database, 'BTCUSDT', 100, 400);

    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.open_time)).toEqual([100, 200, 300, 400]);
  });

  it('returns an empty array when no klines fall in the range', async () => {
    const db = createMockD1WithData({ klines: BTC });

    const rows = await klinesService.queryKlines(db as unknown as D1Database, 'BTCUSDT', 500, 600);

    expect(rows).toEqual([]);
  });

  it('returns only in-range klines when the data has gaps', async () => {
    const db = createMockD1WithData({ klines: BTC });

    const rows = await klinesService.queryKlines(db as unknown as D1Database, 'BTCUSDT', 100, 300);

    expect(rows.map((r) => r.open_time)).toEqual([100, 200, 300]);
  });

  it('returns only the requested symbol', async () => {
    const db = createMockD1WithData({ klines: [...BTC, ...ETH] });

    const rows = await klinesService.queryKlines(db as unknown as D1Database, 'ETHUSDT', 100, 400);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.open_time >= 100 && r.open_time <= 400)).toBe(true);
  });

  it('handles a large inclusive time range', async () => {
    const db = createMockD1WithData({ klines: BTC });

    const rows = await klinesService.queryKlines(db as unknown as D1Database, 'BTCUSDT', 0, 1_000_000);

    expect(rows).toHaveLength(4);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('all');

    await expect(
      klinesService.queryKlines(db as unknown as D1Database, 'BTCUSDT', 100, 400),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Database query failed'),
    });
  });
});