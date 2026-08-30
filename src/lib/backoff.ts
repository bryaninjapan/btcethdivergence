import { BinanceError } from './binance';

export function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const parsed = parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface BackoffDecision {
  action: 'retry' | 'abort';
  waitSeconds: number | null;
  message: string;
}

export function decideBackoff(err: BinanceError): BackoffDecision {
  if (err.status === 429) {
    return {
      action: 'retry',
      waitSeconds: parseRetryAfter(err.retryAfter) ?? 60,
      message: 'rate limited, honor Retry-After',
    };
  }
  if (err.status === 418) {
    return {
      action: 'abort',
      waitSeconds: parseRetryAfter(err.retryAfter) ?? 120,
      message: 'IP auto-banned, must back off; do NOT auto-retry (retrying extends the ban)',
    };
  }
  return { action: 'abort', waitSeconds: null, message: 'non-retryable HTTP status' };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}