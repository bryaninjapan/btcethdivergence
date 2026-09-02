import { DatabaseError } from '../lib/errors';
import { TemporalConverter } from '../domains/temporal-api';
import type { CreateRecordInput, UpdateRecordInput } from '../lib/validate';
import type { DivergenceRecord } from '../types';

/**
 * RecordsRepository — the single owner of all divergence-record SQL.
 *
 * Replaces the former pass-through `recordsService` + the record helpers in
 * `src/lib/db.ts`. Every method is a parameterized D1 statement (no string
 * interpolation of user input) and translates raw driver failures into a
 * structured `DatabaseError` so route handlers stay pure HTTP.
 *
 * Design rules (Phase 16 constraints):
 *   - `delete()` issues exactly one statement (no pre-SELECT).
 *   - No method issues a warm-up / lazy-init statement before its primary
 *     query; `update()`'s leading `findById` is its documented merge read.
 *   - `listWithStats()` computes statistics in JS — never SQL aggregates.
 *   - `findByType()` delegates to `findAll({ type })`.
 */

/** Optional filters for `findAll` (mirrors `listRecordsQuerySchema`). */
export interface FindAllFilters {
  type?: string;
  tag?: string;
}

/** Aggregate statistics computed in JS over a set of records. */
export interface RecordStats {
  totalRecords: number;
  /** Count of records per divergence type (e.g. `{ btc_hh_eth_lh: 3 }`). */
  byType: Record<string, number>;
  /** Count of records per MSB status (`yes` / `no`). */
  byMsb: Record<string, number>;
  /** Inclusive min/max record times, or null when there are no records. */
  dateRange: { start: number; end: number } | null;
}

/**
 * Escape SQL LIKE wildcards (`%`, `_`, `\`) so a tag search term matches
 * literally rather than acting as a wildcard. Used to build the `%<term>%`
 * pattern bound to `tags LIKE ? ESCAPE '\'`.
 */
function escapeLikeWildcards(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

/**
 * Compute `RecordStats` for a set of records. Pure function — no SQL, no
 * side effects, and the input array is never mutated.
 */
export function computeRecordStats(records: DivergenceRecord[]): RecordStats {
  const byType: Record<string, number> = {};
  const byMsb: Record<string, number> = {};
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const record of records) {
    byType[record.type] = (byType[record.type] ?? 0) + 1;
    byMsb[record.msb] = (byMsb[record.msb] ?? 0) + 1;
    if (record.start_time < minStart) minStart = record.start_time;
    if (record.end_time > maxEnd) maxEnd = record.end_time;
  }

  return {
    totalRecords: records.length,
    byType,
    byMsb,
    dateRange:
      records.length === 0 ? null : { start: minStart, end: maxEnd },
  };
}

export class RecordsRepository {
  /**
   * @param db D1 database instance
   * @param now Optional clock returning unix seconds; defaults to
   *   `TemporalConverter.dateToSec(new Date())`. Injectable for tests that
   *   need deterministic `created_at` / `updated_at` values.
   */
  constructor(
    private readonly db: D1Database,
    private readonly now: () => number = () => TemporalConverter.dateToSec(new Date()),
  ) {}

  /**
   * List all divergence records, optionally filtered by type and/or tag.
   *
   * @param filters Optional `{ type, tag }` filters (enum + length validated at route)
   * @returns Matching records, newest `start_time` first
   * @throws DatabaseError if the query fails
   */
  async findAll(filters: FindAllFilters = {}): Promise<DivergenceRecord[]> {
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
    try {
      return await this.db
        .prepare(`SELECT * FROM divergence_records${where} ORDER BY start_time DESC`)
        .bind(...params)
        .all<DivergenceRecord>()
        .then((r) => r.results);
    } catch (error) {
      throw new DatabaseError('Failed to list records', { originalError: String(error) });
    }
  }

