import { describe, expect, it } from 'vitest';
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { RecordsRepository, computeRecordStats } from './RecordsRepository';
import { ErrorCode, ValidationError } from '../lib/errors';
import type { CreateRecordInput } from '../lib/validate';
import type { DivergenceRecord } from '../types';

const EXISTING: DivergenceRecord = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'btc_hh_eth_lh',
  msb: 'no',
  notes: 'existing notes',
  tags: 'existing tags',
  created_at: 1,
  updated_at: 1,
};

function repo(db: ReturnType<typeof createMockD1Database>, now?: () => number): RecordsRepository {
  return new RecordsRepository(db as unknown as D1Database, now);
}

describe('RecordsRepository.create', () => {
  it('creates a record from valid input and returns it', async () => {
    const db = createMockD1Database();

    const record = await repo(db).create({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      msb: 'no',
      notes: 'hello',
      tags: 'btc,eth',
    });

    expect(record).toMatchObject({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      notes: 'hello',
      tags: 'btc,eth',
    });
    expect(record.id).toBe(1);
    expect(db.rowsOf('divergence_records')).toHaveLength(1);
  });

  it('succeeds with very long notes (route already validated the 1000-char cap)', async () => {
    const db = createMockD1Database();
    const longNotes = 'n'.repeat(1000);

    const record = await repo(db).create({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_ll_eth_hl',
      msb: 'yes',
      notes: longNotes,
      tags: '',
    });

    expect(record.notes).toBe(longNotes);
  });

  it('returns the tags passed through the validated input', async () => {
    const db = createMockD1Database();

    const record = await repo(db).create({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      msb: 'no',
      notes: '',
      tags: 'btc,eth',
    });

    expect(record.tags).toBe('btc,eth');
    expect(record.notes).toBe('');
  });

  it('uses the injected clock for created_at/updated_at', async () => {
    const db = createMockD1Database();

    const record = await repo(db, () => 12345).create({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      msb: 'no',
      notes: '',
      tags: '',
    });

    expect(record.created_at).toBe(12345);
    expect(record.updated_at).toBe(12345);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('first');

    await expect(
      repo(db).create({
        start_time: 1600000000,
        end_time: 1600003600,
        type: 'btc_hh_eth_lh',
        msb: 'no',
        notes: '',
        tags: '',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to create record'),
    });
  });

  it('binds input values as parameters — values never interpolated into SQL', async () => {
    const db = createMockD1Database();
    const input: CreateRecordInput = {
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      msb: 'yes',
      notes: "note with 'quotes'",
      tags: 'a,b,c',
    };

    const record = await repo(db).create(input);

    expect(record.id).toBe(1);
    expect(db.prepares[0]).not.toContain("note with 'quotes'");
    expect(db.calls[0]).toContain(input.notes);
    expect(db.calls[0]).toContain('btc_hh_eth_lh');
  });

  it('does not mutate the caller-supplied input object', async () => {
    const db = createMockD1Database();
    const input: CreateRecordInput = {
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'btc_hh_eth_lh',
      msb: 'no',
      notes: '',
      tags: '',
    };
    const snapshot = { ...input };

    await repo(db).create(input);

    expect(input).toEqual(snapshot);
  });
});

describe('RecordsRepository.update', () => {
  it('updates an existing record and returns the merged record', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await repo(db).update(1, { notes: 'updated' });

    expect(record?.id).toBe(1);
    expect(record?.notes).toBe('updated');
  });

  it('returns null when the record does not exist', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await repo(db).update(999, { type: 'btc_hl_eth_ll' });

    expect(record).toBeNull();
  });

  it('partial update preserves untouched fields', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await repo(db).update(1, { type: 'btc_hl_eth_ll' });

    expect(record?.type).toBe('btc_hl_eth_ll');
    expect(record?.notes).toBe('existing notes');
    expect(record?.tags).toBe('existing tags');
    expect(record?.start_time).toBe(EXISTING.start_time);
  });

  it('refresh updated_at from the injected clock', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await repo(db, () => 99999).update(1, { notes: 'x' });

    expect(record?.updated_at).toBe(99999);
    expect(record?.created_at).toBe(EXISTING.created_at);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('first');

    await expect(repo(db).update(1, { type: 'btc_hl_eth_ll' })).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to update record'),
    });
  });

  it('preserves msb:yes on partial update (regression: HIGH msb default bug)', async () => {
    const recordWithMsbYes: DivergenceRecord = { ...EXISTING, msb: 'yes' };
    const db = createMockD1WithData({ divergence_records: [recordWithMsbYes] });

    const record = await repo(db).update(1, { type: 'btc_hl_eth_ll' });

    // Critical: msb must stay 'yes', not be reset to 'no' by Zod's .partial() default bug
    expect(record?.msb).toBe('yes');
    expect(record?.type).toBe('btc_hl_eth_ll');
  });

  it('rejects partial PUT with only start_time when it would exceed existing end_time (MEDIUM time range bug)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    await expect(repo(db).update(1, { start_time: 9999999999 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    // Verify no UPDATE was sent to DB (failed before executing)
    expect(db.prepares).toHaveLength(1); // Only the findById SELECT
  });

  it('rejects partial PUT with only end_time when it would be less than existing start_time (MEDIUM time range bug)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    await expect(repo(db).update(1, { end_time: 100 })).rejects.toBeInstanceOf(ValidationError);
    // Verify no UPDATE was sent to DB (failed before executing)
    expect(db.prepares).toHaveLength(1); // Only the findById SELECT
  });

  it('returns null when concurrent delete happens after findById (changes===0 concurrent delete protection)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    // Simulate: findById succeeds, but UPDATE touches 0 rows because the record
    // was concurrently deleted by another process (changes===0 protection).
    db.setNextRunMetaChanges(0);

    const record = await repo(db).update(1, { notes: 'updated' });

    expect(record).toBeNull();
    // Verify both findById SELECT and UPDATE were attempted
    expect(db.prepares.length).toBeGreaterThanOrEqual(2);
    expect(db.prepares[1]).toContain('UPDATE');
  });
});

