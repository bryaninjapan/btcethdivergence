/**
 * Timestamp: Unix seconds (UTC), strongly typed.
 * Prevents millisecond/second confusion by wrapping the value.
 */

export class TimestampError extends Error {
  constructor(message: string) {
    super(`TimestampError: ${message}`);
    this.name = 'TimestampError';
  }
}

export class Timestamp {
  private constructor(private readonly _seconds: number) {
    if (!Number.isInteger(_seconds) || _seconds < 0) {
      throw new TimestampError(`Invalid timestamp: ${_seconds}`);
    }
  }

  // ========== Factories ==========

  /**
   * Create a Timestamp from whole unix seconds.
   *
   * @param seconds Non-negative whole-second unix time.
   * @returns A Timestamp wrapping the value.
   * @throws {TimestampError} if `seconds` is not a non-negative integer.
   */
  static fromSeconds(seconds: number): Timestamp {
    return new Timestamp(seconds);
  }

  /**
   * Create a Timestamp from milliseconds (floored to whole seconds).
   *
   * @param millis Non-negative millisecond unix time.
   * @returns A Timestamp equivalent to the floored second value.
   * @throws {TimestampError} if the floored value is negative or non-integer.
   */
  static fromMillis(millis: number): Timestamp {
    return Timestamp.fromSeconds(Math.floor(millis / 1000));
  }

  /**
   * Create a Timestamp for the current wall-clock time.
   *
   * @returns A Timestamp representing "now" (UTC seconds).
   */
  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  // ========== Conversions ==========

  /**
   * The underlying whole-second unix time.
   *
   * @returns The second-domain value.
   */
  toSeconds(): number {
    return this._seconds;
  }

  /**
   * The value expressed in milliseconds.
   *
   * @returns `seconds * 1000`.
   */
  toMillis(): number {
    return this._seconds * 1000;
  }

  /**
   * The value as a UTC `Date`.
   *
   * @returns `new Date(this.toMillis())`.
   */
  toDate(): Date {
    return new Date(this.toMillis());
  }

  /**
   * Decompose the timestamp into UTC calendar parts.
   *
   * @returns `{ year, month, day, hour }` where month is 1-based.
   */
  toParts(): { year: number; month: number; day: number; hour: number } {
    const d = this.toDate();
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
    };
  }

  // ========== Comparisons ==========

  /**
   * Whether this timestamp is strictly before `other`.
   *
   * @param other The timestamp to compare against.
   * @returns `this._seconds < other._seconds`.
   */
  isBefore(other: Timestamp): boolean {
    return this._seconds < other._seconds;
  }

  /**
   * Whether this timestamp is strictly after `other`.
   *
   * @param other The timestamp to compare against.
   * @returns `this._seconds > other._seconds`.
   */
  isAfter(other: Timestamp): boolean {
    return this._seconds > other._seconds;
  }

  /**
   * Whether this timestamp equals `other`.
   *
   * @param other The timestamp to compare against.
   * @returns `this._seconds === other._seconds`.
   */
  equals(other: Timestamp): boolean {
    return this._seconds === other._seconds;
  }

  // ========== Arithmetic ==========

  /**
   * Return a new Timestamp shifted by `seconds` (does not mutate `this`).
   *
   * @param seconds Offset in seconds (may be negative).
   * @returns A new Timestamp.
   * @throws {TimestampError} if the result is negative.
   */
  plus(seconds: number): Timestamp {
    return Timestamp.fromSeconds(this._seconds + seconds);
  }

  /**
   * Return a new Timestamp shifted back by `seconds` (does not mutate `this`).
   *
   * @param seconds Offset in seconds (may be negative).
   * @returns A new Timestamp.
   * @throws {TimestampError} if the result is negative.
   */
  minus(seconds: number): Timestamp {
    return Timestamp.fromSeconds(this._seconds - seconds);
  }

  // ========== Utilities ==========

  /**
   * Human-readable representation.
   *
   * @returns A string like `Timestamp(1609459200 sec, 2021-01-01T00:00:00.000Z)`.
   */
  toString(): string {
    return `Timestamp(${this._seconds} sec, ${this.toDate().toISOString()})`;
  }
}
