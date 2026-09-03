import { describe, expect, it, vi } from 'vitest';
import {
  ERROR_KINDS,
  LOG_LEVELS,
  classifyError,
  consoleSink,
  createLogger,
  createRecord,
  redactRecord,
  serializeError,
  type LogLevel,
  type LogRecord,
} from './logger';
import { AppError, ErrorCode, ExternalServiceError, ValidationError } from './errors';

describe('logger.ts — record contract', () => {
  it('exposes levels and error kinds as constants', () => {
    expect(LOG_LEVELS).toEqual({ debug: 10, info: 20, warn: 30, error: 40 });
    expect(ERROR_KINDS).toEqual([
      'abort-timeout',
      'abort-superseded',
      'validation',
      'service',
      'database',
      'auth',
      'unknown',
    ]);
  });

  it('creates a record with the full contract shape', () => {
    const record = createRecord('error', 'api', 'records.create', 'boom', { a: 1 }, {
      name: 'Error',
      message: 'boom',
      kind: 'unknown',
    });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record).toMatchObject({
      level: 'error',
      component: 'api',
      action: 'records.create',
      message: 'boom',
      context: { a: 1 },
      error: { name: 'Error', message: 'boom', kind: 'unknown' },
    });
  });

  it('omits optional context/error when not provided', () => {
    const record = createRecord('info', 'api', 'health', 'ok');
    expect(record).not.toHaveProperty('context');
    expect(record).not.toHaveProperty('error');
  });
});