  /**
   * Find a single record by id.
   *
   * @param id Record id (positive integer, route-validated)
   * @returns The record, or null when no record with `id` exists
   * @throws DatabaseError if the query fails
   */
  async findById(id: number): Promise<DivergenceRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM divergence_records WHERE id = ?')
        .bind(id)
        .first<DivergenceRecord>();
    } catch (error) {
      throw new DatabaseError('Failed to find record', { originalError: String(error) });
    }
  }

  /**
   * Compute aggregate statistics over all records (optionally filtered).
   *
   * Statistics are computed in JS from `findAll()` results — never SQL
   * aggregates. `totalRecords`, `byType`, `byMsb`, and `dateRange` describe
   * the filtered set.
   *
   * @param filters Optional `{ type, tag }` filters applied before aggregating
   * @returns Statistics for the matching records
   * @throws DatabaseError if the underlying query fails
   */
  async listWithStats(filters: FindAllFilters = {}): Promise<RecordStats> {
    try {
      return computeRecordStats(await this.findAll(filters));
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError('Failed to compute record statistics', {
        originalError: String(error),
      });
    }
  }

  /**
   * Query records whose time range overlaps `[start, end]`.
   *
   * Overlap semantics: a record is included when `start_time < end AND
   * end_time > start` — i.e. records that span the query window are returned,
   * not just those fully contained within it.
   *
   * @param start Window start in unix seconds
   * @param end Window end in unix seconds
   * @returns Matching records, newest `start_time` first
   * @throws DatabaseError if the query fails
   */
  async findByTimeRange(start: number, end: number): Promise<DivergenceRecord[]> {
    try {
      return await this.db
        .prepare(
          'SELECT * FROM divergence_records WHERE start_time < ? AND end_time > ? ORDER BY start_time DESC',
        )
        .bind(end, start)
        .all<DivergenceRecord>()
        .then((r) => r.results);
    } catch (error) {
      throw new DatabaseError('Failed to query records by time range', {
        originalError: String(error),
      });
    }
  }

  /**
   * Find all records of a given divergence type.
   *
   * Delegates to `findAll({ type })` — no duplicate SQL.
   *
   * @param type Divergence type (enum-validated at route)
   * @returns Matching records, newest `start_time` first
   * @throws DatabaseError if the query fails
   */
  findByType(type: string): Promise<DivergenceRecord[]> {
    return this.findAll({ type });
  }

  /**
   * Create a new divergence record.
   *
   * @param input Validated record input (start_time < end_time, valid type, Zod-checked)
   * @returns The created record with its assigned id and timestamps
   * @throws DatabaseError if the insert fails
   */
  async create(input: CreateRecordInput): Promise<DivergenceRecord> {
    const now = this.now();
    try {
      const result = await this.db
        .prepare(
          'INSERT INTO divergence_records (start_time, end_time, type, msb, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
        )
        .bind(
          input.start_time,
          input.end_time,
          input.type,
          input.msb ?? 'no',
          input.notes ?? '',
          input.tags ?? '',
          now,
          now,
        )
        .first<DivergenceRecord>();
      if (!result) {
        throw new DatabaseError('Failed to create record', { originalError: 'INSERT returned no row' });
      }
      return result;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError('Failed to create record', { originalError: String(error) });
    }
  }

  /**
   * Update an existing record by id, merging the partial input over the
   * stored row (omitted fields are preserved — never cleared).
   *
   * @param id Record id (positive integer, route-validated)
   * @param input Validated partial update (Zod-checked)
   * @returns The merged record, or null when no record with `id` exists
   * @throws DatabaseError if the update fails
   */
  async update(id: number, input: UpdateRecordInput): Promise<DivergenceRecord | null> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        return null;
      }
      const merged: DivergenceRecord = {
        ...existing,
        ...input,
        msb: input.msb ?? existing.msb,
        notes: input.notes ?? existing.notes,
        tags: input.tags ?? existing.tags,
        updated_at: this.now(),
      };
      await this.db
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
    } catch (error) {
      // Re-wrap any failure (including findById's translation) so the
      // caller-visible contract stays "Failed to update record".
      throw new DatabaseError('Failed to update record', { originalError: String(error) });
    }
  }

  /**
   * Delete a record by id.
   *
   * Issues exactly one statement (no pre-SELECT) so the caller can treat a
   * `changes > 0` result as authoritative.
   *
   * @param id Record id (positive integer, route-validated)
   * @returns true when a row was deleted, false when no row matched
   * @throws DatabaseError if the delete fails
   */
  async delete(id: number): Promise<boolean> {
    try {
      const res = await this.db.prepare('DELETE FROM divergence_records WHERE id = ?').bind(id).run();
      return (res.meta.changes ?? 0) > 0;
    } catch (error) {
      throw new DatabaseError('Failed to delete record', { originalError: String(error) });
    }
  }
}