describe('RecordsRepository.findAll', () => {
  it('returns all records with no filters', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        EXISTING,
        { ...EXISTING, id: 2, type: 'btc_hl_eth_ll' },
        { ...EXISTING, id: 3, type: 'btc_ll_eth_hl' },
      ],
    });

    const rows = await repo(db).findAll();

    expect(rows).toHaveLength(3);
  });

  it('filters by type', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        EXISTING,
        { ...EXISTING, id: 2, type: 'btc_hl_eth_ll' },
        { ...EXISTING, id: 3, type: 'btc_hl_eth_ll' },
      ],
    });

    const rows = await repo(db).findAll({ type: 'btc_hl_eth_ll' });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === 'btc_hl_eth_ll')).toBe(true);
  });

  it('filters by tag (partial match)', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, tags: 'btc_crash' },
        { ...EXISTING, id: 2, tags: 'eth_pump' },
        { ...EXISTING, id: 3, tags: 'btc' },
      ],
    });

    const rows = await repo(db).findAll({ tag: 'btc' });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it('orders results by start_time DESC', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, start_time: 100 },
        { ...EXISTING, id: 2, start_time: 300 },
        { ...EXISTING, id: 3, start_time: 200 },
      ],
    });

    const rows = await repo(db).findAll();

    expect(rows.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('all');

    await expect(repo(db).findAll()).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to list records'),
    });
  });

  it('filters by type AND tag in a single query', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, type: 'btc_hl_eth_ll', tags: 'btc' },
        { ...EXISTING, id: 2, type: 'btc_hl_eth_ll', tags: 'eth' },
        { ...EXISTING, id: 3, type: 'btc_hh_eth_lh', tags: 'btc' },
      ],
    });

    const rows = await repo(db).findAll({ type: 'btc_hl_eth_ll', tag: 'btc' });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(db.prepares[0]).toContain('AND');
  });

  it('escapes LIKE wildcards in tag filters (SQL safety)', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, tags: '100%_win' },
        { ...EXISTING, id: 2, tags: '100win' },
        { ...EXISTING, id: 3, tags: '100_win' },
      ],
    });

    const rows = await repo(db).findAll({ tag: '100%_win' });

    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it('binds filters as parameters — injection payloads never appear in SQL', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    const payload = "btc_hh_eth_lh' OR '1'='1";

    const rows = await repo(db).findAll({ type: payload });

    // The payload is not a valid type, so it must not match anything (and it
    // must never be interpolated into the SQL string).
    expect(rows).toHaveLength(0);
    expect(db.prepares[0]).not.toContain(payload);
    expect(db.calls[0]).toContain(payload);
  });

  it('does not mutate the caller-supplied filters object', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    const filters = { type: 'btc_hh_eth_lh', tag: 'btc' };
    const snapshot = { ...filters };

    await repo(db).findAll(filters);

    expect(filters).toEqual(snapshot);
  });

  it('returns an empty array when no records exist', async () => {
    const db = createMockD1Database();

    const rows = await repo(db).findAll();

    expect(rows).toEqual([]);
  });
});

