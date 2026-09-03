import { Hono } from 'hono';
import type { Context } from 'hono';
import { NotFoundError, ValidationError } from '../lib/errors';
import { RecordsRepository, type RecordStats } from '../services/RecordsRepository';
import {
  createRecordSchema,
  listRecordsQuerySchema,
  updateRecordSchema,
  validatePositiveInteger,
  validationMessage,
} from '../lib/validate';
import type { ApiResponse, Env } from '../types';
import type { DivergenceRecord } from '../types';
import { z } from 'zod';

const records = new Hono<{ Bindings: Env }>();

/** Parse JSON body and validate against a schema, throwing ValidationError on failure. */
async function parseBody<T>(
  c: Context,
  schema: z.ZodSchema<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('body', 'Invalid JSON body');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ValidationError('body', validationMessage(parsed.error));
  return parsed.data;
}

records.get('/api/records', async (c) => {
  const parsed = listRecordsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new ValidationError('query', validationMessage(parsed.error));
  const rows = await new RecordsRepository(c.env.DB).findAll(parsed.data);
  return c.json({ ok: true, data: rows } satisfies ApiResponse<DivergenceRecord[]>);
});

// Registered before any `/:id` route so `/api/records/stats` is never
// shadowed by an id param (there is no GET /:id handler today, but the
// ordering is a documented invariant).
records.get('/api/records/stats', async (c) => {
  const parsed = listRecordsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw new ValidationError('query', validationMessage(parsed.error));
  const stats = await new RecordsRepository(c.env.DB).listWithStats(parsed.data);
  return c.json({ ok: true, data: stats } satisfies ApiResponse<RecordStats>);
});

records.post('/api/records', async (c) => {
  const input = await parseBody(c, createRecordSchema);
  const row = await new RecordsRepository(c.env.DB).create(input);
  return c.json({ ok: true, data: row } satisfies ApiResponse<DivergenceRecord>, 201);
});

records.put('/api/records/:id', async (c) => {
  const id = validatePositiveInteger(c.req.param('id'), 'Record ID');
  const input = await parseBody(c, updateRecordSchema);
  const row = await new RecordsRepository(c.env.DB).update(id, input);
  if (!row) throw new NotFoundError('Record');
  return c.json({ ok: true, data: row } satisfies ApiResponse<DivergenceRecord>);
});

records.delete('/api/records/:id', async (c) => {
  const id = validatePositiveInteger(c.req.param('id'), 'Record ID');
  const deleted = await new RecordsRepository(c.env.DB).delete(id);
  if (!deleted) throw new NotFoundError('Record');
  return c.json({ ok: true, data: { id } } satisfies ApiResponse<{ id: number }>);
});

export default records;