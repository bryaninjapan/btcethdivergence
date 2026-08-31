import { describe, it, expect } from 'vitest';
import { Timestamp, TimestampError } from './timestamp.js';

describe('Frontend Timestamp (parity with backend)', () => {
  it('fromMillis + toSeconds returns correct seconds', () => {
    const ts = Timestamp.fromMillis(1694592000123);
    expect(ts.toSeconds()).toBe(1694592000);
  });

  it('now + toSeconds returns current time in seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const ts = Timestamp.now();
    const after = Math.floor(Date.now() / 1000);

    expect(ts.toSeconds()).toBeGreaterThanOrEqual(before);
    expect(ts.toSeconds()).toBeLessThanOrEqual(after);
  });

  it('fromSeconds + toParts returns correct parts', () => {
    const ts = Timestamp.fromSeconds(1694592000);
    const parts = ts.toParts();
    expect(parts.year).toBe(2023);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(13);
  });

  it('rejects negative milliseconds', () => {
    expect(() => Timestamp.fromMillis(-500)).toThrow(TimestampError);
  });

  it('rejects negative seconds', () => {
    expect(() => new Timestamp(-1)).toThrow(TimestampError);
  });

  it('Math.trunc equivalence: fromMillis(positive) == Math.floor(positive)', () => {
    const testCases = [1694592000000, 1694592000123, 1694592000999];
    for (const ms of testCases) {
      const ts = Timestamp.fromMillis(ms);
      const expected = Math.floor(ms / 1000);
      expect(ts.toSeconds()).toBe(expected);
    }
  });

  it('arithmetic: plus/minus operations work correctly', () => {
    const ts = Timestamp.fromSeconds(1000);
    const ts2 = ts.plus(100);
    expect(ts2.toSeconds()).toBe(1100);

    const ts3 = ts2.minus(50);
    expect(ts3.toSeconds()).toBe(1050);
  });

  it('comparison: isBefore, isAfter, equals work correctly', () => {
    const ts1 = Timestamp.fromSeconds(1000);
    const ts2 = Timestamp.fromSeconds(2000);

    expect(ts1.isBefore(ts2)).toBe(true);
    expect(ts2.isAfter(ts1)).toBe(true);
    expect(ts1.equals(ts1)).toBe(true);
    expect(ts1.equals(ts2)).toBe(false);
  });
});
