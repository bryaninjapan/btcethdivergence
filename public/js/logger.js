/**
 * Structured logging layer for the BTC/ETH divergence tracker (frontend).
 *
 * Mirror of src/lib/logger.ts (backend). Same record contract on both sides:
 *   { timestamp, level, component, action, message, context?, error? }
 *
 * No bundler: plain ESM consumed by charts.js / records.js at runtime and by
 * vitest. Pluggable sinks keep the core testable and dependency-free:
 *   - consoleSink():  structured JSON to the dev console (default)
 *   - beaconSink():   fire-and-forget POST to /api/client-log (2s timeout)
 */

export const LOG_LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

export const ERROR_KINDS = Object.freeze([
  'abort-timeout',
  'abort-superseded',
  'validation',
  'service',
  'database',
  'auth',
  'unknown',
]);

/**
 * Redaction map: user-supplied content keys are replaced by their lengths.
 * This is the frontend↔backend-shared rule: never log notes/tags values.
 */
const SENSITIVE_CONTEXT_KEYS = new Map([
  ['notes', 'notes_len'],
  ['tags', 'tags_len'],
  ['note', 'note_len'],
  ['tag', 'tag_len'],
]);

/**
 * Classify an error into a stable, queryable kind.
 *
 * @param {unknown} error
 * @param {string} [code] optional backend error code (e.g. 'VALIDATION_ERROR')
 * @returns {string} one of ERROR_KINDS
 */
export function classifyError(error, code) {
  const errorCode = code || (error && error.code);
  if (errorCode === 'VALIDATION_ERROR') return 'validation';
  if (errorCode === 'DATABASE_ERROR') return 'database';
  if (errorCode === 'SERVICE_ERROR') return 'service';
  if (errorCode === 'AUTH_ERROR') return 'auth';

  const name = (error && error.name) || '';
  const message = (error && error.message) || '';
  const reason = (error && (error.reason || error.cause)) || null;

  if (name === 'TimeoutError' || (reason && reason.name === 'TimeoutError') || /timeout/i.test(message)) {
    return 'abort-timeout';
  }
  if (name === 'AbortError') {
    // App convention: plain aborts in this codebase are superseded in-flight
    // loads; timeouts always carry a TimeoutError reason (see charts.js).
    return 'abort-superseded';
  }
  if (name === 'ValidationError' || name === 'ZodError') return 'validation';
  if (name === 'DatabaseError') return 'database';
  if (name === 'AuthenticationError' || name === 'AuthError') return 'auth';
  if (name === 'ExternalServiceError' || name === 'TypeError') return 'service';
  return 'unknown';
}

/**
 * Convert an error into a serializable, log-safe shape.
 *
 * @param {unknown} error
 * @param {string} [kind] optional precomputed classification
 * @returns {{ name: string, message: string, code?: string, kind: string, stack?: string }}
 */
export function serializeError(error, kind) {
  if (error == null) {
    return { name: 'Error', message: 'Unknown error', kind: kind || 'unknown' };
  }
  const out = {
    name: error.name || 'Error',
    message: error.message || String(error),
    kind: kind || classifyError(error, error && error.code),
  };
  if (error.code) out.code = String(error.code);
  if (error.stack) out.stack = error.stack;
  return out;
}

/**
 * Build a record with a fresh ISO timestamp. Sparse optional fields are
 * omitted so both sides emit identical shapes for identical inputs.
 */
export function createRecord(level, component, action, message, context, error) {
  const record = {
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
 * context is replaced by its length. Call sites already log notes_len/tags_len;
 * this guarantees the rule even if a future call site forgets.
 */
export function redactRecord(record) {
  if (!record.context || typeof record.context !== 'object' || Array.isArray(record.context)) {
    return record;
  }
  const context = {};
  for (const [key, value] of Object.entries(record.context)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_CONTEXT_KEYS.has(lower)) {
      const lengthKey = SENSITIVE_CONTEXT_KEYS.get(lower);
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
export function consoleSink(consoleLike) {
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
 * Fire-and-forget sink that POSTs the record to the client-log beacon.
 * Never throws and never blocks the UI: 2s timeout, oversized payloads dropped.
 */
export function createBeaconSink(options = {}) {
  const endpoint = options.endpoint || '/api/client-log';
  const timeoutMs = options.timeoutMs || 2000;
  const maxPayloadBytes = options.maxPayloadBytes || 64 * 1024;
  return {
    log(record) {
      try {
        const body = JSON.stringify(record);
        if (body.length > maxPayloadBytes) return;
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        }).catch(() => {});
      } catch (err) {
        // Beacon failure must never propagate to the UI — swallow silently.
      }
    },
  };
}

/**
 * Create a logger bound to a component. Sinks and level are injectable for
 * tests; production defaults to consoleSink at info level.
 */
export function createLogger(component, options = {}) {
  const sinks = options.sinks || [consoleSink(options.console)];
  let minLevel = options.level || 'info';

  function emit(level, action, message, context, error) {
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;
    const record = redactRecord(createRecord(level, component, action, message, context, error));
    for (const sink of sinks) sink.log(record);
  }

  const logger = {
    get component() {
      return component;
    },
    setLevel(level) {
      if (!LOG_LEVELS[level]) throw new Error(`Unknown log level: ${level}`);
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
      emit(level || 'error', action, (error && error.message) || 'Unhandled error', context, serializeError(error));
    },
  };
  return logger;
}

/**
 * Install global error handlers (window 'error' + 'unhandledrejection') that
 * funnel uncaught exceptions into the logger. Idempotent per target scope.
 *
 * @param {object} logger logger from createLogger()
 * @param {object} [target] window-like scope; defaults to globalThis.window
 * @returns {() => void} unsubscribe function
 */
const installedScopes = new WeakSet();

export function installGlobalHandlers(logger, target) {
  const scope = target || (typeof window !== 'undefined' ? window : null);
  if (!scope || typeof scope.addEventListener !== 'function') return () => {};
  if (installedScopes.has(scope)) return () => {};
  installedScopes.add(scope);

  const onError = (event) => {
    logger.captureException(
      'window.onerror',
      event.error instanceof Error ? event.error : new Error(event.message || 'Uncaught error'),
      { source: event.filename || '', line: event.lineno || 0, column: event.colno || 0 },
    );
  };
  const onRejection = (event) => {
    const reason = event.reason;
    logger.captureException(
      'window.onunhandledrejection',
      reason instanceof Error ? reason : new Error(String(reason)),
      {},
    );
  };

  scope.addEventListener('error', onError);
  scope.addEventListener('unhandledrejection', onRejection);
  return () => {
    scope.removeEventListener('error', onError);
    scope.removeEventListener('unhandledrejection', onRejection);
    installedScopes.delete(scope);
  };
}