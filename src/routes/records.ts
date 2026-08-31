import { Hono } from 'hono';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/db';
import { DatabaseError, NotFoundError, ValidationError } from '../lib/errors';
import {
  createRecordSchema,
  listRecordsQuerySchema,
  updateRecordSchema,
  validationMessage,
} from '../lib/validate';
import type { ApiResponse, Env } from '../types';
import type { DivergenceRecord } from '../types';

const records = new Hono<{ Bindings: Env }>();

records.get('/api/records', async (c) => {
  const parsed = listRecordsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new ValidationError('query', validationMessage(parsed.error));
  }

  try {
    const rows = await listRecords(c.env.DB, parsed.data);
    const response: ApiResponse<DivergenceRecord[]> = {
      ok: true,
      data: rows,
    };
    return c.json(response);
  } catch (error) {
    throw new DatabaseError('Failed to list records', { originalError: String(error) });
  }
});

records.post('/api/records', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('body', 'Invalid JSON body');
  }

  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('body', validationMessage(parsed.error));
  }

  try {
    const row = await createRecord(c.env.DB, parsed.data);
    const response: ApiResponse<DivergenceRecord> = {
      ok: true,
      data: row,
    };
    return c.json(response, 201);
  } catch (error) {
    throw new DatabaseError('Failed to create record', { originalError: String(error) });
  }
});

records.put('/api/records/:id', async (c) => {
  const idStr = c.req.param('id');
  if (!/^\d+$/.test(idStr)) {
    throw new ValidationError('id', 'Record ID must be a positive integer');
  }
  const id = Number(idStr);
  if (id <= 0) {
    throw new ValidationError('id', 'Record ID must be a positive integer');
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('body', 'Invalid JSON body');
  }

  const parsed = updateRecordSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('body', validationMessage(parsed.error));
  }

  try {
    const row = await updateRecord(c.env.DB, id, parsed.data);
    if (!row) {
      throw new NotFoundError('Record');
    }
    const response: ApiResponse<DivergenceRecord> = {
      ok: true,
      data: row,
    };
    return c.json(response);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new DatabaseError('Failed to update record', { originalError: String(error) });
  }
});

records.delete('/api/records/:id', async (c) => {
  const idStr = c.req.param('id');
  if (!/^\d+$/.test(idStr)) {
    throw new ValidationError('id', 'Record ID must be a positive integer');
  }
  const id = Number(idStr);
  if (id <= 0) {
    throw new ValidationError('id', 'Record ID must be a positive integer');
  }

  try {
    const deleted = await deleteRecord(c.env.DB, id);
    if (!deleted) {
      throw new NotFoundError('Record');
    }
    const response: ApiResponse<{ id: number }> = {
      ok: true,
      data: { id },
    };
    return c.json(response);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new DatabaseError('Failed to delete record', { originalError: String(error) });
  }
});

export default records;