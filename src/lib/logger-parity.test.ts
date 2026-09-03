/**
 * Frontend ↔ backend logger parity test.
 *
 * Both loggers must produce byte-identical record shapes for identical inputs,
 * so records are queryable consistently across Workers Logs and the dev
 * console no matter which side emitted them (SC4).
 */
import { describe, expect, it } from 'vitest';
import {
  classifyError as backendClassify,
  createLogger as backendLogger,
  createRecord as backendRecord,
  redactRecord as backendRedact,
  serializeError as backendSerialize,
  type LogRecord,
} from './logger';
import {
  classifyError as frontendClassify,
  createLogger as frontendLogger,
  createRecord as frontendRecord,
  redactRecord as frontendRedact,
  serializeError as frontendSerialize,
} from '../../public/js/logger.js';

function stripTimestamp(record: { timestamp: string }): Record<string, unknown> {
  const { timestamp, ...rest } = record;
  void timestamp;
  return rest;
}

describe('frontend ↔ backend logger parity', () => {
  it('createRecord emits the same shape', () => {
    const withBoth = (context?: unknown, error?: unknown) => [
      backendRecord('error', 'charts', 'loadRange', 'boom', context as never, error as never),
      frontendRecord('error', 'charts', 'loadRange', 'boom', context, error),
    ];
    const [backend, frontend] = withBoth({ a: 1 }, { name: 'Error', message: 'boom', kind: 'unknown' });
    expect(stripTimestamp(backend)).toEqual(stripTimestamp(frontend));

    const [backendSparse, frontendSparse] = withBoth(undefined, undefined);
    expect(stripTimestamp(backendSparse)).toEqual(stripTimestamp(frontendSparse));
  });

  it('classifyError agrees across all error kinds', () => {
    const cases = [
      { name: 'TimeoutError', message: 'timed out' },
      { name: 'AbortError' },
      { name: 'ValidationError' },
      { name: 'ZodError' },
      { name: 'DatabaseError' },
      { name: 'AuthenticationError' },
      { name: 'ExternalServiceError' },
      { name: 'TypeError' },
      { name: 'RandomError' },
      null,
    ];
    for (const error of cases) {
      expect(frontendClassify(error)).toBe(backendClassify(error));
    }

    const timeout = new DOMException('The operation timed out', 'TimeoutError');
    const aborted = new DOMException('This operation was aborted', 'AbortError');
    aborted.cause = timeout;
    expect(frontendClassify(aborted)).toBe(backendClassify(aborted));
    expect(frontendClassify(aborted)).toBe('abort-timeout');
  });

  it('serializeError emits the same shape', () => {
    const error = new TypeError('boom');
    const backend = backendSerialize(error);
    const frontend = frontendSerialize(error);
    expect(backend).toEqual(frontend);
    expect(frontend).toMatchObject({ name: 'TypeError', message: 'boom', kind: 'service' });
  });

  it('redactRecord applies the same redaction rule', () => {
    const backendInput: LogRecord = {
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'records',
      action: 'submitForm',
      message: 'saved',
      context: { record_id: 7, notes: 'secret divergence', tags: 'btc' },
    };
    const frontendInput = {
      timestamp: backendInput.timestamp,
      level: 'info',
      component: 'records',
      action: 'submitForm',
      message: 'saved',
      context: { record_id: 7, notes: 'secret divergence', tags: 'btc' },
    };
    expect(frontendRedact(frontendInput)).toEqual(backendRedact(backendInput));
    expect(frontendRedact(frontendInput).context).toEqual({ record_id: 7, notes_len: 17, tags_len: 3 });
  });

  it('createLogger dispatch produces identical records', () => {
    const backendSink = { log: () => {} };
    const frontendSink = { log: () => {} };
    const backendSpy = vi_spy(backendSink);
    const frontendSpy = vi_spy(frontendSink);
    backendLogger('parity', { sinks: [backendSink] }).info('init', 'ready', { charts: 2 });
    frontendLogger('parity', { sinks: [frontendSink] }).info('init', 'ready', { charts: 2 });
    expect(backendSpy.record).toBeDefined();
    expect(frontendSpy.record).toBeDefined();
    expect(stripTimestamp(backendSpy.record!)).toEqual(stripTimestamp(frontendSpy.record!));
  });
});

function vi_spy(sink: { log: (record: LogRecord) => void }): { record: LogRecord | undefined } {
  const records: LogRecord[] = [];
  const original = sink.log;
  sink.log = (record) => {
    records.push(record);
    original(record);
  };
  return { get record() { return records[0]; } };
}