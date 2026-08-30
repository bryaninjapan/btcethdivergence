import { describe, expect, it } from 'vitest';
import {
  YEAR_RANGE,
  buildUtcEpoch,
  dayOptions,
  daysInMonth,
  epochToParts,
  hourOptions,
  monthOptions,
  yearOptions,
} from './datetime.js';

describe('datetime.js pure helpers (REC-07, REC-08)', () => {
  it('yearOptions() is 2021..2026', () => {
    expect(yearOptions()).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(YEAR_RANGE).toEqual({ min: 2021, max: 2026 });
  });

  it('monthOptions() has length 12 and includes 1 and 12', () => {
    expect(monthOptions()).toHaveLength(12);
    expect(monthOptions()).toContain(1);
    expect(monthOptions()).toContain(12);
  });

  it('daysInMonth() is leap-year aware', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  it('daysInMonth() handles 30/31-day months', () => {
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 1)).toBe(31);
  });

  it('buildUtcEpoch() builds the exact UTC instant, not local', () => {
    expect(buildUtcEpoch(2024, 1, 15, 18)).toBe(
      Math.floor(Date.parse('2024-01-15T18:00:00Z') / 1000),
    );
  });

  it('epochToParts() round-trips through buildUtcEpoch()', () => {
    expect(epochToParts(buildUtcEpoch(2024, 1, 15, 18))).toEqual({
      year: 2024,
      month: 1,
      day: 15,
      hour: 18,
    });
  });

  it('hourOptions() has 24 entries, 0..23', () => {
    expect(hourOptions()).toHaveLength(24);
    expect(hourOptions()).toContain(0);
    expect(hourOptions()).toContain(23);
  });
});