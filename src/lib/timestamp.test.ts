import { describe, it, expect } from 'vitest';
import { Timestamp, TimestampError, TimeConverter } from './timestamp';

describe('Timestamp', () => {
  // ========== Factory Methods ==========

  describe('fromSeconds()', () => {
    it('creates timestamp from Unix seconds', () => {
      const ts = Timestamp.fromSeconds(1693526400);
      expect(ts.toSeconds()).toBe(1693526400);
    });

    it('rejects negative seconds', () => {
      expect(() => Timestamp.fromSeconds(-1)).toThrow(TimestampError);
    });

    it('rejects non-integer seconds', () => {
      expect(() => Timestamp.fromSeconds(1693526400.5)).toThrow(TimestampError);
    });

    it('accepts zero', () => {
      const ts = Timestamp.fromSeconds(0);
      expect(ts.toSeconds()).toBe(0);
    });
  });

  describe('fromMillis()', () => {
    it('converts milliseconds to seconds (floors)', () => {
      const ts = Timestamp.fromMillis(1693526400000);
      expect(ts.toSeconds()).toBe(1693526400);
    });

    it('floors fractional milliseconds', () => {
      const ts = Timestamp.fromMillis(1693526400999);
      expect(ts.toSeconds()).toBe(1693526400);
    });

    it('handles small millisecond values', () => {
      const ts = Timestamp.fromMillis(999);
      expect(ts.toSeconds()).toBe(0);
    });

    it('rejects negative milliseconds', () => {
      expect(() => Timestamp.fromMillis(-1000)).toThrow(TimestampError);
    });
  });

  describe('now()', () => {
    it('creates timestamp from current time', () => {
      const beforeMs = Date.now();
      const ts = Timestamp.now();
      const afterMs = Date.now();

      const tsSec = ts.toSeconds();
      const beforeSec = Math.floor(beforeMs / 1000);
      const afterSec = Math.floor(afterMs / 1000);

      expect(tsSec).toBeGreaterThanOrEqual(beforeSec);
      expect(tsSec).toBeLessThanOrEqual(afterSec);
    });
  });

  // ========== Conversions ==========

  describe('toSeconds()', () => {
    it('returns internal seconds value', () => {
      const ts = Timestamp.fromSeconds(1693526400);
      expect(ts.toSeconds()).toBe(1693526400);
    });
  });

  describe('toMillis()', () => {
    it('converts seconds to milliseconds', () => {
      const ts = Timestamp.fromSeconds(1693526400);
      expect(ts.toMillis()).toBe(1693526400000);
    });

    it('handles zero', () => {
      const ts = Timestamp.fromSeconds(0);
      expect(ts.toMillis()).toBe(0);
    });
  });

  describe('toDate()', () => {
    it('converts to JavaScript Date in UTC', () => {
      // 2023-08-31 15:00:00 UTC = 1693494000
      const ts = Timestamp.fromSeconds(1693494000);
      const date = ts.toDate();

      expect(date.getUTCFullYear()).toBe(2023);
      expect(date.getUTCMonth()).toBe(7); // 0-indexed
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(15);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it('round-trips: millis → Timestamp → Date → millis', () => {
      const originalMs = 1693494000000;
      const ts = Timestamp.fromMillis(originalMs);
      const date = ts.toDate();
      expect(date.getTime()).toBe(originalMs);
    });
  });

  describe('toParts()', () => {
    it('converts to UTC parts {year, month, day, hour}', () => {
      // 2023-08-31 15:00:00 UTC = 1693494000
      const ts = Timestamp.fromSeconds(1693494000);
      const parts = ts.toParts();

      expect(parts).toEqual({
        year: 2023,
        month: 8,
        day: 31,
        hour: 15,
      });
    });

    it('handles zero timestamp (1970-01-01)', () => {
      const ts = Timestamp.fromSeconds(0);
      const parts = ts.toParts();

      expect(parts).toEqual({
        year: 1970,
        month: 1,
        day: 1,
        hour: 0,
      });
    });

    it('handles mid-month dates', () => {
      // 2023-08-15 12:30:00 UTC = 1692102600
      const ts = Timestamp.fromSeconds(1692102600);
      const parts = ts.toParts();

      expect(parts.year).toBe(2023);
      expect(parts.month).toBe(8);
      expect(parts.day).toBe(15);
      expect(parts.hour).toBe(12);
    });
  });

  // ========== Comparisons ==========

  describe('isBefore()', () => {
    it('returns true if this < other', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(200);
      expect(ts1.isBefore(ts2)).toBe(true);
    });

    it('returns false if this >= other', () => {
      const ts1 = Timestamp.fromSeconds(200);
      const ts2 = Timestamp.fromSeconds(100);
      expect(ts1.isBefore(ts2)).toBe(false);
    });

    it('returns false if equal', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(100);
      expect(ts1.isBefore(ts2)).toBe(false);
    });
  });

  describe('isAfter()', () => {
    it('returns true if this > other', () => {
      const ts1 = Timestamp.fromSeconds(200);
      const ts2 = Timestamp.fromSeconds(100);
      expect(ts1.isAfter(ts2)).toBe(true);
    });

    it('returns false if this <= other', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(200);
      expect(ts1.isAfter(ts2)).toBe(false);
    });

    it('returns false if equal', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(100);
      expect(ts1.isAfter(ts2)).toBe(false);
    });
  });

  describe('equals()', () => {
    it('returns true if timestamps are equal', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(100);
      expect(ts1.equals(ts2)).toBe(true);
    });

    it('returns false if timestamps differ', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(101);
      expect(ts1.equals(ts2)).toBe(false);
    });
  });

  // ========== Arithmetic ==========

  describe('plus()', () => {
    it('adds seconds to timestamp', () => {
      const ts = Timestamp.fromSeconds(100);
      const result = ts.plus(50);
      expect(result.toSeconds()).toBe(150);
    });

    it('returns new Timestamp instance (immutability)', () => {
      const ts = Timestamp.fromSeconds(100);
      const result = ts.plus(50);
      expect(ts.toSeconds()).toBe(100); // original unchanged
      expect(result.toSeconds()).toBe(150);
    });

    it('handles zero addition', () => {
      const ts = Timestamp.fromSeconds(100);
      const result = ts.plus(0);
      expect(result.toSeconds()).toBe(100);
    });
  });

  describe('minus()', () => {
    it('subtracts seconds from timestamp', () => {
      const ts = Timestamp.fromSeconds(150);
      const result = ts.minus(50);
      expect(result.toSeconds()).toBe(100);
    });

    it('returns new Timestamp instance (immutability)', () => {
      const ts = Timestamp.fromSeconds(150);
      const result = ts.minus(50);
      expect(ts.toSeconds()).toBe(150); // original unchanged
      expect(result.toSeconds()).toBe(100);
    });

    it('throws if result would be negative', () => {
      const ts = Timestamp.fromSeconds(50);
      expect(() => ts.minus(100)).toThrow(TimestampError);
    });
  });

  // ========== TimeConverter ==========

  describe('TimeConverter.fromParts()', () => {
    it('converts year/month/day/hour to Timestamp', () => {
      // 2023-08-31 15:00:00 UTC = 1693494000
      const ts = TimeConverter.fromParts(2023, 8, 31, 15);
      expect(ts.toSeconds()).toBe(1693494000);
    });

    it('handles January (month=1)', () => {
      // 2023-01-01 00:00:00 UTC = 1672531200
      const ts = TimeConverter.fromParts(2023, 1, 1, 0);
      expect(ts.toSeconds()).toBe(1672531200);
    });

    it('handles leap year dates', () => {
      // 2024 is leap year
      // 2024-02-29 12:00:00 UTC
      const ts = TimeConverter.fromParts(2024, 2, 29, 12);
      const parts = ts.toParts();
      expect(parts.year).toBe(2024);
      expect(parts.month).toBe(2);
      expect(parts.day).toBe(29);
    });

    it('clamps invalid days (e.g., Feb 30 → Feb 28/29)', () => {
      // Feb 30 doesn't exist; should clamp to Feb 28
      const ts = TimeConverter.fromParts(2023, 2, 30, 0);
      const parts = ts.toParts();
      expect(parts.month).toBe(3); // Rolled over to March
      expect(parts.day).toBe(2); // March 2
    });

    it('rejects invalid month', () => {
      expect(() => TimeConverter.fromParts(2023, 13, 1, 0)).toThrow();
      expect(() => TimeConverter.fromParts(2023, 0, 1, 0)).toThrow();
    });

    it('rejects invalid hour', () => {
      expect(() => TimeConverter.fromParts(2023, 8, 31, 24)).toThrow();
      expect(() => TimeConverter.fromParts(2023, 8, 31, -1)).toThrow();
    });
  });

  describe('TimeConverter.toParts()', () => {
    it('converts Timestamp to parts', () => {
      const ts = Timestamp.fromSeconds(1693494000);
      const parts = TimeConverter.toParts(ts);

      expect(parts).toEqual({
        year: 2023,
        month: 8,
        day: 31,
        hour: 15,
      });
    });

    it('is inverse of fromParts()', () => {
      const originalParts = { year: 2023, month: 8, day: 31, hour: 15 };
      const ts = TimeConverter.fromParts(
        originalParts.year,
        originalParts.month,
        originalParts.day,
        originalParts.hour
      );
      const roundTrip = TimeConverter.toParts(ts);

      expect(roundTrip).toEqual(originalParts);
    });
  });

  // ========== Utilities ==========

  describe('toString()', () => {
    it('returns human-readable representation', () => {
      const ts = Timestamp.fromSeconds(1693494000);
      const str = ts.toString();

      expect(str).toContain('1693494000');
      expect(str).toContain('2023');
      expect(str).toContain('08-31'); // ISO date part
    });
  });

  // ========== Immutability ==========

  describe('Immutability', () => {
    it('cannot modify timestamp after creation', () => {
      const ts = Timestamp.fromSeconds(100);
      expect(ts.toSeconds()).toBe(100);
      // Calling plus/minus returns new instance, doesn't modify original
      ts.plus(50);
      expect(ts.toSeconds()).toBe(100);
    });
  });

  // ========== Integration scenarios ==========

  describe('Real-world usage', () => {
    it('handles Binance backfill scenario: ms→sec→D1', () => {
      // Scenario: Binance returns 1693526400000 ms, store in D1 as seconds
      const binanceMs = 1693526400000;
      const ts = Timestamp.fromMillis(binanceMs);
      const d1Value = ts.toSeconds();

      expect(d1Value).toBe(1693526400);
    });

    it('handles form input scenario: parts→Timestamp→millis→Date', () => {
      // User enters year=2023, month=8, day=31, hour=15
      const ts = TimeConverter.fromParts(2023, 8, 31, 15);
      const millis = ts.toMillis();
      const date = new Date(millis);

      expect(date.getUTCFullYear()).toBe(2023);
      expect(date.getUTCMonth()).toBe(7);
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(15);
    });

    it('handles range comparison: ts1 < ts2 < ts3', () => {
      const ts1 = Timestamp.fromSeconds(100);
      const ts2 = Timestamp.fromSeconds(200);
      const ts3 = Timestamp.fromSeconds(300);

      expect(ts1.isBefore(ts2)).toBe(true);
      expect(ts2.isBefore(ts3)).toBe(true);
      expect(ts1.isBefore(ts3)).toBe(true);
      expect(ts3.isAfter(ts1)).toBe(true);
    });
  });
});
