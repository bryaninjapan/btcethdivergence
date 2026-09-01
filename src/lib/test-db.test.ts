import { describe, expect, it } from 'vitest';
import { createMockD1Database, createMockD1WithData } from './test-db';
import { buildKlineInsertChunks } from './kline-insert';
import type { DivergenceRecord, Kline } from '../types';

const RECORD: DivergenceRecord = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'btc_hh_eth_lh',
  msb: 'no',
  notes: 'first',
  tags: 'btc',
  created_at: 1,
  updated_at: 1,
};

describe('createMockD1Database — prepare().bind()', () => {
  it('all() returns rows filtered by the SQL WHERE clause', async () => {
    const db = createMockD1Database();
    db.setRows('divergence_records', [
      RECORD,
      { ...RECORD, id: 2, type: 'btc_hl_eth_ll', tags: 'eth' },
      { ...RECORD, id: 3, type: 'btc_hh_eth_lh', tags: 'both' },
    ]);

    const res = await db
      .prepare(
        'SELECT * FROM divergence_records WHERE type = ? ORDER BY start_time DESC',
      )
      .bind('btc_hh_eth_lh')
      .all<DivergenceRecord>();

    expect(res.results).toHaveLength(2);
    expect(res.results?.every((r) => r.type === 'btc_hh_eth_lh')).toBe(true);
  });

  it('all() applies tags LIKE ? ESCAPE ? with escape-aware wildcard matching', async () => {
    const db = createMockD1Database();
    db.setRows('divergence_records', [
      RECORD,
      { ...RECORD, id: 2, tags: '50%_profit' },
      { ...RECORD, id: 3, tags: '50profit' },
      { ...RECORD, id: 4, tags: 'v1_beta' },
    ]);

    const res = await db
      .prepare('SELECT * FROM divergence_records WHERE tags LIKE ? ESCAPE ?')
      .bind('%50\\%\\_profit%', '\\')
      .all<DivergenceRecord>();

    expect(res.results).toHaveLength(1);
    expect(res.results?.[0].tags).toBe('50%_profit');
  });

  it('all() combines type = ? AND tags LIKE ? in one query', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        RECORD,
        { ...RECORD, id: 2, type: 'structural', tags: 'btc' },
        { ...RECORD, id: 3, type: 'time_lag', tags: 'eth' },
      ],
    });

    const res = await db
      .prepare(
        'SELECT * FROM divergence_records WHERE type = ? AND tags LIKE ? ESCAPE ? ORDER BY start_time DESC',
      )
      .bind('btc_hh_eth_lh', '%btc%', '\\')
      .all<DivergenceRecord>();

    expect(res.results).toHaveLength(1);
    expect(res.results?.[0].id).toBe(1);
  });

  it('first() returns the single matching row', async () => {
    const db = createMockD1WithData({ divergence_records: [RECORD] });

    const row = await db
      .prepare('SELECT * FROM divergence_records WHERE id = ?')
      .bind(1)
      .first<DivergenceRecord>();

    expect(row?.id).toBe(1);
    expect(row?.tags).toBe('btc');
  });

  it('first() returns null when no row matches', async () => {
    const db = createMockD1WithData({ divergence_records: [RECORD] });

    const row = await db
      .prepare('SELECT * FROM divergence_records WHERE id = ?')
      .bind(999)
      .first<DivergenceRecord>();

    expect(row).toBeNull();
  });

  it('first(colName) returns the single column value', async () => {
    const db = createMockD1WithData({
      backfill_state: [{ symbol: 'BTCUSDT', cursor_open_time: 1609459200, updated_at: 1 }],
    });

    const cursor = await db
      .prepare('SELECT cursor_open_time FROM backfill_state WHERE symbol = ?')
      .bind('BTCUSDT')
      .first<number>('cursor_open_time');

    expect(cursor).toBe(1609459200);
  });

  it('run() persists INSERT rows and reports meta.changes', async () => {
    const db = createMockD1Database();

    const res = await db
      .prepare(
        'INSERT INTO divergence_records (start_time, end_time, type, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(1600000000, 1600003600, 'btc_hh_eth_lh', '', '', 1, 1)
      .run();

    expect(res.meta.changes).toBe(1);
    expect(db.rowsOf('divergence_records')).toHaveLength(1);
  });

  it('run() reports changes=0 for a DELETE that matched nothing', async () => {
    const db = createMockD1WithData({ divergence_records: [RECORD] });

    const res = await db.prepare('DELETE FROM divergence_records WHERE id = ?').bind(999).run();

    expect(res.meta.changes).toBe(0);
    expect(db.rowsOf('divergence_records')).toHaveLength(1);
  });

  it('tracks every prepare() sql and bind() params for call-sequence assertions', async () => {
    const db = createMockD1Database();
    await db.prepare('SELECT * FROM divergence_records WHERE id = ?').bind(7).all();

    expect(db.prepares[0]).toContain('WHERE id = ?');
    expect(db.calls).toEqual([[7]]);
  });
});

