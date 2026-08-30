import { Hono } from 'hono';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/db';
import { jsonError, jsonOk } from '../lib/response';
import { createRecordSchema, updateRecordSchema, validationMessage } from '../lib/validate';
import type { Env } from '../types';

const records = new Hono<{ Bindings: Env }>();

records.get('/api/records', async (c) => {
  try {
    const rows = await listRecords(c.env.DB);
    return jsonOk(rows);
  } catch (error) {
    console.error(`Failed to list records: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
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
  try {
    const row = await createRecord(c.env.DB, parsed.data);
    return jsonOk(row, 201);
  } catch (error) {
    console.error(`Failed to create record: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

records.put('/api/records/:id', async (c) => {
  const idStr = c.req.param('id');
  if (!/^\d+$/.test(idStr)) {
    return jsonError('Invalid record id', 400);
  }
  const id = Number(idStr);
  if (id <= 0) {
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
  try {
    const row = await updateRecord(c.env.DB, id, parsed.data);
    if (!row) {
      return jsonError('Record not found', 404);
    }
    return jsonOk(row);
  } catch (error) {
    console.error(`Failed to update record: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

records.delete('/api/records/:id', async (c) => {
  const idStr = c.req.param('id');
  if (!/^\d+$/.test(idStr)) {
    return jsonError('Invalid record id', 400);
  }
  const id = Number(idStr);
  if (id <= 0) {
    return jsonError('Invalid record id', 400);
  }
  try {
    const deleted = await deleteRecord(c.env.DB, id);
    if (!deleted) {
      return jsonError('Record not found', 404);
    }
    return jsonOk({ id });
  } catch (error) {
    console.error(`Failed to delete record: ${String(error)}`);
    return jsonError('Internal server error', 500);
  }
});

export default records;