import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceError, fetchKlines, parseKline } from './binance';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseKline', () => {
  it('maps a representative Binance kline tuple with ms timestamp and string numbers', () => {
    const raw = [
      1705334400000,
      '42161.60',
      '42500.00',
      '42000.00',
      '42499.99',
      '1234.567',
      1705337999999,
      '52000000',
      12345,
      '600',
      '26000000',
      '0',
    ] as const;

    const parsed = parseKline(raw);

    expect(parsed.open_time).toBe(1705334400);
    expect(parsed.open).toBe(42161.6);
    expect(parsed.high).toBe(42500);
    expect(parsed.low).toBe(42000);
    expect(parsed.close).toBe(42499.99);
    expect(parsed.volume).toBe(1234.567);
  });

  it('coerces every numeric field to an actual number (not a string)', () => {
    const raw = [
      1705334400000,
      '42161.60',
      '42500.00',
      '42000.00',
      '42499.99',
      '1234.567',
    ] as const;

    const parsed = parseKline(raw);

    expect(typeof parsed.open).toBe('number');
    expect(typeof parsed.high).toBe('number');
    expect(typeof parsed.low).toBe('number');
    expect(typeof parsed.close).toBe('number');
    expect(typeof parsed.volume).toBe('number');
    expect(typeof parsed.open_time).toBe('number');
  });
});

describe('fetchKlines', () => {
  it('surfaces a 429 as a BinanceError with status 429 and Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"code":-1003,"msg":"Too many requests"}', {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      ),
    );

    try {
      await fetchKlines('https://api.binance.com', 'BTCUSDT', 1705334400000);
      throw new Error('expected fetchKlines to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BinanceError);
      const binanceError = err as BinanceError;
      expect(binanceError.status).toBe(429);
      expect(binanceError.retryAfter).toBe('30');
    }
  });

  it('returns parsed klines and the used-weight header on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            [1705334400000, '42161.60', '42500.00', '42000.00', '42499.99', '1234.567', 1705337999999, '52000000', 12345, '600', '26000000', '0'],
          ]),
          {
            status: 200,
            headers: { 'X-MBX-USED-WEIGHT-1M': '3' },
          },
        ),
      ),
    );

    const result = await fetchKlines('https://api.binance.com', 'BTCUSDT', 1705334400000, 1);

    expect(result.weight).toBe('3');
    expect(result.klines).toHaveLength(1);
    expect(result.klines[0]).toEqual({
      open_time: 1705334400,
      open: 42161.6,
      high: 42500,
      low: 42000,
      close: 42499.99,
      volume: 1234.567,
    });
  });
});