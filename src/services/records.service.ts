import { DatabaseError } from '../lib/errors';
import {
  createRecord as dbCreateRecord,
  deleteRecord as dbDeleteRecord,
  listRecords as dbListRecords,
  updateRecord as dbUpdateRecord,
} from '../lib/db';
import type { CreateRecordInput, UpdateRecordInput } from '../lib/validate';
import type { DivergenceRecord } from '../types';

/**
 * Create a new divergence record.
 *
 * Business logic: persists a validated record and translates raw database
 * failures into a structured `DatabaseError` so route handlers stay thin and
 * the error contract (DATABASE_ERROR) is preserved regardless of the D1
 * driver's underlying error shape.
 *
 * @param db D1 database instance
 * @param input Validated record input (start_time < end_time, valid type, Zod-checked)
 * @returns The created record with its assigned id
 * @throws DatabaseError if the insert fails
 */
async function createRecord(
  db: D1Database,
  input: CreateRecordInput,
): Promise<DivergenceRecord> {
  try {
    return await dbCreateRecord(db, input);
  } catch (error) {
    throw new DatabaseError('Failed to create record', { originalError: String(error) });
  }
}

/**
 * Update an existing divergence record by id.
 *
 * @param db D1 database instance
 * @param id Record id (positive integer, route-validated)
 * @param input Validated partial update (Zod-checked; start_time/end_time consistency enforced at route)
 * @returns The merged record, or null when no record with `id` exists
 * @throws DatabaseError if the update fails
 */
async function updateRecord(
  db: D1Database,
  id: number,
  input: UpdateRecordInput,
): Promise<DivergenceRecord | null> {
  try {
    return await dbUpdateRecord(db, id, input);
  } catch (error) {
    throw new DatabaseError('Failed to update record', { originalError: String(error) });
  }
}

/**
 * List divergence records, optionally filtered by type and/or tag.
 *
 * @param db D1 database instance
 * @param filters Optional { type, tag } filters (enum + length validated at route)
 * @returns Matching records, newest start_time first
 * @throws DatabaseError if the query fails
 */
async function listRecords(
  db: D1Database,
  filters: { type?: string; tag?: string } = {},
): Promise<DivergenceRecord[]> {
  try {
    return await dbListRecords(db, filters);
  } catch (error) {
    throw new DatabaseError('Failed to list records', { originalError: String(error) });
  }
}

/**
 * Delete a divergence record by id.
 *
 * @param db D1 database instance
 * @param id Record id (positive integer, route-validated)
 * @returns true when a row was deleted, false when no row matched
 * @throws DatabaseError if the delete fails
 */
async function deleteRecord(db: D1Database, id: number): Promise<boolean> {
  try {
    return await dbDeleteRecord(db, id);
  } catch (error) {
    throw new DatabaseError('Failed to delete record', { originalError: String(error) });
  }
}

/**
 * Records domain service: HTTP-independent business operations for
 * divergence records. Routes validate input with Zod, then delegate here.
 */
export const recordsService = {
  createRecord,
  updateRecord,
  listRecords,
  deleteRecord,
};

export type RecordsService = typeof recordsService;