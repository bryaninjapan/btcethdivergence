import { describe, expect, it } from 'vitest';
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { recordsService } from './records.service';
import { ErrorCode } from '../lib/errors';
import type { DivergenceRecord } from '../types';

const EXISTING: DivergenceRecord = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'time_lag',
  notes: 'existing notes',
  tags: 'existing tags',
  created_at: 1,
  updated_at: 1,
};

describe('recordsService.createRecord', () => {
  it('creates a record from valid input and returns it', async () => {
    const db = createMockD1Database();

    const record = await recordsService.createRecord(db as unknown as D1Database, {
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'structural',
      notes: 'hello',
      tags: 'btc,eth',
    });

    expect(record).toMatchObject({
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'structural',
      notes: 'hello',
      tags: 'btc,eth',
    });
    expect(record.id).toBe(1);
    expect(db.rowsOf('divergence_records')).toHaveLength(1);
  });

  it('succeeds with very long notes (route already validated the 1000-char cap)', async () => {
    const db = createMockD1Database();
    const longNotes = 'n'.repeat(1000);

    const record = await recordsService.createRecord(db as unknown as D1Database, {
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'opposite',
      notes: longNotes,
      tags: '',
    });

    expect(record.notes).toBe(longNotes);
  });

  it('returns the tags passed through the validated input', async () => {
    const db = createMockD1Database();

    const record = await recordsService.createRecord(db as unknown as D1Database, {
      start_time: 1600000000,
      end_time: 1600003600,
      type: 'time_lag',
      notes: '',
      tags: 'btc,eth',
    });

    expect(record.tags).toBe('btc,eth');
    expect(record.notes).toBe('');
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1Database();
    db.failNext('first');

    await expect(
      recordsService.createRecord(db as unknown as D1Database, {
        start_time: 1600000000,
        end_time: 1600003600,
        type: 'time_lag',
        notes: '',
        tags: '',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to create record'),
    });
  });
});

describe('recordsService.updateRecord', () => {
  it('updates an existing record and returns the merged record', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await recordsService.updateRecord(db as unknown as D1Database, 1, {
      notes: 'updated',
    });

    expect(record?.id).toBe(1);
    expect(record?.notes).toBe('updated');
  });

  it('returns null when the record does not exist', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await recordsService.updateRecord(db as unknown as D1Database, 999, {
      type: 'structural',
    });

    expect(record).toBeNull();
  });

  it('partial update preserves untouched fields', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const record = await recordsService.updateRecord(db as unknown as D1Database, 1, {
      type: 'structural',
    });

    expect(record?.type).toBe('structural');
    expect(record?.notes).toBe('existing notes');
    expect(record?.tags).toBe('existing tags');
    expect(record?.start_time).toBe(EXISTING.start_time);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('first');

    await expect(
      recordsService.updateRecord(db as unknown as D1Database, 1, { type: 'structural' }),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to update record'),
    });
  });
});

describe('recordsService.listRecords', () => {
  it('returns all records with no filters', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        EXISTING,
        { ...EXISTING, id: 2, type: 'structural' },
        { ...EXISTING, id: 3, type: 'opposite' },
      ],
    });

    const rows = await recordsService.listRecords(db as unknown as D1Database);

    expect(rows).toHaveLength(3);
  });

  it('filters by type', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        EXISTING,
        { ...EXISTING, id: 2, type: 'structural' },
        { ...EXISTING, id: 3, type: 'structural' },
      ],
    });

    const rows = await recordsService.listRecords(db as unknown as D1Database, {
      type: 'structural',
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === 'structural')).toBe(true);
  });

  it('filters by tag (partial match)', async () => {
    const db = createMockD1WithData({
      divergence_records: [
        { ...EXISTING, id: 1, tags: 'btc_crash' },
        { ...EXISTING, id: 2, tags: 'eth_pump' },
        { ...EXISTING, id: 3, tags: 'btc' },
      ],
    });

    const rows = await recordsService.listRecords(db as unknown as D1Database, { tag: 'btc' });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('all');

    await expect(
      recordsService.listRecords(db as unknown as D1Database),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to list records'),
    });
  });
});

describe('recordsService.deleteRecord', () => {
  it('returns true when a record was deleted', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const deleted = await recordsService.deleteRecord(db as unknown as D1Database, 1);

    expect(deleted).toBe(true);
    expect(db.rowsOf('divergence_records')).toHaveLength(0);
  });

  it('returns false when no record matches', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });

    const deleted = await recordsService.deleteRecord(db as unknown as D1Database, 999);

    expect(deleted).toBe(false);
  });

  it('translates a raw database failure into DatabaseError', async () => {
    const db = createMockD1WithData({ divergence_records: [EXISTING] });
    db.failNext('run');

    await expect(
      recordsService.deleteRecord(db as unknown as D1Database, 1),
    ).rejects.toMatchObject({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining('Failed to delete record'),
    });
  });
});