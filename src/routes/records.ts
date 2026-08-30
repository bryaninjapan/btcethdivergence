import { Hono } from 'hono';
import { listRecords } from '../lib/db';
import { jsonOk } from '../lib/response';
import type { Env } from '../types';

const records = new Hono<{ Bindings: Env }>();

records.get('/api/records', async (c) => {
  const rows = await listRecords(c.env.DB);
  return jsonOk(rows);
});

export default records;