import { describe, expect, it } from 'vitest';
import { decideBackoff, parseRetryAfter } from './backoff';
import { BinanceError } from './binance';

describe('parseRetryAfter', () => {
  it('parses a positive integer header', () => {
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('returns null for non-numeric input', () => {
    expect(parseRetryAfter('abc')).toBeNull();
  });

  it('returns null for a missing header', () => {
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe('decideBackoff', () => {
  it('honors Retry-After on 429', () => {
    const decision = decideBackoff(new BinanceError(429, 'rate limited', '30'));
    expect(decision.action).toBe('retry');
    expect(decision.waitSeconds).toBe(30);
  });

  it('uses the 60s floor for a 429 without a header', () => {
    const decision = decideBackoff(new BinanceError(429, 'rate limited'));
    expect(decision.action).toBe('retry');
    expect(decision.waitSeconds).toBe(60);
  });

  it('aborts (never auto-retry) on 418, honoring Retry-After', () => {
    const decision = decideBackoff(new BinanceError(418, 'IP auto-banned', '300'));
    expect(decision.action).toBe('abort');
    expect(decision.waitSeconds).toBe(300);
  });

  it('aborts on 418 without a header with a 120s backoff floor', () => {
    const decision = decideBackoff(new BinanceError(418, 'IP auto-banned'));
    expect(decision.action).toBe('abort');
    expect(decision.waitSeconds).toBe(120);
  });

  it('aborts on any other status with no wait', () => {
    const decision = decideBackoff(new BinanceError(403, 'forbidden'));
    expect(decision.action).toBe('abort');
    expect(decision.waitSeconds).toBeNull();
  });
});