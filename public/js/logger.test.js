import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  LOG_LEVELS,
  ERROR_KINDS,
  classifyError,
  consoleSink,
  createBeaconSink,
  createLogger,
  createRecord,
  redactRecord,
  serializeError,
  installGlobalHandlers,
} from './logger.js';

describe('logger.js — record contract', () => {
  it('exposes levels and error kinds as frozen constants', () => {
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
    const record = createRecord('error', 'charts', 'loadRange', 'boom', { a: 1 }, {
      name: 'Error',
      message: 'boom',
      kind: 'unknown',
    });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.level).toBe('error');
    expect(record.component).toBe('charts');
    expect(record.action).toBe('loadRange');
    expect(record.message).toBe('boom');
    expect(record.context).toEqual({ a: 1 });
    expect(record.error).toEqual({ name: 'Error', message: 'boom', kind: 'unknown' });
  });

  it('omits optional context/error when not provided', () => {
    const record = createRecord('info', 'charts', 'init', 'ready');
    expect(record).not.toHaveProperty('context');
    expect(record).not.toHaveProperty('error');
  });
});

describe('logger.js — classifyError', () => {
  it('classifies backend error codes', () => {
    expect(classifyError({}, 'VALIDATION_ERROR')).toBe('validation');
    expect(classifyError({}, 'DATABASE_ERROR')).toBe('database');
    expect(classifyError({}, 'SERVICE_ERROR')).toBe('service');
    expect(classifyError({}, 'AUTH_ERROR')).toBe('auth');
  });

  it('classifies abort-timeout from TimeoutError name', () => {
    expect(classifyError({ name: 'TimeoutError', message: 'The operation timed out' })).toBe('abort-timeout');
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

  it('classifies validation/database/auth/service by error name', () => {
    expect(classifyError({ name: 'ValidationError' })).toBe('validation');
    expect(classifyError({ name: 'ZodError' })).toBe('validation');
    expect(classifyError({ name: 'DatabaseError' })).toBe('database');
    expect(classifyError({ name: 'AuthenticationError' })).toBe('auth');
    expect(classifyError({ name: 'ExternalServiceError' })).toBe('service');
    expect(classifyError({ name: 'TypeError' })).toBe('service');
  });

  it('classifies frontend ApiError via its code property', () => {
    expect(classifyError({ name: 'ApiError', code: 'SERVICE_ERROR' })).toBe('service');
    expect(classifyError({ name: 'ApiError', code: 'DATABASE_ERROR' })).toBe('database');
  });

  it('defaults unknown errors to unknown', () => {
    expect(classifyError({ name: 'RandomError' })).toBe('unknown');
    expect(classifyError(null)).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});

describe('logger.js — serializeError', () => {
  it('serializes a full error', () => {
    const error = new TypeError('boom');
    error.code = 'SERVICE_ERROR';
    error.stack = 'at fn';
    const out = serializeError(error);
    expect(out).toMatchObject({ name: 'TypeError', message: 'boom', code: 'SERVICE_ERROR', kind: 'service' });
    expect(out.stack).toBe('at fn');
  });

  it('handles null/undefined input', () => {
    expect(serializeError(null)).toEqual({ name: 'Error', message: 'Unknown error', kind: 'unknown' });
  });

  it('omits code and stack when absent', () => {
    const out = serializeError({ name: 'Error', message: 'simple' });
    expect(out).toEqual({ name: 'Error', message: 'simple', kind: 'unknown' });
  });

  it('accepts an explicit kind override', () => {
    expect(serializeError({ name: 'Error', message: 'x' }, 'abort-superseded').kind).toBe('abort-superseded');
  });
});

describe('logger.js — redaction', () => {
  it('replaces notes/tags content with lengths (blocking rule)', () => {
    const record = createRecord('info', 'records', 'submitForm', 'saved', {
      record_id: 7,
      notes: 'my secret divergence note',
      tags: 'btc,eth',
    });
    const redacted = redactRecord(record);
    expect(redacted.context.notes_len).toBe('my secret divergence note'.length);
    expect(redacted.context.tags_len).toBe('btc,eth'.length);
    expect(redacted.context).not.toHaveProperty('notes');
    expect(redacted.context).not.toHaveProperty('tags');
    expect(JSON.stringify(redacted)).not.toContain('secret divergence');
  });

  it('is case-insensitive for sensitive keys', () => {
    const redacted = redactRecord({ context: { Notes: 'abc', TAGS: 'xy' }, message: 'm' });
    expect(redacted.context.notes_len).toBe(3);
    expect(redacted.context.tags_len).toBe(2);
  });

  it('passes non-sensitive context through unchanged', () => {
    const redacted = redactRecord({ context: { record_id: 1, startMs: 100 } });
    expect(redacted.context).toEqual({ record_id: 1, startMs: 100 });
  });

  it('returns the record unchanged when context is absent or not an object', () => {
    expect(redactRecord({ message: 'x' })).toEqual({ message: 'x' });
    const arr = redactRecord({ context: ['a'] });
    expect(arr.context).toEqual(['a']);
  });
});

describe('logger.js — createLogger dispatch', () => {
  it('dispatches records to all injected sinks', () => {
    const sinkA = { log: vi.fn() };
    const sinkB = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sinkA, sinkB] });
    logger.info('init', 'ready', { charts: 2 });
    expect(sinkA.log).toHaveBeenCalledTimes(1);
    expect(sinkB.log).toHaveBeenCalledTimes(1);
    const record = sinkA.log.mock.calls[0][0];
    expect(record.component).toBe('charts');
    expect(record.action).toBe('init');
    expect(record.level).toBe('info');
  });

  it('respects level filtering (debug suppressed at default info)', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    logger.debug('transition', 'init → ready');
    logger.info('init', 'ready');
    expect(sink.log).toHaveBeenCalledTimes(1);
    expect(sink.log.mock.calls[0][0].action).toBe('init');
  });

  it('setLevel raises/lowers the threshold', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    logger.setLevel('debug');
    logger.debug('transition', 't');
    expect(sink.log).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown levels', () => {
    const logger = createLogger('charts', { sinks: [{ log: vi.fn() }] });
    expect(() => logger.setLevel('verbose')).toThrow('Unknown log level');
  });

  it('withComponent creates a derived logger bound to a new component', () => {
    const sink = { log: vi.fn() };
    const parent = createLogger('http', { sinks: [sink] });
    const derived = parent.withComponent('client-log');
    derived.info('ingest', 'ok');
    expect(sink.log.mock.calls[0][0].component).toBe('client-log');
  });

  it('captureException serializes the error and defaults to error level', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    logger.captureException('loadRange', new TypeError('boom'), { startMs: 1 });
    const record = sink.log.mock.calls[0][0];
    expect(record.level).toBe('error');
    expect(record.error).toMatchObject({ name: 'TypeError', message: 'boom', kind: 'service' });
    expect(record.action).toBe('loadRange');
  });

  it('captureException honors a custom level', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    logger.captureException('loadRange.superseded', new DOMException('aborted', 'AbortError'), {}, 'warn');
    expect(sink.log.mock.calls[0][0].level).toBe('warn');
  });

  it('redacts user content at dispatch time', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('records', { sinks: [sink] });
    logger.info('submitForm', 'saved', { record_id: 1, notes: 'secret', tags: 'a' });
    const context = sink.log.mock.calls[0][0].context;
    expect(context).toEqual({ record_id: 1, notes_len: 6, tags_len: 1 });
  });
});

