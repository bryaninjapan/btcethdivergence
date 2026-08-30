import { Hono } from 'hono';
import { queryKlines } from '../lib/db';
import { jsonError, jsonOk } from '../lib/response';
import type { Env } from '../types';

const klines = new Hono<{ Bindings: Env }>();

klines.get('/api/klines', async (c) => {
  const symbol = c.req.query('symbol');
  const start = c.req.query('start');
  const end = c.req.query('end');
  if (!symbol || start === undefined || end === undefined) {
    return jsonError('Missing required query params: symbol, start, end', 400);
  }
  const startMs = Number(start);
  const endMs = Number(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return jsonError('start and end must be numeric timestamps', 400);
  }
  const rows = await queryKlines(c.env.DB, symbol, startMs, endMs);
  return jsonOk(rows);
});

export default klines;