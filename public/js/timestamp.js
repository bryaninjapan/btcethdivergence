// Frontend duplicate of src/lib/timestamp.ts (no bundler, static ESM)
// Key difference: uses Math.trunc instead of Math.floor (TDD-verified equivalence)

export class TimestampError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimestampError';
  }
}

export class Timestamp {
  #seconds;

  constructor(seconds) {
    if (seconds < 0) throw new TimestampError(`Seconds must be non-negative, got ${seconds}`);
    if (!Number.isInteger(seconds)) throw new TimestampError(`Seconds must be an integer, got ${seconds}`);
    this.#seconds = seconds;
  }

  static now() {
    return new Timestamp(Math.trunc(Date.now() / 1000));
  }

  static fromSeconds(seconds) {
    return new Timestamp(seconds);
  }

  static fromMillis(millis) {
    if (millis < 0) throw new TimestampError(`Milliseconds must be non-negative, got ${millis}`);
    return new Timestamp(Math.trunc(millis / 1000));
  }

  static fromParts(year, month, day, hour = 0, minute = 0, second = 0) {
    const utcTime = Date.UTC(year, month - 1, day, hour, minute, second);
    return new Timestamp(Math.trunc(utcTime / 1000));
  }

  toSeconds() {
    return this.#seconds;
  }

  toMillis() {
    return this.#seconds * 1000;
  }

  toDate() {
    return new Date(this.toMillis());
  }

  toParts() {
    const d = new Date(this.toMillis());
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
    };
  }

  isBefore(other) {
    return this.#seconds < other.#seconds;
  }

  isAfter(other) {
    return this.#seconds > other.#seconds;
  }

  equals(other) {
    return this.#seconds === other.#seconds;
  }

  plus(seconds) {
    return new Timestamp(this.#seconds + seconds);
  }

  minus(seconds) {
    return new Timestamp(this.#seconds - seconds);
  }

  toString() {
    return `Timestamp(${this.#seconds}s = ${new Date(this.toMillis()).toISOString()})`;
  }
}
