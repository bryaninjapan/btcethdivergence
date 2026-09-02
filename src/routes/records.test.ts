import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { errorMiddleware } from '../lib/error-middleware';
import { createMockD1Database, createMockD1WithData, type MockD1Database } from '../lib/test-db';
import records from './records';
import type { DivergenceRecord, Env } from '../types';

/**
 * Route-level integration tests for the records CRUD contract, driven by the
 * shared MockD1 in-memory database (see src/lib/test-db.ts). The mock parses
 * the emitted SQL and applies the same semantics over in-memory rows, so the
 * WHERE / ORDER BY / LIKE shapes the repository emits are asserted directly
 * while still exercising the full request → route → repository → mock path.
 */
function makeEnv(db: MockD1Database): Env {
  return { DB: db as unknown as Env['DB'], INGEST_TOKEN: 'unused' };
}

function createAppWithErrorMiddleware(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.onError((err, c) => errorMiddleware(err, c));
  app.route('/', records);
  return app;
}

// Helper to call records routes with error middleware
async function callRecordsRoute(
  path: string,
  options: RequestInit,
  env: Env
): Promise<Response> {
  const app = createAppWithErrorMiddleware();
  return app.request(path, options, env);
}

const EXISTING_RECORD: DivergenceRecord = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'btc_hh_eth_lh',
  msb: 'yes',
  notes: 'existing',
  tags: 'tag',
  created_at: 0,
  updated_at: 0,
};

describe('records CRUD route contract', () => {
  it('POST valid record → 201, returns the created row, INSERT sent to DB', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
      '/api/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 1600000000,
          end_time: 1600003600,
          type: 'btc_hh_eth_lh',
          notes: 'n',
          tags: 't',
        }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord };
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      notes: 'n',
      tags: 't',
      msb: 'no',
    });
    expect(db.prepares.some((sql) => sql.includes('INSERT INTO divergence_records'))).toBe(true);
    // Verify bound params include the exact values (LOW issue L5 regression)
    expect(db.calls.some((params) => params.includes(1600000000))).toBe(true);
    expect(db.calls.some((params) => params.includes(1600003600))).toBe(true);
    expect(db.calls.some((params) => params.includes('btc_hh_eth_lh'))).toBe(true);
  });

  it('POST with start_time >= end_time → 400 with SC5 message, no DB write', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
      '/api/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 1600003600,
          end_time: 1600000000,
          type: 'btc_hh_eth_lh',
        }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('start_time must be before end_time');
    expect(db.prepares).toHaveLength(0);
  });

  it('POST with an invalid type → 400 mentioning the enum values, no DB write', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
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
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/btc_hh_eth_lh|btc_lh_eth_hh|btc_ll_eth_hl|btc_hl_eth_ll/);
    expect(db.prepares).toHaveLength(0);
  });

  it('PUT /api/records/1 with a valid partial update → 200, ok:true', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING_RECORD }] });

    const res = await callRecordsRoute(
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
    const db = createMockD1WithData({
      divergence_records: [{ ...EXISTING_RECORD, notes: 'existing notes', tags: 'existing tags' }],
    });

    const res = await callRecordsRoute(
      '/api/records/1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'btc_lh_eth_hh' }), // omit notes and tags
      },
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord };
    expect(body.ok).toBe(true);
    // REGRESSION TEST: notes and tags should NOT be cleared
    expect(body.data.notes).toBe('existing notes');
    expect(body.data.tags).toBe('existing tags');
    expect(body.data.type).toBe('btc_lh_eth_hh');
  });

  it('PUT with reversed times → 400 with SC5 message, no DB write', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
      '/api/records/1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: 1600003600, end_time: 1600000000 }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('start_time must be before end_time');
    expect(db.prepares).toHaveLength(0);
  });

  it('DELETE /api/records/1 with changes=1 → 200, ok:true, binds id 1', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING_RECORD }] });

    const res = await callRecordsRoute('/api/records/1', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { id: number } };
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(1);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0][0]).toBe(1);
  });

  it('DELETE /api/records/1 with changes=0 → 404, "Record not found"', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute('/api/records/1', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('not found');
  });

  it('DELETE /api/records/abc (non-integer id) → 400, no DB call', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute('/api/records/abc', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('Record ID must be');
    expect(db.prepares).toHaveLength(0);
  });

  it('PUT /api/records/0x10 (hex notation) → 400, rejects non-decimal formats (LOW issue)', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
      '/api/records/0x10',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'btc_lh_eth_hh' }),
      },
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('Record ID must be');
    expect(db.prepares).toHaveLength(0);
  });

  it('DELETE /api/records/1e3 (scientific notation) → 400, rejects non-decimal (LOW issue)', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute('/api/records/1e3', { method: 'DELETE' }, makeEnv(db));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toContain('Record ID must be');
    expect(db.prepares).toHaveLength(0);
  });

  it('GET /api/records → 200, returns the configured rows', async () => {
    const rows = [{ ...EXISTING_RECORD }, { ...EXISTING_RECORD, id: 2 }];
    const db = createMockD1WithData({ divergence_records: rows });

    const res = await callRecordsRoute('/api/records', {}, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(rows);
  });

  it('GET /api/records?tag=50%25 (percent sign in tag) → returns exact match only, not wildcards', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING_RECORD, id: 1, tags: '50%_profit' },
        { ...EXISTING_RECORD, id: 2, tags: '50profit' },
      ],
    });

    const res = await callRecordsRoute('/api/records?tag=50%25', {}, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].tags).toBe('50%_profit');
  });

  it('GET /api/records?tag=v1_beta (underscore in tag) → returns exact match only', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING_RECORD, id: 1, tags: 'v1_beta' },
        { ...EXISTING_RECORD, id: 2, tags: 'v1beta' },
        { ...EXISTING_RECORD, id: 3, tags: 'v1Xbeta' },
      ],
    });

    const res = await callRecordsRoute('/api/records?tag=v1_beta', {}, makeEnv(db));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: DivergenceRecord[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].tags).toBe('v1_beta');
  });
});

