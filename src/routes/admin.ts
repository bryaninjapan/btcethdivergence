import { Hono } from 'hono';
import { BinanceError, fetchKlines } from '../lib/binance';
import { jsonError, jsonOk } from '../lib/response';
import type { Env } from '../types';

const admin = new Hono<{ Bindings: Env }>();

async function attempt(host: string, symbol: string, startTime: number) {
  const result = await fetchKlines(host, symbol, startTime, 1);
  return { endpoint: host, status: 200, count: result.klines.length, weight: result.weight };
}

admin.get('/api/admin/binance-spike', async (c) => {
  const symbol = c.req.query('symbol') ?? 'BTCUSDT';
  const startTime = Date.now() - 2 * 60 * 60 * 1000;

  try {
    const success = await attempt('https://api.binance.com', symbol, startTime);
    return jsonOk(success);
  } catch (err) {
    const first = err instanceof BinanceError ? err : new BinanceError(0, String(err));
    try {
      const fallback = await attempt('https://data-api.binance.vision', symbol, startTime);
      return jsonOk(fallback);
    } catch (err2) {
      const second = err2 instanceof BinanceError ? err2 : new BinanceError(0, String(err2));
      return jsonError(
        `Binance blocked: api.binance.com ${first.status}, data-api.binance.vision ${second.status}`,
        502,
      );
    }
  }
});

export default admin;