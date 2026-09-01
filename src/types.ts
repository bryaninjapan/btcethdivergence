import type { ErrorCode } from './lib/errors';

export interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
  /**
   * Static assets binding, configured in wrangler.jsonc under `assets.binding`.
   * Serves files from ./public (e.g. index.html, charts.html, calculator.html).
   * Optional: not every Env consumer (e.g. route-level tests) needs to provide it.
   */
  ASSETS?: Fetcher;
}

/**
 * Structured API response envelope for all API responses.
 * Used by middleware to ensure consistent response format.
 */
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: ErrorDetails;
}

/**
 * Error details included in ApiResponse when ok=false.
 * Code is machine-readable; message is user-friendly.
 * Details field is for debugging (server-side only).
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface Kline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BinanceKlineTuple = readonly [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  ...rest: unknown[],
];

export interface DivergenceRecord {
  id: number;
  start_time: number;
  end_time: number;
  type: string;
  msb: string;
  notes: string;
  tags: string;
  created_at: number;
  updated_at: number;
}