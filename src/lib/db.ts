import { buildKlineInsertChunks } from './kline-insert';
import { TemporalConverter } from '../domains/temporal-api';
import type { Env, Kline } from '../types';

export async function queryKlines(
  db: D1Database,
  symbol: string,
  start: number,
  end: number,
): Promise<Kline[]> {
  return db
    .prepare(
      'SELECT open_time, open, high, low, close, volume FROM klines WHERE symbol = ? AND open_time BETWEEN ? AND ? ORDER BY open_time',
    )
    .bind(symbol, start, end)
    .all<Kline>()
    .then((r) => r.results);
}

export async function getBackfillCursor(db: D1Database, symbol: string): Promise<number | null> {
  return db
    .prepare('SELECT cursor_open_time FROM backfill_state WHERE symbol = ?')
    .bind(symbol)
    .first<number | null>('cursor_open_time');
}

export async function setBackfillCursor(
  db: D1Database,
  symbol: string,
  cursor: number,
  now = TemporalConverter.dateToSec(new Date()),
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO backfill_state (symbol, cursor_open_time, updated_at) VALUES (?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET cursor_open_time = excluded.cursor_open_time, updated_at = excluded.updated_at',
    )
    .bind(symbol, cursor, now)
    .run();
}

export async function insertKlinesBatch(
  db: D1Database,
  symbol: string,
  klines: Kline[],
): Promise<{ inserted: number; skipped: number }> {
  const { groups } = buildKlineInsertChunks(symbol, klines);
  let inserted = 0;
  for (const group of groups) {
    const results = await db.batch(
      group.map((stmt) => db.prepare(stmt.sql).bind(...stmt.params)),
    );
    for (const result of results) {
      inserted += result.meta.changes;
    }
  }
  return { inserted, skipped: klines.length - inserted };
}