import { describe, expect, it } from 'vitest';
import { TemporalConverter } from './temporal-api';
import { Timestamp, TimestampError } from '../lib/timestamp';

describe('TemporalConverter.msToSec', () => {
  it('converts the epoch (0 ms) to 0 seconds', () => {
    expect(TemporalConverter.msToSec(0)).toBe(0);
  });

  it('floors sub-second values: 999 ms -> 0 s', () => {
    expect(TemporalConverter.msToSec(999)).toBe(0);
  });

  it('converts exactly 1000 ms to 1 s', () => {
    expect(TemporalConverter.msToSec(1000)).toBe(1);
  });

  it('converts a representative modern timestamp', () => {
    expect(TemporalConverter.msToSec(1693526400000)).toBe(1693526400);
  });

  it('handles the year-2038 boundary (max 32-bit signed int seconds)', () => {
    expect(TemporalConverter.msToSec(2147483647000)).toBe(2147483647);
  });

  it('handles far-future timestamps (year 2100+)', () => {
    expect(TemporalConverter.msToSec(4102444800000)).toBe(4102444800);
  });

  it('truncates fractional milliseconds consistently (1500.5 ms -> 1 s)', () => {
    expect(TemporalConverter.msToSec(1500.5)).toBe(1);
  });

  it('truncates sub-second floating input (999.9 ms -> 0 s)', () => {
    expect(TemporalConverter.msToSec(999.9)).toBe(0);
  });

  it('rejects negative timestamps', () => {
    expect(() => TemporalConverter.msToSec(-1000)).toThrow(TimestampError);
  });

  it('rejects zero-adjacent negative timestamps (-1 ms)', () => {
    expect(() => TemporalConverter.msToSec(-1)).toThrow(TimestampError);
  });
});

describe('TemporalConverter.secToMs', () => {
  it('converts the epoch (0 s) to 0 ms', () => {
    expect(TemporalConverter.secToMs(0)).toBe(0);
  });

  it('converts 1 s to 1000 ms', () => {
    expect(TemporalConverter.secToMs(1)).toBe(1000);
  });

  it('converts a representative modern timestamp', () => {
    expect(TemporalConverter.secToMs(1693526400)).toBe(1693526400000);
  });

  it('rejects negative seconds', () => {
    expect(() => TemporalConverter.secToMs(-5)).toThrow(TimestampError);
  });
});

describe('TemporalConverter round-trip consistency', () => {
  it('secToMs(msToSec(ms)) === floor(ms/1000) * 1000 for representative values', () => {
    const samples = [0, 999, 1000, 1500, 1693526400123, 2147483647999];
    for (const ms of samples) {
      expect(TemporalConverter.secToMs(TemporalConverter.msToSec(ms))).toBe(
        Math.floor(ms / 1000) * 1000,
      );
    }
  });

  it('is consistent with the Timestamp domain type (fromMillis round trip)', () => {
    const ms = 1693526400123;
    const converted = TemporalConverter.secToMs(TemporalConverter.msToSec(ms));
    expect(Timestamp.fromMillis(ms).toMillis()).toBe(converted);
  });
});

describe('TemporalConverter.dateToSec', () => {
  it('converts 2021-01-01T00:00:00Z to 1609459200', () => {
    expect(TemporalConverter.dateToSec(new Date('2021-01-01T00:00:00Z'))).toBe(1609459200);
  });

  it('converts the epoch date to 0', () => {
    expect(TemporalConverter.dateToSec(new Date(0))).toBe(0);
  });

  it('truncates sub-second Date precision (1500 ms date -> 1 s)', () => {
    expect(TemporalConverter.dateToSec(new Date(1500))).toBe(1);
  });

  it('rejects dates before the epoch', () => {
    expect(() => TemporalConverter.dateToSec(new Date(-1000))).toThrow(TimestampError);
  });
});

describe('TemporalConverter.secToDate', () => {
  it('converts 1609459200 back to 2021-01-01T00:00:00Z', () => {
    const d = TemporalConverter.secToDate(1609459200);
    expect(d.toISOString()).toBe('2021-01-01T00:00:00.000Z');
  });

  it('is the inverse of dateToSec for UTC dates', () => {
    const iso = '2023-09-01T12:34:56.000Z';
    const roundTripped = TemporalConverter.secToDate(TemporalConverter.dateToSec(new Date(iso)));
    expect(roundTripped.toISOString()).toBe(iso);
  });

  it('round-trips the epoch', () => {
    expect(TemporalConverter.secToDate(0).toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('rejects negative seconds', () => {
    expect(() => TemporalConverter.secToDate(-1)).toThrow(TimestampError);
  });
});

describe('TemporalConverter.convertBatch', () => {
  it('converts an array of millisecond timestamps to seconds', () => {
    expect(TemporalConverter.convertBatch([1000, 2000, 3000])).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(TemporalConverter.convertBatch([])).toEqual([]);
  });

  it('preserves order and length for a large batch', () => {
    const millis = Array.from({ length: 1000 }, (_, i) => (i + 1) * 1000);
    const seconds = TemporalConverter.convertBatch(millis);
    expect(seconds).toHaveLength(1000);
    expect(seconds[0]).toBe(1);
    expect(seconds[999]).toBe(1000);
  });

  it('throws when any input is negative', () => {
    expect(() => TemporalConverter.convertBatch([1000, -1000, 2000])).toThrow(TimestampError);
  });

  it('handles mixed precision by truncating each element independently', () => {
    expect(TemporalConverter.convertBatch([999.9, 1500.5, 2000])).toEqual([0, 1, 2]);
  });
});

describe('TemporalConverter.convertDateBatch', () => {
  it('converts an array of dates to seconds', () => {
    expect(
      TemporalConverter.convertDateBatch([
        new Date('2021-01-01T00:00:00Z'),
        new Date('2021-01-01T00:01:00Z'),
      ]),
    ).toEqual([1609459200, 1609459260]);
  });

  it('returns an empty array for an empty input', () => {
    expect(TemporalConverter.convertDateBatch([])).toEqual([]);
  });
});

describe('TemporalConverter boundary/performance robustness', () => {
  it('completes 100K rapid msToSec conversions quickly', () => {
    const start = Date.now();
    for (let i = 0; i < 100000; i++) {
      TemporalConverter.msToSec(1693526400000);
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('does not mutate the input array passed to convertBatch', () => {
    const input = [1000, 2000, 3000];
    const original = [...input];
    TemporalConverter.convertBatch(input);
    expect(input).toEqual(original);
  });

  it('works with the combined Timestamp API in one flow', () => {
    const ms = 1693526400000;
    const sec = TemporalConverter.msToSec(ms);
    const ts = Timestamp.fromSeconds(sec);
    expect(ts.toSeconds()).toBe(sec);
    expect(Timestamp.fromMillis(ms).toSeconds()).toBe(sec);
  });
});

describe('TemporalConverter UTC consistency (no local-time leakage)', () => {
  it('dateToSec uses UTC regardless of the local platform timezone', () => {
    // 1609459200 is 2021-01-01T00:00:00Z in every timezone.
    const utcDate = new Date(Date.UTC(2021, 0, 1, 0, 0, 0));
    expect(TemporalConverter.dateToSec(utcDate)).toBe(1609459200);
  });

  it('secToDate yields a UTC-normalized ISO string', () => {
    const d = TemporalConverter.secToDate(1609459200);
    expect(d.toISOString()).toBe('2021-01-01T00:00:00.000Z');
  });
});
