import { describe, expect, it } from 'vitest';
import { createMockD1Database, createMockD1WithData } from '../lib/test-db';
import { RecordsRepository, computeRecordStats } from './RecordsRepository';
import { ErrorCode } from '../lib/errors';
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