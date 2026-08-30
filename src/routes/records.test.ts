import { describe, expect, it } from 'vitest';
import records from './records';
import type { DivergenceRecord, Env } from '../types';

/**
 * Minimal fake D1Database recording every prepare()'s SQL and bind()'s
 * params, with configurable run() changes / first() row / all() rows so
 * the whole records CRUD contract can be exercised in-node without D1.
 */
class FakeD1Database {
  public prepares: string[] = [];
  public calls: unknown[][] = [];
  public changes = 0;
  public firstRow: DivergenceRecord | null = null;
  public rows: DivergenceRecord[] = [];

  prepare(sql: string) {
    this.prepares.push(sql);
    const self = this;
    return {
      bind(...params: unknown[]) {
        self.calls.push(params);
        return this;
      },
      run: async () => ({ meta: { changes: self.changes } }),
      first: async <T>() => self.firstRow as T | null,
      all: async <T>() => ({ results: self.rows as T[] }),
    };
  }
}

function makeEnv(db: FakeD1Database): Env {
  return { DB: db as unknown as Env['DB'], INGEST_TOKEN: 'unused' };
}

const EXISTING_RECORD: DivergenceRecord = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'time_lag',
  notes: 'existing',
  tags: 'tag',
  created_at: 0,
  updated_at: 0,
};

describe('records CRUD route contract', () => {
  it('POST valid record → 201, returns the created row, INSERT sent to DB', async () => {
    const db = new FakeD1Database();
    db.firstRow = { ...EXISTING_RECORD, id: 5 };

    const res = await records.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 1600000000,
          end_time: 1600003600,
          type: 'time_lag',
          notes: 'n',
          tags: 't',
        }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(db.firstRow);
    expect(db.prepares.some((sql) => sql.includes('INSERT INTO divergence_records'))).toBe(true);
  });

  it('POST with start_time >= end_time → 400 with SC5 message, no DB write', async () => {
    const db = new FakeD1Database();

    const res = await records.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 1600003600,
          end_time: 1600000000,
          type: 'time_lag',
        }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('start_time must be before end_time');
    expect(db.prepares).toHaveLength(0);
  });

  it('POST with an invalid type → 400 mentioning the enum values, no DB write', async () => {
    const db = new FakeD1Database();

    const res = await records.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 1600000000,
          end_time: 1600003600,
          type: 'nonsense',
        }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/time_lag|structural|opposite/);
    expect(db.prepares).toHaveLength(0);
  });

  it('PUT /api/records/1 with a valid partial update → 200, ok:true', async () => {
    const db = new FakeD1Database();
    db.firstRow = { ...EXISTING_RECORD };

    const res = await records.request(
      '/api/records/1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'x' }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord };
    expect(body.ok).toBe(true);
    expect(body.data.notes).toBe('x');
  });

  it('PUT omitting notes/tags → preserves existing notes/tags (regression: HIGH issue)', async () => {
    const db = new FakeD1Database();
    db.firstRow = { ...EXISTING_RECORD, notes: 'existing notes', tags: 'existing tags' };

    const res = await records.request(
      '/api/records/1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'structural' }), // omit notes and tags
      },
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord };
    expect(body.ok).toBe(true);
    // REGRESSION TEST: notes and tags should NOT be cleared
    expect(body.data.notes).toBe('existing notes');
    expect(body.data.tags).toBe('existing tags');
    expect(body.data.type).toBe('structural');
  });

  it('PUT with reversed times → 400 with SC5 message, no DB write', async () => {
    const db = new FakeD1Database();

    const res = await records.request(
      '/api/records/1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: 1600003600, end_time: 1600000000 }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('start_time must be before end_time');
    expect(db.prepares).toHaveLength(0);
  });

  it('DELETE /api/records/1 with changes=1 → 200, ok:true, binds id 1', async () => {
    const db = new FakeD1Database();
    db.changes = 1;

    const res = await records.request('/api/records/1', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { id: number } };
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(1);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0][0]).toBe(1);
  });

  it('DELETE /api/records/1 with changes=0 → 404, "Record not found"', async () => {
    const db = new FakeD1Database();
    db.changes = 0;

    const res = await records.request('/api/records/1', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Record not found');
  });

  it('DELETE /api/records/abc (non-integer id) → 400, no DB call', async () => {
    const db = new FakeD1Database();

    const res = await records.request('/api/records/abc', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Invalid record id');
    expect(db.prepares).toHaveLength(0);
  });

  it('GET /api/records → 200, returns the configured rows', async () => {
    const db = new FakeD1Database();
    db.rows = [{ ...EXISTING_RECORD }, { ...EXISTING_RECORD, id: 2 }];

    const res = await records.request('/api/records', {}, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(db.rows);
  });
});