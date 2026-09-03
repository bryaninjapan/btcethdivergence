/**
 * Structured logging layer for the BTC/ETH divergence tracker (backend).
 *
 * Mirror of public/js/logger.js (frontend). Same record contract on both sides:
 *   { timestamp, level, component, action, message, context?, error? }
 * A parity test (logger-parity.test.ts) proves the two emit identical shapes.
 *
 * Sink interface keeps the core dependency-free; the default consoleSink feeds
 * Cloudflare Workers Logs via stdout (wrangler tail / dashboard).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ErrorKind =
  | 'abort-timeout'
  | 'abort-superseded'
  | 'validation'
  | 'service'
  | 'database'
  | 'auth'
  | 'unknown';

export interface LogContext {
  [key: string]: unknown;
}

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  kind: ErrorKind;
  stack?: string;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  message: string;
  context?: LogContext;
  error?: SerializedError;
}

export interface LogSink {
  log(record: LogRecord): void;
}

export interface Logger {
  readonly component: string;
  setLevel(level: LogLevel): Logger;
  withComponent(component: string): Logger;
  debug(action: string, message: string, context?: LogContext): void;
  info(action: string, message: string, context?: LogContext): void;
  warn(action: string, message: string, context?: LogContext): void;
  error(action: string, message: string, context?: LogContext): void;
  captureException(action: string, error: unknown, context?: LogContext, level?: LogLevel): void;
}

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const ERROR_KINDS: readonly ErrorKind[] = [
  'abort-timeout',
  'abort-superseded',
  'validation',
  'service',
  'database',
  'auth',
  'unknown',
];

/** Redaction map: user-supplied content keys are replaced by their lengths. */
const SENSITIVE_CONTEXT_KEYS: ReadonlyMap<string, string> = new Map([
  ['notes', 'notes_len'],
  ['tags', 'tags_len'],
  ['note', 'note_len'],
  ['tag', 'tag_len'],
]);

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  reason?: unknown;
  cause?: unknown;
  stack?: unknown;
}

function asRecord(error: unknown): ErrorLike {
  return (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function reasonName(reason: unknown): string | null {
  if (typeof reason !== 'object' || reason === null) return null;
  const name = (reason as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}

/**
 * Classify an error into a stable, queryable kind.
 * @param error
 * @param code optional backend error code (e.g. 'VALIDATION_ERROR'); falls back to error.code
 */
export function classifyError(error: unknown, code?: string): ErrorKind {
  const err = asRecord(error);
  const errorCode = code || asString(err.code);

  if (errorCode === 'VALIDATION_ERROR') return 'validation';
  if (errorCode === 'DATABASE_ERROR') return 'database';
  if (errorCode === 'SERVICE_ERROR') return 'service';
  if (errorCode === 'AUTH_ERROR') return 'auth';

  const name = asString(err.name);
  const message = asString(err.message);
  const reason = err.reason ?? err.cause;

  if (name === 'TimeoutError' || reasonName(reason) === 'TimeoutError' || /timeout/i.test(message)) {
    return 'abort-timeout';
  }
  if (name === 'AbortError') {
    // App convention: plain aborts are superseded in-flight loads; timeouts
    // always carry a TimeoutError reason.
    return 'abort-superseded';
  }
  if (name === 'ValidationError' || name === 'ZodError') return 'validation';
  if (name === 'DatabaseError') return 'database';
  if (name === 'AuthenticationError' || name === 'AuthError') return 'auth';
  if (name === 'ExternalServiceError' || name === 'TypeError') return 'service';
  return 'unknown';
}

/**
 * Convert an error into a serializable, log-safe shape. Optional fields are
 * omitted so both sides emit identical shapes for identical inputs.
 */
export function serializeError(error: unknown, kind?: ErrorKind): SerializedError {
  if (error == null) {
    return { name: 'Error', message: 'Unknown error', kind: kind ?? 'unknown' };
  }
  const err = asRecord(error);
  const out: SerializedError = {
    name: asString(err.name) || 'Error',
    message: asString(err.message) || String(error),
    kind: kind ?? classifyError(error, asString(err.code)),
  };
  if (err.code !== undefined) out.code = String(err.code);
  if (typeof err.stack === 'string') out.stack = err.stack;
  return out;
}

/**
 * Build a record with a fresh ISO timestamp.
 */
export function createRecord(
  level: LogLevel,
  component: string,
  action: string,
  message: string,
  context?: LogContext,
  error?: SerializedError,
): LogRecord {
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    component,
    action,
    message,
  };
  if (context !== undefined) record.context = context;
  if (error !== undefined) record.error = error;
  return record;
}

/**
 * Defense-in-depth redaction: any user-supplied notes/tags content in the
 * context is replaced by its length.
 */
export function redactRecord(record: LogRecord): LogRecord {
  if (!record.context || typeof record.context !== 'object' || Array.isArray(record.context)) {
    return record;
  }
  const context: LogContext = {};
  for (const [key, value] of Object.entries(record.context)) {
    const lower = key.toLowerCase();
    const lengthKey = SENSITIVE_CONTEXT_KEYS.get(lower);
    if (lengthKey) {
      context[lengthKey] = typeof value === 'string' ? value.length : value;
    } else {
      context[key] = value;
    }
  }
  return { ...record, context };
}

/**
 * Default sink: structured JSON to a console-like target (defaults to global
 * `console`). This is the ONLY place production code touches console.*.
 */
export function consoleSink(consoleLike?: Pick<Console, 'log' | 'warn' | 'error'>): LogSink {
  const target = consoleLike || console;
  return {
    log(record) {
      const line = JSON.stringify(record);
      if (record.level === 'error') target.error(line);
      else if (record.level === 'warn') target.warn(line);
      else target.log(line);
    },
  };
}

/**
 * Create a logger bound to a component. Sinks and level are injectable for
 * tests; production defaults to consoleSink (Workers Logs) at info level.
 */
export function createLogger(
  component: string,
  options: { sinks?: LogSink[]; level?: LogLevel; console?: Pick<Console, 'log' | 'warn' | 'error'> } = {},
): Logger {
  const sinks = options.sinks || [consoleSink(options.console)];
  let minLevel: LogLevel = options.level || 'info';

  function emit(
    level: LogLevel,
    action: string,
    message: string,
    context?: LogContext,
    error?: SerializedError,
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;
    const record = redactRecord(createRecord(level, component, action, message, context, error));
    for (const sink of sinks) sink.log(record);
  }

  const logger: Logger = {
    get component() {
      return component;
    },
    setLevel(level) {
      if (typeof LOG_LEVELS[level] !== 'number') throw new Error(`Unknown log level: ${level}`);
      minLevel = level;
      return logger;
    },
    withComponent(name) {
      return createLogger(name, { sinks, level: minLevel });
    },
    debug(action, message, context) {
      emit('debug', action, message, context);
    },
    info(action, message, context) {
      emit('info', action, message, context);
    },
    warn(action, message, context) {
      emit('warn', action, message, context);
    },
    error(action, message, context) {
      emit('error', action, message, context);
    },
    captureException(action, error, context, level) {
      const serialized = serializeError(error);
      emit(level || 'error', action, serialized.message, context, serialized);
    },
  };
  return logger;
}