describe('createMockD1Database — batch()', () => {
  it('executes an array of prepared statements (as db.ts passes them) and returns changes', async () => {
    const db = createMockD1Database();
    const { groups } = buildKlineInsertChunks('BTCUSDT', [
      { open_time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { open_time: 2, open: 1.5, high: 3, low: 1, close: 2.5, volume: 20 },
    ]);

    const results = await db.batch(
      groups[0].map((stmt) => db.prepare(stmt.sql).bind(...stmt.params)),
    );

    expect(results).toHaveLength(1);
    expect(results[0].meta.changes).toBe(2);
    expect(db.rowsOf('klines')).toHaveLength(2);
  });

  it('skips INSERT OR IGNORE rows whose (symbol, open_time) already exists', async () => {
    const db = createMockD1WithData({
      klines: [{ symbol: 'BTCUSDT', open_time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
    });
    const dup: Kline = { open_time: 1, open: 9, high: 9, low: 9, close: 9, volume: 9 };
    const fresh: Kline = { open_time: 2, open: 2, high: 3, low: 1, close: 2.5, volume: 20 };
    const { groups } = buildKlineInsertChunks('BTCUSDT', [dup, fresh]);

    const results = await db.batch(
      groups[0].map((stmt) => db.prepare(stmt.sql).bind(...stmt.params)),
    );

    expect(results[0].meta.changes).toBe(1);
    expect(db.rowsOf('klines')).toHaveLength(2);
  });
});

describe('createMockD1Database — failure injection', () => {
  it('failNext(all) makes the next all() throw', async () => {
    const db = createMockD1WithData({ divergence_records: [RECORD] });
    db.failNext('all');

    await expect(db.prepare('SELECT * FROM divergence_records').bind().all()).rejects.toThrow(
      'simulated all failure',
    );
  });

  it('failNext(batch) makes the next batch() throw', async () => {
    const db = createMockD1Database();
    db.failNext('batch');

    await expect(db.batch([])).rejects.toThrow('simulated batch failure');
  });
});

describe('createMockD1Database — smoke test wiring', () => {
  it('createMockD1Database() drives a real db.ts repository call with call tracking', async () => {
    const db = createMockD1Database();
    const { queryKlines } = await import('./db');

    const rows = await queryKlines(db as unknown as D1Database, 'BTCUSDT', 10, 20);

    expect(rows).toEqual([]);
    expect(db.prepares[0]).toContain('SELECT open_time, open, high, low, close, volume FROM klines');
    expect(db.calls).toEqual([['BTCUSDT', 10, 20]]);
  });

  it('insertKlinesBatch through the mock reports inserted/skipped correctly', async () => {
    const db = createMockD1WithData({
      klines: [{ symbol: 'BTCUSDT', open_time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
    });
    const { insertKlinesBatch } = await import('./db');
    const klines: Kline[] = [
      { open_time: 1, open: 9, high: 9, low: 9, close: 9, volume: 9 },
      { open_time: 2, open: 2, high: 3, low: 1, close: 2.5, volume: 20 },
    ];

    const res = await insertKlinesBatch(db as unknown as D1Database, 'BTCUSDT', klines);

    expect(res).toEqual({ inserted: 1, skipped: 1 });
  });
});