describe('logger.js — consoleSink', () => {
  it('writes structured JSON to the console-like target by level', () => {
    const lines = { log: [], warn: [], error: [] };
    const target = {
      log: (l) => lines.log.push(l),
      warn: (l) => lines.warn.push(l),
      error: (l) => lines.error.push(l),
    };
    const sink = consoleSink(target);
    sink.log({ level: 'error', component: 'charts', action: 'loadRange', message: 'boom' });
    sink.log({ level: 'warn', component: 'charts', action: 'superseded', message: 'prev' });
    sink.log({ level: 'info', component: 'charts', action: 'init', message: 'ready' });
    expect(lines.error).toHaveLength(1);
    expect(lines.warn).toHaveLength(1);
    expect(lines.log).toHaveLength(1);
    expect(JSON.parse(lines.error[0])).toMatchObject({ level: 'error', action: 'loadRange' });
    expect(JSON.parse(lines.warn[0]).action).toBe('superseded');
    expect(JSON.parse(lines.log[0]).action).toBe('init');
  });
});

describe('logger.js — createBeaconSink', () => {
  it('POSTs the record to the beacon endpoint as JSON', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const sink = createBeaconSink({ endpoint: '/api/client-log', timeoutMs: 2000 });
    sink.log({ level: 'error', component: 'charts', action: 'loadRange', message: 'boom' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/client-log');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeDefined();
    expect(JSON.parse(init.body)).toMatchObject({ level: 'error', action: 'loadRange' });
    vi.unstubAllGlobals();
  });

  it('never throws on fetch rejection (fire-and-forget)', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('network down')));
    vi.stubGlobal('fetch', fetchMock);
    const sink = createBeaconSink();
    expect(() => sink.log({ level: 'error', action: 'x', message: 'm', component: 'c' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    vi.unstubAllGlobals();
  });

  it('drops oversized payloads before sending', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const sink = createBeaconSink({ maxPayloadBytes: 10 });
    sink.log({ level: 'error', component: 'c', action: 'a', message: 'this message is way too long to fit' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('logger.js — installGlobalHandlers', () => {
  class FakeScope {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) {
      const set = this.listeners.get(type);
      if (set) set.delete(fn);
    }
    emit(type, event) {
      for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
    }
  }

  it('captures window error events into the logger', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    const scope = new FakeScope();
    const uninstall = installGlobalHandlers(logger, scope);
    const error = new TypeError('exploded');
    scope.emit('error', { message: error.message, filename: 'charts.js', lineno: 5, colno: 1, error });
    expect(sink.log).toHaveBeenCalledTimes(1);
    const record = sink.log.mock.calls[0][0];
    expect(record.action).toBe('window.onerror');
    expect(record.component).toBe('charts');
    expect(record.error).toMatchObject({ name: 'TypeError', message: 'exploded', kind: 'service' });
    uninstall();
  });

  it('captures unhandled promise rejections into the logger', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    const scope = new FakeScope();
    const uninstall = installGlobalHandlers(logger, scope);
    scope.emit('unhandledrejection', { reason: new Error('promise blew up') });
    expect(sink.log).toHaveBeenCalledTimes(1);
    expect(sink.log.mock.calls[0][0].action).toBe('window.onunhandledrejection');
    uninstall();
  });

  it('is idempotent per scope and uninstallable', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    const scope = new FakeScope();
    const uninstallA = installGlobalHandlers(logger, scope);
    const uninstallB = installGlobalHandlers(logger, scope);
    scope.emit('error', { message: 'x', error: new Error('x') });
    expect(sink.log).toHaveBeenCalledTimes(1);
    uninstallA();
    uninstallB();
    scope.emit('error', { message: 'y', error: new Error('y') });
    expect(sink.log).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without a scope', () => {
    const sink = { log: vi.fn() };
    const logger = createLogger('charts', { sinks: [sink] });
    expect(() => installGlobalHandlers(logger, null)).not.toThrow();
  });
});