import { BinanceError, fetchKlines } from '../lib/binance';
import {
  getBackfillCursor as dbGetBackfillCursor,
  insertKlinesBatch,
  setBackfillCursor as dbSetBackfillCursor,
} from '../lib/db';
import { DatabaseError, ExternalServiceError } from '../lib/errors';
import type { Kline } from '../types';

/** Result of a read-only Binance reachability probe (no D1 writes). */
export interface ProbeResult {
  endpoint: string;
  status: 200;
  count: number;
  weight: string | null;
}

/** Result of an ingest orchestration run. */
export interface IngestResult {
  inserted: number;
  skipped: number;
  newCursor: number;
}

/**
 * Read the stored backfill cursor (unix seconds) for a symbol.
 *
 * @param db D1 database instance
 * @param symbol Symbol, e.g. "BTCUSDT"
 * @returns The stored cursor, or null when backfill has not started
 * @throws DatabaseError if the query fails
 */
async function getBackfillCursor(db: D1Database, symbol: string): Promise<number | null> {
  try {
    return await dbGetBackfillCursor(db, symbol);
  } catch (error) {
    throw new DatabaseError('Failed to get backfill cursor', { originalError: String(error) });
  }
}

/**
 * Persist the backfill cursor (unix seconds) for a symbol.
 *
 * @param db D1 database instance
 * @param symbol Symbol, e.g. "BTCUSDT"
 * @param cursor Cursor position in unix seconds
 * @throws DatabaseError if the write fails
 */
async function setBackfillCursor(db: D1Database, symbol: string, cursor: number): Promise<void> {
  try {
    await dbSetBackfillCursor(db, symbol, cursor);
  } catch (error) {
    throw new DatabaseError('Failed to set backfill cursor', { originalError: String(error) });
  }
}

async function attempt(host: string, symbol: string, startTime: number): Promise<ProbeResult> {
  try {
    const result = await fetchKlines(host, symbol, startTime, 1);
    return { endpoint: host, status: 200, count: result.klines.length, weight: result.weight };
  } catch (error) {
    // Convert BinanceError to ExternalServiceError
    const binanceErr =
      error instanceof BinanceError ? error : new BinanceError(0, String(error));
    throw new ExternalServiceError(
      'Binance API',
      `${binanceErr.message} (status: ${binanceErr.status})`,
      {
        endpoint: host,
        status: binanceErr.status,
      },
    );
  }
}

/**
 * Probe Binance reachability from the Worker, read-only (no D1 writes).
 * Tries the primary endpoint first, then falls back to the public vision
 * endpoint. `symbol` and `startTime` are route-validated.
 *
 * @param symbol Symbol to probe, e.g. "BTCUSDT"
 * @param startTime Probe window start in unix milliseconds
 * @returns { endpoint, status, count, weight } for the first endpoint that succeeds
 * @throws ExternalServiceError if both endpoints fail
 */
async function probeBinanceReachability(symbol: string, startTime: number): Promise<ProbeResult> {
  try {
    return await attempt('https://api.binance.com', symbol, startTime);
  } catch (firstError) {
    // Try fallback endpoint
    try {
      return await attempt('https://data-api.binance.vision', symbol, startTime);
    } catch (fallbackError) {
      // Both endpoints failed
      const firstMsg =
        firstError instanceof ExternalServiceError ? firstError.message : String(firstError);
      const fallbackMsg =
        fallbackError instanceof ExternalServiceError ? fallbackError.message : String(fallbackError);
      throw new ExternalServiceError(
        'Binance API',
        `Both endpoints failed: api.binance.com failed, data-api.binance.vision also failed`,
        {
          primaryError: firstMsg,
          fallbackError: fallbackMsg,
        },
      );
    }
  }
}

/**
 * Orchestrate a kline ingest: batch-insert klines for a symbol and advance
 * the backfill cursor to the newest kline in the payload.
 *
 * @param db D1 database instance
 * @param symbol Symbol, e.g. "BTCUSDT" (Zod-validated: BTCUSDT | ETHUSDT)
 * @param klines Klines to insert (Zod-validated, 1..1000)
 * @returns { inserted, skipped, newCursor } where newCursor is the last
 *          kline's open_time (unix seconds)
 * @throws DatabaseError if the insert or cursor update fails
 */
async function processIngest(
  db: D1Database,
  symbol: string,
  klines: Kline[],
): Promise<IngestResult> {
  try {
    const res = await insertKlinesBatch(db, symbol, klines);
    const newCursor = klines[klines.length - 1].open_time;
    await setBackfillCursor(db, symbol, newCursor);
    return { inserted: res.inserted, skipped: res.skipped, newCursor };
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Ingest failed', { originalError: String(error) });
  }
}

/**
 * Admin domain service: HTTP-independent backfill cursor management,
 * Binance reachability probing, and ingest orchestration.
 */
export const adminService = {
  getBackfillCursor,
  setBackfillCursor,
  probeBinanceReachability,
  processIngest,
};

export type AdminService = typeof adminService;