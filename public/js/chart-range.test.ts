import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_SECONDS,
  PADDING_SECONDS,
  nowRange,
  parseRangeParams,
  recordToRange,
} from './chart-range.js';

describe('chart-range.js range math (CHART-05, CHART-06)', () => {
  it('recordToRange applies exactly ±24h padding before ms conversion (SC3)', () => {
    const { startMs, endMs } = recordToRange({ start_time: 1704067200, end_time: 1704074400 });
    expect(startMs).toBe(1703980800000);
    expect(endMs).toBe(1704160800000);
    expect(startMs).toBe((1704067200 - PADDING_SECONDS) * 1000);
    expect(endMs).toBe((1704074400 + PADDING_SECONDS) * 1000);
  });

  it('parseRangeParams parses a valid start/end pair', () => {
    expect(parseRangeParams('?start=1703980800000&end=1704160800000')).toEqual({
      startMs: 1703980800000,
      endMs: 1704160800000,
    });
  });

  it('parseRangeParams empty string returns null', () => {
    expect(parseRangeParams('')).toBeNull();
  });

  it('parseRangeParams missing end param returns null', () => {
    expect(parseRangeParams('?start=1703980800000')).toBeNull();
  });

  it('parseRangeParams missing start param returns null', () => {
    expect(parseRangeParams('?end=1704160800000')).toBeNull();
  });

  it('parseRangeParams non-numeric values return null', () => {
    expect(parseRangeParams('?start=abc&end=xyz')).toBeNull();
  });

  it('parseRangeParams inverted range (start >= end) returns null', () => {
    expect(parseRangeParams('?start=10&end=5')).toBeNull();
    expect(parseRangeParams('?start=5&end=5')).toBeNull();
  });

  it('parseRangeParams ignores extra params and still returns the range', () => {
    expect(parseRangeParams('?symbol=BTCUSDT&start=1703980800000&end=1704160800000')).toEqual({
      startMs: 1703980800000,
      endMs: 1704160800000,
    });
  });

  it('nowRange returns the last 30-day window anchored near now', () => {
    const r = nowRange();
    expect(r.endMs - r.startMs).toBe(DEFAULT_WINDOW_SECONDS * 1000);
    expect(Math.abs(r.endMs - Date.now())).toBeLessThanOrEqual(1000);
  });

  it('round-trip: recordToRange output parses back exactly (SC3 contract)', () => {
    const { startMs, endMs } = recordToRange({ start_time: 1704067200, end_time: 1704074400 });
    expect(parseRangeParams(`?start=${startMs}&end=${endMs}`)).toEqual({ startMs, endMs });
  });
});