describe('RecordsRepository.findById', () => {
  it('finds a record by id', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const row = await repo(db).findById(1);

    expect(row?.id).toBe(1);
    expect(row?.tags).toBe('existing tags');
  });

  it('returns null when no record matches the id', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const row = await repo(db).findById(999);

    expect(row).toBeNull();
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('first');

    await expect(repo(db).findById(1)).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to find record'),
    });
  });
});

describe('RecordsRepository.listWithStats', () => {
  it('returns zeroed stats when there are no records', async () => {
    const db = createMockD1Database();

    const stats = await repo(db).listWithStats();

    expect(stats).toEqual({
      totalRecords: 0,
      byType: {},
      byMsb: {},
      dateRange: null,
    });
  });

  it('computes totals, per-type, per-msb counts and the date range', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, type: 'btc_hh_eth_lh', msb: 'yes', start_time: 100, end_time: 200 },
        { ...EXISTING, id: 2, type: 'btc_hh_eth_lh', msb: 'no', start_time: 300, end_time: 400 },
        { ...EXISTING, id: 3, type: 'btc_hl_eth_ll', msb: 'no', start_time: 500, end_time: 600 },
      ],
    });

    const stats = await repo(db).listWithStats();

    expect(stats).toEqual({
      totalRecords: 3,
      byType: { btc_hh_eth_lh: 2, btc_hl_eth_ll: 1 },
      byMsb: { yes: 1, no: 2 },
      dateRange: { start: 100, end: 600 },
    });
  });

  it('computes stats over a filtered subset', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, type: 'btc_hh_eth_lh', msb: 'yes' },
        { ...EXISTING, id: 2, type: 'btc_hh_eth_lh', msb: 'no' },
        { ...EXISTING, id: 3, type: 'btc_hl_eth_ll', msb: 'no' },
      ],
    });

    const stats = await repo(db).listWithStats({ type: 'btc_hh_eth_lh' });

    expect(stats.totalRecords).toBe(2);
    expect(stats.byType).toEqual({ btc_hh_eth_lh: 2 });
  });

  it('propagates the underlying DatabaseError when the query fails', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('all');

    await expect(repo(db).listWithStats()).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to list records'),
    });
  });
});

