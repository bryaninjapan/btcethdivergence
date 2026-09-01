import { TemporalConverter } from '../domains/temporal-api';
import type { BinanceKlineTuple, Kline } from '../types';

export class BinanceError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(status: number, message: string, retryAfter: string | null = null) {
    super(message);
    this.name = 'BinanceError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function parseKline(raw: BinanceKlineTuple): Kline {
  return {
    open_time: TemporalConverter.msToSec(raw[0]),
    open: Number(raw[1]),
    high: Number(raw[2]),
    low: Number(raw[3]),
    close: Number(raw[4]),
    volume: Number(raw[5]),
  };
}

export interface KlineResult {
  klines: Kline[];
  weight: string | null;
}

export async function fetchKlines(
  host: string,
  symbol: string,
  startTime: number,
  limit = 1000,
): Promise<KlineResult> {
  const url = new URL(`${host}/api/v3/klines`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1h');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('startTime', String(startTime));
  const response = await fetch(url.toString());

  const retryAfter = response.headers.get('Retry-After');
  const weight = response.headers.get('X-MBX-USED-WEIGHT-1M');

  if (!response.ok) {
    const detail = retryAfter ? ` Retry-After: ${retryAfter}` : '';
    if (response.status === 418) {
      throw new BinanceError(
        418,
        `Binance 418: IP auto-banned, must back off (do not auto-retry).${detail}`,
        retryAfter,
      );
    }
    if (response.status === 429) {
      throw new BinanceError(
        429,
        `Binance 429: rate limited, honor Retry-After.${detail}`,
        retryAfter,
      );
    }
    throw new BinanceError(response.status, `Binance returned ${response.status}.${detail}`, retryAfter);
  }

  const raw = (await response.json()) as BinanceKlineTuple[];
  return {
    klines: raw.map(parseKline),
    weight,
  };
}