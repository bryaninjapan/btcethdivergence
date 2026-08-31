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

  static fromSeconds(seconds: number): Timestamp {
    return new Timestamp(seconds);
  }

  static fromMillis(millis: number): Timestamp {
    return Timestamp.fromSeconds(Math.floor(millis / 1000));
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  // ========== Conversions ==========

  toSeconds(): number {
    return this._seconds;
  }

  toMillis(): number {
    return this._seconds * 1000;
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

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

  isBefore(other: Timestamp): boolean {
    return this._seconds < other._seconds;
  }

  isAfter(other: Timestamp): boolean {
    return this._seconds > other._seconds;
  }

  equals(other: Timestamp): boolean {
    return this._seconds === other._seconds;
  }

  // ========== Arithmetic ==========

  plus(seconds: number): Timestamp {
    return Timestamp.fromSeconds(this._seconds + seconds);
  }

  minus(seconds: number): Timestamp {
    return Timestamp.fromSeconds(this._seconds - seconds);
  }

  // ========== Utilities ==========

  toString(): string {
    return `Timestamp(${this._seconds} sec, ${this.toDate().toISOString()})`;
  }
}
