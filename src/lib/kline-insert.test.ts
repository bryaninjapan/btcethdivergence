import { describe, expect, it } from 'vitest';
import { buildKlineInsertChunks, chunkKlines } from './kline-insert';
import type { Kline } from '../types';

function makeKline(i: number): Kline {
  return {
    open_time: 1609459200 + i * 3600,
    open: 30000 + i,
    high: 30100 + i,
    low: 29900 + i,
    close: 30050 + i,
    volume: 100 + i,
  };
}

describe('chunkKlines', () => {
  it('splits 1000 rows into 72 chunks of at most 14, preserving every row', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => makeKline(i));
    const chunks = chunkKlines(rows, 14);

    expect(chunks).toHaveLength(72);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(14);
    }
    expect(chunks.reduce((sum, c) => sum + c.length, 0)).toBe(1000);
  });
});

describe('buildKlineInsertChunks', () => {
  it('builds 72 statements with bound params <= 98 for 1000 klines, in 2 db.batch() groups', () => {
    const klines = Array.from({ length: 1000 }, (_, i) => makeKline(i));
    const result = buildKlineInsertChunks('BTCUSDT', klines);

    expect(result.totalStmts).toBe(72);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].length).toBe(40);
    expect(result.groups[1].length).toBe(32);

    let maxParams = 0;
    for (const stmt of result.groups.flat()) {
      expect(stmt.params.length % 7).toBe(0);
      maxParams = Math.max(maxParams, stmt.params.length);
    }
    expect(maxParams).toBeLessThanOrEqual(100);
    expect(maxParams).toBe(98);
  });

  it('produces exactly 98 bound params for a full 14-row statement', () => {
    const klines = Array.from({ length: 14 }, (_, i) => makeKline(i));
    const result = buildKlineInsertChunks('ETHUSDT', klines);

    expect(result.totalStmts).toBe(1);
    expect(result.groups[0][0].params).toHaveLength(98);
  });

  it('uses 42 bound params for the final partial 6-row chunk', () => {
    const klines = Array.from({ length: 1000 }, (_, i) => makeKline(i));
    const result = buildKlineInsertChunks('BTCUSDT', klines);

    const lastStmt = result.groups[result.groups.length - 1][result.groups[result.groups.length - 1].length - 1];
    expect(lastStmt.params.length).toBe(42);
  });

  it('embeds the symbol as the first param of every row', () => {
    const klines = [makeKline(0), makeKline(1)];
    const result = buildKlineInsertChunks('BTCUSDT', klines);

    const stmt = result.groups[0][0];
    expect(stmt.sql).toMatch(/^INSERT OR IGNORE INTO klines/);
    expect(stmt.params[0]).toBe('BTCUSDT');
    expect(stmt.params[7]).toBe('BTCUSDT');
  });
});