import { TimestampError } from '../lib/timestamp';

/**
 * TemporalConverter: the single source of truth for millisecond/second time
 * conversions across the backend.
 *
 * Historically each module that touched Binance or D1 timestamps inlined its
 * own `Math.floor(ms / 1000)` or `Timestamp.fromMillis(ms).toSeconds()`,
 * which caused unit-mix bugs (a "seconds" value occasionally fed where
 * milliseconds were expected, and vice versa). All millisecond ↔ second and
 * Date ↔ second conversions should go through this class so the boundary
 * semantics live in exactly one place.
 *
 * The class mirrors the non-negative integer-second invariant of the
 * `Timestamp` domain type: `msToSec` rejects negative inputs rather than
 * silently producing a negative "second" value that could poison a D1
 * BETWEEN range query or a record's start_time.
 *
 * All methods are static and pure (no instance state), so call sites read as
 * `TemporalConverter.msToSec(...)`.
 */
export class TemporalConverter {
  private constructor() {
    // Static utility class — never instantiated.
  }

  /**
   * Convert milliseconds to whole seconds (floor division).
   *
   * @param ms - Millisecond timestamp (non-negative).
   * @returns The equivalent number of whole seconds.
   * @throws {TimestampError} if `ms` is negative.
   * @example
   * ```ts
   * TemporalConverter.msToSec(1500); // 1
   * TemporalConverter.msToSec(0);    // 0
   * ```
   */
  static msToSec(ms: number): number {
    if (ms < 0) {
      throw new TimestampError(`msToSec: negative input ${ms}`);
    }
    return Math.floor(ms / 1000);
  }

  /**
   * Convert whole seconds to milliseconds.
   *
   * @param sec - Second timestamp (non-negative).
   * @returns The equivalent value in milliseconds.
   * @throws {TimestampError} if `sec` is negative.
   * @example
   * ```ts
   * TemporalConverter.secToMs(1); // 1000
   * ```
   */
  static secToMs(sec: number): number {
    if (sec < 0) {
      throw new TimestampError(`secToMs: negative input ${sec}`);
    }
    return sec * 1000;
  }

  /**
   * Convert a `Date` to whole unix seconds (UTC).
   *
   * @param date - The Date to convert.
   * @returns The date expressed as whole seconds since the epoch.
   * @throws {TimestampError} if the date is before the epoch (negative seconds).
   * @example
   * ```ts
   * TemporalConverter.dateToSec(new Date('2021-01-01T00:00:00Z')); // 1609459200
   * ```
   */
  static dateToSec(date: Date): number {
    const ms = date.getTime();
    if (ms < 0) {
      throw new TimestampError(`dateToSec: date before epoch ${date.toISOString()}`);
    }
    return Math.floor(ms / 1000);
  }

  /**
   * Convert whole unix seconds back to a UTC `Date`.
   *
   * @param sec - Second timestamp (non-negative).
   * @returns The `Date` equivalent.
   * @throws {TimestampError} if `sec` is negative.
   * @example
   * ```ts
   * TemporalConverter.secToDate(1609459200).toISOString(); // '2021-01-01T00:00:00.000Z'
   * ```
   */
  static secToDate(sec: number): Date {
    if (sec < 0) {
      throw new TimestampError(`secToDate: negative input ${sec}`);
    }
    return new Date(sec * 1000);
  }

  /**
   * Convert an array of millisecond timestamps to whole seconds in one pass.
   *
   * @param millis - Array of millisecond timestamps (non-negative).
   * @returns Array of equivalent whole-second values, same length/order.
   * @throws {TimestampError} if any input is negative.
   * @example
   * ```ts
   * TemporalConverter.convertBatch([1000, 2000, 3000]); // [1, 2, 3]
   * TemporalConverter.convertBatch([]);                 // []
   * ```
   */
  static convertBatch(millis: number[]): number[] {
    return millis.map((ms) => TemporalConverter.msToSec(ms));
  }

  /**
   * Convert an array of `Date` objects to whole unix seconds in one pass.
   *
   * @param dates - Array of Dates to convert.
   * @returns Array of equivalent whole-second values.
   * @throws {TimestampError} if any date is before the epoch.
   * @example
   * ```ts
   * TemporalConverter.convertDateBatch([new Date('2021-01-01T00:00:00Z')]); // [1609459200]
   * ```
   */
  static convertDateBatch(dates: Date[]): number[] {
    return dates.map((d) => TemporalConverter.dateToSec(d));
  }
}