describe('RecordsRepository.findByTimeRange', () => {
  it('rejects when start >= end (start must be strictly before end)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    await expect(repo(db).findByTimeRange(100, 50)).rejects.toBeInstanceOf(ValidationError);
    await expect(repo(db).findByTimeRange(100, 100)).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns records overlapping the query window (span semantics)', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        // Spans the window (starts before, ends inside)
        { ...EXISTING, id: 1, start_time: 1600000000, end_time: 1600003600 },
        // Fully inside the window
        { ...EXISTING, id: 2, start_time: 1600002000, end_time: 1600003000 },
        // Fully outside the window
        { ...EXISTING, id: 3, start_time: 1600010000, end_time: 1600013600 },
      ],
    });

    const rows = await repo(db).findByTimeRange(1600001000, 1600004000);

    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it('excludes records that only touch the window boundary', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        // Ends exactly at window start
        { ...EXISTING, id: 1, start_time: 1600000000, end_time: 1600001000 },
        // Starts exactly at window end
        { ...EXISTING, id: 2, start_time: 1600004000, end_time: 1600005000 },
      ],
    });

    const rows = await repo(db).findByTimeRange(1600001000, 1600004000);

    expect(rows).toHaveLength(0);
  });

  it('binds the window as (end, start) for overlap semantics', async () => {
    const db = createMockD1WithData({ divergence_records: [{ ...EXISTING }] });

    await repo(db).findByTimeRange(1600001000, 1600004000);

    expect(db.calls[0]).toEqual([1600004000, 1600001000]);
    expect(db.prepares[0]).toContain('start_time < ? AND end_time > ?');
  });

  it('orders overlapping records by start_time DESC', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, start_time: 1600002000, end_time: 1600003600 },
        { ...EXISTING, id: 2, start_time: 1600000000, end_time: 1600003000 },
      ],
    });

    const rows = await repo(db).findByTimeRange(1600001000, 1600004000);

    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('all');

    await expect(repo(db).findByTimeRange(100, 200)).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to query records by time range'),
    });
  });
});

describe('RecordsRepository.findByType', () => {
  it('returns only records of the given type (delegates to findAll)', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, type: 'btc_hl_eth_ll' },
        { ...EXISTING, id: 2, type: 'btc_hh_eth_lh' },
        { ...EXISTING, id: 3, type: 'btc_hl_eth_ll' },
      ],
    });

    const rows = await repo(db).findByType('btc_hl_eth_ll');

    expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
    expect(rows.every((r) => r.type === 'btc_hl_eth_ll')).toBe(true);
  });

  it('translates a raw database failure into DatabaseError (via findAll)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('all');

    await expect(repo(db).findByType('btc_hh_eth_lh')).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to list records'),
    });
  });
});

describe('RecordsRepository.delete', () => {
  it('returns true when a record was deleted', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const deleted = await repo(db).delete(1);

    expect(deleted).toBe(true);
    expect(db.rowsOf('divergence_records')).toHaveLength(0);
  });

  it('returns false when no record matches', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const deleted = await repo(db).delete(999);

    expect(deleted).toBe(false);
  });

  it('issues exactly one statement (no pre-SELECT)', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    await repo(db).delete(1);

    expect(db.prepares).toHaveLength(1);
    expect(db.prepares[0]).toContain('DELETE FROM divergence_records');
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('run');

    await expect(repo(db).delete(1)).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to delete record'),
    });
  });
});

describe('computeRecordStats (pure function)', () => {
  it('produces stable aggregate output without mutating its input', () => {
    const records: DivergenceRecord[] = [
      { ...EXISTING, type: 'btc_hh_eth_lh', msb: 'yes', start_time: 100, end_time: 200 },
      { ...EXISTING, id: 2, type: 'btc_hl_eth_ll', msb: 'no', start_time: 300, end_time: 400 },
    ];
    const snapshot = records.map((r) => ({ ...r }));

    const stats = computeRecordStats(records);

    expect(stats).toEqual({
      totalRecords: 2,
      byType: { btc_hh_eth_lh: 1, btc_hl_eth_ll: 1 },
      byMsb: { yes: 1, no: 1 },
      dateRange: { start: 100, end: 400 },
    });
    // Same input, same output — and the source array is untouched.
    expect(computeRecordStats(records)).toEqual(stats);
    expect(records).toEqual(snapshot);
  });

  it('uses the earliest start_time and latest end_time for the date range', () => {
    const records: DivergenceRecord[] = [
      { ...EXISTING, start_time: 500, end_time: 700 },
      { ...EXISTING, id: 2, start_time: 100, end_time: 300 },
      { ...EXISTING, id: 3, start_time: 200, end_time: 900 },
    ];

    const stats = computeRecordStats(records);

    expect(stats.dateRange).toEqual({ start: 100, end: 900 });
  });
});