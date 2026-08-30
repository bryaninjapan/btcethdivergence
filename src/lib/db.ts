import type { DivergenceRecord, Env, Kline } from '../types';

export async function listRecords(db: D1Database): Promise<DivergenceRecord[]> {
  return db
    .prepare('SELECT * FROM divergence_records ORDER BY start_time DESC')
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
  payload: { start_time: number; end_time: number; type: string; notes?: string; tags?: string },
): Promise<DivergenceRecord> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      'INSERT INTO divergence_records (start_time, end_time, type, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(
      payload.start_time,
      payload.end_time,
      payload.type,
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
  payload: Partial<{ start_time: number; end_time: number; type: string; notes?: string; tags?: string }>,
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
    notes: payload.notes ?? existing.notes,
    tags: payload.tags ?? existing.tags,
    updated_at: Math.floor(Date.now() / 1000),
  };
  await db
    .prepare(
      'UPDATE divergence_records SET start_time = ?, end_time = ?, type = ?, notes = ?, tags = ?, updated_at = ? WHERE id = ?',
    )
    .bind(
      merged.start_time,
      merged.end_time,
      merged.type,
      merged.notes,
      merged.tags,
      merged.updated_at,
      id,
    )
    .run();
  return merged;
}

export type D1Env = Env;