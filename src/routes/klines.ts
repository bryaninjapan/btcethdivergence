import { Hono } from 'hono';
import { TemporalConverter } from '../domains/temporal-api';
import { ValidationError } from '../lib/errors';
import { klinesService } from '../services/klines.service';
import type { ApiResponse, Env, Kline } from '../types';

const klines = new Hono<{ Bindings: Env }>();

klines.get('/api/klines', async (c) => {
  const symbol = c.req.query('symbol');
  const start = c.req.query('start');
  const end = c.req.query('end');

  if (!symbol || start === undefined || end === undefined) {
    throw new ValidationError('query', 'Missing required query params: symbol, start, end');
  }

  const startMs = Number(start);
  const endMs = Number(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new ValidationError('query', 'start and end must be numeric timestamps');
  }

  // Guard against negative timestamps
  if (startMs < 0 || endMs < 0) {
    throw new ValidationError('query', 'Timestamps must be non-negative');
  }

  // Convert milliseconds to seconds for database query using TemporalConverter
  const startSec = TemporalConverter.msToSec(startMs);
  const endSec = TemporalConverter.msToSec(endMs);

  const rows = await klinesService.queryKlines(c.env.DB, symbol, startSec, endSec);
  const response: ApiResponse<Kline[]> = {
    ok: true,
    data: rows,
  };
  return c.json(response);
});

export default klines;