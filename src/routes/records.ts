import { Hono } from 'hono';
import { createRecord, listRecords, updateRecord } from '../lib/db';
import { jsonError, jsonOk } from '../lib/response';
import { createRecordSchema, updateRecordSchema, validationMessage } from '../lib/validate';
import type { Env } from '../types';

const records = new Hono<{ Bindings: Env }>();

records.get('/api/records', async (c) => {
  const rows = await listRecords(c.env.DB);
  return jsonOk(rows);
});

records.post('/api/records', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${validationMessage(parsed.error)}`, 400);
  }
  const row = await createRecord(c.env.DB, parsed.data);
  return jsonOk(row, 201);
});

records.put('/api/records/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return jsonError('Invalid record id', 400);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateRecordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${validationMessage(parsed.error)}`, 400);
  }
  const row = await updateRecord(c.env.DB, id, parsed.data);
  if (!row) {
    return jsonError('Record not found', 404);
  }
  return jsonOk(row);
});

export default records;