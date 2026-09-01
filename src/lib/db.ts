import { buildKlineInsertChunks } from './kline-insert';
import { Timestamp } from './timestamp';
import type { DivergenceRecord, Env, Kline } from '../types';

function escapeLikeWildcards(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

export async function listRecords(
  db: D1Database,
  filters: { type?: string; tag?: string } = {},
): Promise<DivergenceRecord[]> {
  // Note (L4 LOW): currently unbounded; fine at single-owner scale. Add LIMIT/OFFSET for pagination when records grow.
  const conditions: string[] = [];
  const params: string[] = [];
  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.tag) {
    conditions.push('tags LIKE ? ESCAPE ?');
    params.push(`%${escapeLikeWildcards(filters.tag)}%`);
    params.push('\\');
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM divergence_records${where} ORDER BY start_time DESC`)
    .bind(...params)
    .all<DivergenceRecord>()
    .then((r) => r.results);
}

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

export async function createRecord(
  db: D1Database,
  payload: { start_time: number; end_time: number; type: string; msb?: string; notes?: string; tags?: string },
): Promise<DivergenceRecord> {
  const now = Timestamp.now().toSeconds();
  const result = await db
    .prepare(
      'INSERT INTO divergence_records (start_time, end_time, type, msb, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(
      payload.start_time,
      payload.end_time,
      payload.type,
      payload.msb ?? 'no',
      payload.notes ?? '',
      payload.tags ?? '',
      now,
      now,
    )
    .first<DivergenceRecord>();
  if (!result) {
    throw new Error('Failed to create record');
  }
  return result;
}

export async function updateRecord(
  db: D1Database,
  id: number,
  payload: Partial<{ start_time: number; end_time: number; type: string; msb?: string; notes?: string; tags?: string }>,
): Promise<DivergenceRecord | null> {
  const existing = await db
    .prepare('SELECT * FROM divergence_records WHERE id = ?')
    .bind(id)
    .first<DivergenceRecord>();
  if (!existing) {
    return null;
  }
  const merged: DivergenceRecord = {
    ...existing,
    ...payload,
    msb: payload.msb ?? existing.msb,
    notes: payload.notes ?? existing.notes,
    tags: payload.tags ?? existing.tags,
    updated_at: Timestamp.now().toSeconds(),
  };
  await db
    .prepare(
      'UPDATE divergence_records SET start_time = ?, end_time = ?, type = ?, msb = ?, notes = ?, tags = ?, updated_at = ? WHERE id = ?',
    )
    .bind(
      merged.start_time,
      merged.end_time,
      merged.type,
      merged.msb,
      merged.notes,
      merged.tags,
      merged.updated_at,
      id,
    )
    .run();
  return merged;
}

export async function deleteRecord(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare('DELETE FROM divergence_records WHERE id = ?').bind(id).run();
  return (res.meta.changes ?? 0) > 0;
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
  now = Timestamp.now().toSeconds(),
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