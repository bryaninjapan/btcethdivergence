import { Hono } from 'hono';
import { NotFoundError, ValidationError } from '../lib/errors';
import { recordsService } from '../services/records.service';
import {
  createRecordSchema,
  listRecordsQuerySchema,
  updateRecordSchema,
  validatePositiveInteger,
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

  const rows = await recordsService.listRecords(c.env.DB, parsed.data);
  const response: ApiResponse<DivergenceRecord[]> = {
    ok: true,
    data: rows,
  };
  return c.json(response);
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

  const row = await recordsService.createRecord(c.env.DB, parsed.data);
  const response: ApiResponse<DivergenceRecord> = {
    ok: true,
    data: row,
  };
  return c.json(response, 201);
});

records.put('/api/records/:id', async (c) => {
  const id = validatePositiveInteger(c.req.param('id'), 'Record ID');

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

  const row = await recordsService.updateRecord(c.env.DB, id, parsed.data);
  if (!row) {
    throw new NotFoundError('Record');
  }
  const response: ApiResponse<DivergenceRecord> = {
    ok: true,
    data: row,
  };
  return c.json(response);
});

records.delete('/api/records/:id', async (c) => {
  const id = validatePositiveInteger(c.req.param('id'), 'Record ID');

  const deleted = await recordsService.deleteRecord(c.env.DB, id);
  if (!deleted) {
    throw new NotFoundError('Record');
  }
  const response: ApiResponse<{ id: number }> = {
    ok: true,
    data: { id },
  };
  return c.json(response);
});

export default records;