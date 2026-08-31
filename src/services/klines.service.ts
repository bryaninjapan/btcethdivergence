import { DatabaseError } from '../lib/errors';
import { queryKlines as dbQueryKlines } from '../lib/db';
import type { Kline } from '../types';

/**
 * Query klines for a symbol within an inclusive [start, end] open_time
 * range (unix seconds).
 *
 * Business logic: delegates to the db.ts repository and translates raw
 * database failures into a structured `DatabaseError` so the route stays
 * thin and the DATABASE_ERROR contract is preserved.
 *
 * @param db D1 database instance
 * @param symbol Symbol, e.g. "BTCUSDT" (route-validated)
 * @param start Range start in unix seconds (route-validated, >= 0)
 * @param end Range end in unix seconds (route-validated, >= 0)
 * @returns Matching klines ordered by open_time; [] when the range is empty
 * @throws DatabaseError if the query fails
 */
async function queryKlines(db: D1Database, symbol: string, start: number, end: number): Promise<Kline[]> {
  try {
    return await dbQueryKlines(db, symbol, start, end);
  } catch (error) {
    throw new DatabaseError('Database query failed', { originalError: String(error) });
  }
}

/**
 * Klines domain service: HTTP-independent read access to stored klines.
 * Routes validate query params and convert ms -> seconds, then delegate here.
 */
export const klinesService = {
  queryKlines,
};

export type KlinesService = typeof klinesService;