describe('logger.ts — classifyError', () => {
  it('classifies backend error codes', () => {
    expect(classifyError({}, 'VALIDATION_ERROR')).toBe('validation');
    expect(classifyError({}, 'DATABASE_ERROR')).toBe('database');
    expect(classifyError({}, 'SERVICE_ERROR')).toBe('service');
    expect(classifyError({}, 'AUTH_ERROR')).toBe('auth');
  });

  it('reads the code from AppError instances', () => {
    expect(classifyError(new ValidationError('id', 'bad'))).toBe('validation');
    expect(classifyError(new ExternalServiceError('Binance', 'down'))).toBe('service');
    const auth = new AppError(ErrorCode.AUTH_ERROR, 'denied');
    expect(classifyError(auth)).toBe('auth');
  });

  it('classifies abort-timeout from TimeoutError name', () => {
    expect(classifyError({ name: 'TimeoutError', message: 'timed out' })).toBe('abort-timeout');
  });

  it('classifies abort-timeout from a TimeoutError abort reason (fetch cause)', () => {
    const timeout = new DOMException('The operation timed out', 'TimeoutError');
    const aborted = new DOMException('This operation was aborted', 'AbortError');
    aborted.cause = timeout;
    expect(classifyError(aborted)).toBe('abort-timeout');
  });

  it('classifies plain AbortError as abort-superseded (app convention)', () => {
    expect(classifyError(new DOMException('aborted', 'AbortError'))).toBe('abort-superseded');
  });

  it('classifies by error name', () => {
    expect(classifyError({ name: 'ValidationError' })).toBe('validation');
    expect(classifyError({ name: 'ZodError' })).toBe('validation');
    expect(classifyError({ name: 'DatabaseError' })).toBe('database');
    expect(classifyError({ name: 'AuthenticationError' })).toBe('auth');
    expect(classifyError({ name: 'ExternalServiceError' })).toBe('service');
    expect(classifyError({ name: 'TypeError' })).toBe('service');
  });

  it('defaults unknown errors to unknown', () => {
    expect(classifyError({ name: 'RandomError' })).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});

describe('logger.ts — serializeError', () => {
  it('serializes a full error', () => {
    const error = new ExternalServiceError('Binance', 'boom');
    const out = serializeError(error);
    expect(out).toMatchObject({ name: 'ExternalServiceError', kind: 'service' });
    expect(out.message).toContain('boom');
    expect(out.code).toBe(ErrorCode.SERVICE_ERROR);
    expect(out.stack).toBeTypeOf('string');
  });

  it('handles null/undefined input', () => {
    expect(serializeError(null)).toEqual({ name: 'Error', message: 'Unknown error', kind: 'unknown' });
  });

  it('omits code and stack when absent', () => {
    expect(serializeError({ name: 'Error', message: 'simple' })).toEqual({
      name: 'Error',
      message: 'simple',
      kind: 'unknown',
    });
  });

  it('accepts an explicit kind override', () => {
    expect(serializeError({ name: 'Error', message: 'x' }, 'abort-superseded').kind).toBe('abort-superseded');
  });
});

describe('logger.ts — redaction', () => {
  it('replaces notes/tags content with lengths (blocking rule)', () => {
    const record = createRecord('info', 'records', 'submitForm', 'saved', {
      record_id: 7,
      notes: 'my secret divergence note',
      tags: 'btc,eth',
    });
    const redacted = redactRecord(record);
    expect(redacted.context).toEqual({
      record_id: 7,
      notes_len: 'my secret divergence note'.length,
      tags_len: 'btc,eth'.length,
    });
    expect(JSON.stringify(redacted)).not.toContain('secret divergence');
  });

  it('is case-insensitive for sensitive keys', () => {
    const redacted = redactRecord({ timestamp: '', level: 'info', component: 'c', action: 'a', message: 'm', context: { Notes: 'abc', TAGS: 'xy' } });
    expect(redacted.context).toEqual({ notes_len: 3, tags_len: 2 });
  });

  it('passes non-sensitive context through unchanged', () => {
    const redacted = redactRecord({ timestamp: '', level: 'info', component: 'c', action: 'a', message: 'm', context: { record_id: 1, startMs: 100 } });
    expect(redacted.context).toEqual({ record_id: 1, startMs: 100 });
  });
});

describe('logger.ts — createLogger dispatch', () => {
  it('dispatches records to all injected sinks', () => {
    const sinkA = { log: vi.fn() };
    const sinkB = { log: vi.fn() };
    const logger = createLogger('api', { sinks: [sinkA, sinkB] });
    logger.info('records.create', 'created', { id: 1 });
    expect(sinkA.log).toHaveBeenCalledTimes(1);
    expect(sinkB.log).toHaveBeenCalledTimes(1);
    const record = sinkA.log.mock.calls[0][0];
    expect(record.component).toBe('api');
    expect(record.action).toBe('records.create');
    expect(record.level).toBe('info');
  });

  it('respects level filtering (debug suppressed at default info)', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('api', { sinks: [sink] });
    logger.debug('transition', 'init → ready');
    logger.info('health', 'ok');
    expect(sink.log).toHaveBeenCalledTimes(1);
    expect(sink.log.mock.calls[0][0].action).toBe('health');
  });

  it('setLevel raises the threshold', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('api', { sinks: [sink] });
    logger.setLevel('debug');
    logger.debug('transition', 't');
    expect(sink.log).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown levels', () => {
    const logger = createLogger('api', { sinks: [{ log: vi.fn() }] });
    expect(() => logger.setLevel('verbose' as never)).toThrow('Unknown log level');
    expect(() => logger.setLevel('constructor' as never)).toThrow('Unknown log level');
  });

  it('withComponent creates a derived logger bound to a new component', () => {
    const sink = { log: vi.fn() };
    const derived = createLogger('http', { sinks: [sink] }).withComponent('client-log');
    derived.info('ingest', 'ok');
    expect(sink.log.mock.calls[0][0].component).toBe('client-log');
  });

  it('captureException serializes the error and defaults to error level', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('api', { sinks: [sink] });
    logger.captureException('errorMiddleware', new ExternalServiceError('Binance', 'down'));
    const record = sink.log.mock.calls[0][0];
    expect(record.level).toBe('error');
    expect(record.error).toMatchObject({ name: 'ExternalServiceError', kind: 'service' });
    expect(record.message).toContain('down');
  });

  it('captureException honors a custom level', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('api', { sinks: [sink] });
    logger.captureException('records.update', new Error('x'), {}, 'warn');
    expect(sink.log.mock.calls[0][0].level).toBe('warn');
  });

  it('redacts user content at dispatch time', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('records', { sinks: [sink] });
    logger.info('submitForm', 'saved', { record_id: 1, notes: 'secret', tags: 'a' });
    expect(sink.log.mock.calls[0][0].context).toEqual({ record_id: 1, notes_len: 6, tags_len: 1 });
  });
});

describe('logger.ts — consoleSink', () => {
  it('writes structured JSON to the console-like target by level', () => {
    const lines: Record<string, string[]> = { log: [], warn: [], error: [] };
    const target = {
      log: (l: string) => lines.log.push(l),
      warn: (l: string) => lines.warn.push(l),
      error: (l: string) => lines.error.push(l),
    };
    const sink = consoleSink(target);
    const record = (level: LogLevel, action: string): LogRecord => ({
      timestamp: new Date().toISOString(),
      level,
      component: 'api',
      action,
      message: 'm',
    });
    sink.log(record('error', 'a'));
    sink.log(record('warn', 'w'));
    sink.log(record('info', 'i'));
    expect(lines.error).toHaveLength(1);
    expect(lines.warn).toHaveLength(1);
    expect(lines.log).toHaveLength(1);
    expect(JSON.parse(lines.error[0]).action).toBe('a');
    expect(JSON.parse(lines.warn[0]).action).toBe('w');
    expect(JSON.parse(lines.log[0]).action).toBe('i');
  });
});