describe('records filter contract (REC-05, REC-06)', () => {
  it('GET /api/records?type=btc_lh_eth_hh → filters by type, no tags LIKE', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING_RECORD }] });

    const res = await callRecordsRoute('/api/records?type=btc_lh_eth_hh', {}, makeEnv(db));

    expect(res.status).toBe(200);
    expect(db.prepares[0]).toContain('WHERE type = ?');
    expect(db.prepares[0]).toContain('ORDER BY start_time DESC');
    expect(db.prepares[0]).not.toContain('tags LIKE');
    expect(db.calls[0]).toContain('btc_lh_eth_hh');
  });

  it('GET /api/records?tag=btc → tags LIKE partial match with %btc% bound', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING_RECORD }] });

    const res = await callRecordsRoute('/api/records?tag=btc', {}, makeEnv(db));

    expect(res.status).toBe(200);
    expect(db.prepares[0]).toContain('tags LIKE ?');
    expect(db.calls[0]).toContain('%btc%');
  });

  it('GET /api/records?type=btc_lh_eth_hh&tag=btc → both conditions ANDed with both params bound', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING_RECORD }] });

    const res = await callRecordsRoute(
      '/api/records?type=btc_lh_eth_hh&tag=btc',
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(200);
    expect(db.prepares[0]).toContain('type = ?');
    expect(db.prepares[0]).toContain('tags LIKE ?');
    expect(db.prepares[0]).toContain('AND');
    expect(db.calls[0]).toContain('btc_lh_eth_hh');
    expect(db.calls[0]).toContain('%btc%');
  });

  it('GET /api/records?type=bogus → 400 mentioning the enum, no DB call', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute('/api/records?type=bogus', {}, makeEnv(db));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/btc_hh_eth_lh|btc_lh_eth_hh|btc_ll_eth_hl|btc_hl_eth_ll/);
    expect(db.prepares).toHaveLength(0);
  });

  it('GET /api/records?tag=<201 chars> → 400 (max 200), no DB call', async () => {
    const db = createMockD1Database();

    const res = await callRecordsRoute(
      `/api/records?tag=${'a'.repeat(201)}`,
      {},
      makeEnv(db),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(db.prepares).toHaveLength(0);
  });
});