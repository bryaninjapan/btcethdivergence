/**
 * ChartManager — unified chart state machine for the BTC/ETH divergence tracker.
 * REWRITTEN for KLineChart v10.0.3
 *
 * Consolidates the previously scattered chart-state.js, chart-range.js, and
 * chart-sync.js modules into a single, testable state machine. It encapsulates:
 *   - the two chart instances (BTCUSDT, ETHUSDT) using klinecharts v10 API
 *   - the current visible range (via subscribeAction instead of timeScale)
 *   - the log/linear price-scale mode (via overrideYAxis instead of priceScale)
 *   - the sync-lock state (re-entrancy guard)
 *   - the data cache
 *
 * No bundler: plain ESM consumed by charts.js at runtime and by vitest.
 *
 * CRITICAL TIMESTAMP CONTRACT (v10.0.3):
 * - Binance `open_time` is milliseconds (13 digits, e.g., 1693526400000)
 * - KLineChart v10 requires `timestamp` key with milliseconds
 * - NO conversion: pass timestamp through unchanged
 * - Wrong: timestamp: Math.floor(open_time / 1000)  // Would render 1970 dates!
 * - Correct: timestamp: open_time  // Pass through unchanged (13-digit ms)
 */

import { classifyError } from '../logger.js';

export const PADDING_SECONDS = 24 * 3600;
export const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;

export const ScaleMode = Object.freeze({
  LINEAR: 'linear',
  LOGARITHMIC: 'logarithmic',
});

export const SyncState = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
});

export const ManagerState = Object.freeze({
  INIT: 'init',
  READY: 'ready',
  LOADING: 'loading',
  ERROR: 'error',
});

export const CHART_IDS = Object.freeze(['BTCUSDT', 'ETHUSDT']);

/**
 * A logical range is usable only when both bounds are finite numbers.
 * Used to ignore the transient -Infinity/NaN ranges emitted at data edges.
 */
export function isUsableRange(range) {
  return !!range && Number.isFinite(range.from) && Number.isFinite(range.to);
}

/**
 * Convert a divergence record's start/end times (seconds) to a millisecond
 * window with ±24h padding on each side.
 */
export function recordToRange(record) {
  const startMs = (record.start_time - PADDING_SECONDS) * 1000;
  const endMs = (record.end_time + PADDING_SECONDS) * 1000;
  return { startMs, endMs };
}

/**
 * Parse ?start=...&end=... (milliseconds) from a search string. Returns null
 * when absent, non-numeric, or inverted.
 */
export function parseRangeParams(search) {
  const params = new URLSearchParams(search);
  if (params.get('start') === null || params.get('end') === null) return null;
  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= end) return null;
  return { startMs: start, endMs: end };
}

/**
 * Return the last DEFAULT_WINDOW_SECONDS window anchored at "now".
 */
export function nowRange() {
  const endMs = Date.now();
  return { startMs: endMs - DEFAULT_WINDOW_SECONDS * 1000, endMs };
}

// Legal lifecycle transitions for the manager state machine.
const TRANSITIONS = {
  [ManagerState.INIT]: new Set([ManagerState.READY]),
  [ManagerState.READY]: new Set([ManagerState.LOADING, ManagerState.READY]),
  [ManagerState.LOADING]: new Set([ManagerState.READY, ManagerState.ERROR]),
  [ManagerState.ERROR]: new Set([ManagerState.LOADING, ManagerState.READY]),
};

export class ChartManager {
  /**
   * @param {object} [options]
   * @param {Function} [options.load] async (startMs, endMs, signal) -> [{id, rows}]
   * @param {Function} [options.toCandle] optional (row) -> candle normalizer
   * @param {object} [options.logger] optional structured logger (createLogger from logger.js);
   *   when absent, no logs are emitted (state machine stays dependency-free).
   */
  constructor(options = {}) {
    this._charts = {};
    this._loader = options.load || null;
    this._toCandle = options.toCandle || null;
    this._logger = options.logger || null;

    this._scaleMode = ScaleMode.LINEAR;
    this._syncState = SyncState.IDLE;
    this._managerState = ManagerState.INIT;

    this._visibleRange = null;
    this._loadedRange = null;

    this._cache = new Map();
    this._subscriptions = new Map();
    this._listeners = new Map();
    this._chartIds = [];
  }

  // ---------------------------------------------------------------------------
  // Structured logging (optional injected logger; no-op without one)
  // ---------------------------------------------------------------------------

  _log(level, action, message, context) {
    if (!this._logger) return;
    this._logger[level](action, message, context);
  }

  _logLoadError(action, error, context) {
    if (!this._logger) return;
    const kind = classifyError(error);
    if (kind === 'abort-timeout' || kind === 'abort-superseded') {
      this._logger.debug(action, 'load aborted', { ...context, kind });
    } else {
      this._logger.captureException(action, error, context);
    }
  }

  // ---------------------------------------------------------------------------
  // Event emitter
  // ---------------------------------------------------------------------------

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Register chart instances. Each entry: { id, chart }.
   * For v10, we only need the chart instance (no separate series).
   * Transitions INIT -> READY (or READY -> READY for a re-init).
   */
  initCharts(charts) {
    if (!Array.isArray(charts) || charts.length === 0) {
      throw new TypeError('initCharts requires a non-empty array of { id, chart }');
    }
    for (const entry of charts) {
      if (!entry || typeof entry.id !== 'string' || !entry.chart) {
        throw new TypeError('initCharts entries must be { id, chart }');
      }
    }
    this._charts = {};
    this._cache.clear();
    this._chartIds = [];
    for (const entry of charts) {
      this._charts[entry.id] = entry.chart;
      this._chartIds.push(entry.id);
    }
    this._log('info', 'initCharts', `registered ${charts.length} charts`, { chartIds: this._chartIds });
    this._transition(ManagerState.READY);
    return this;
  }

  getChart(id) {
    return this._charts[id] ?? null;
  }

  getSeries(id) {
    // In v10, the chart itself renders the series (no separate series object)
    return this._charts[id] ?? null;
  }

  chartIds() {
    return [...this._chartIds];
  }

  // ---------------------------------------------------------------------------
  // Visible range — with re-entrancy guards (v10 API)
  // ---------------------------------------------------------------------------

  /**
   * Apply a visible range to every chart except the source. Re-entrancy safe.
   * v10 Note: Uses scrollToTimestamp() instead of timeScale.setVisibleLogicalRange()
   *
   * @returns {boolean} true when applied, false when ignored (locked/not usable)
   */
  setVisibleRange(range, sourceId) {
    if (!isUsableRange(range)) return false;
    if (this._syncState === SyncState.SYNCING) return false;
    this._syncState = SyncState.SYNCING;
    try {
      this._visibleRange = { from: range.from, to: range.to };
      for (const id of this.chartIds()) {
        if (id === sourceId) continue;
        const chart = this._charts[id];
        if (chart && typeof chart.scrollToTimestamp === 'function') {
          const centerTimestamp = (range.from + range.to) / 2;
          chart.scrollToTimestamp(centerTimestamp);
        }
      }
      this._emit('rangechange', {
        range: { from: range.from, to: range.to },
        sourceId: sourceId ?? null,
        origin: 'set',
      });
      this._log('debug', 'setVisibleRange', 'applied range', { from: range.from, to: range.to, sourceId });
      return true;
    } finally {
      this._syncState = SyncState.IDLE;
    }
  }

  /**
   * Forward the source chart's visible range to the other charts.
   * Re-entrancy safe via the sync lock.
   * v10 Note: Receives range from subscribeAction callback or external source.
   *
   * @param {string} sourceId
   * @param {{from:number,to:number}|null} [range] optional event-provided range
   * @returns {boolean} true when synced, false when locked/unknown/not usable
   */
  syncRanges(sourceId, range) {
    if (this._syncState === SyncState.SYNCING) return false;
    const chart = this._charts[sourceId];
    if (!chart) return false;

    const resolved = range;
    if (!isUsableRange(resolved)) return false;

    this._syncState = SyncState.SYNCING;
    try {
      this._visibleRange = { from: resolved.from, to: resolved.to };
      for (const id of this.chartIds()) {
        if (id === sourceId) continue;
        const target = this._charts[id];
        if (target && typeof target.scrollToTimestamp === 'function') {
          const centerTimestamp = (resolved.from + resolved.to) / 2;
          target.scrollToTimestamp(centerTimestamp);
        }
      }
      this._emit('rangechange', {
        range: { from: resolved.from, to: resolved.to },
        sourceId,
        origin: 'sync',
      });
      this._log('debug', 'syncRanges', 'synced range', { from: resolved.from, to: resolved.to, sourceId });
      return true;
    } finally {
      this._syncState = SyncState.IDLE;
    }
  }

  /**
   * Attach the sync handler to a chart using v10's subscribeAction API.
   * v10 API: chart.subscribeAction('onVisibleRangeChange', callback)
   * Returns an unsubscribe function.
   */
  subscribe(sourceId) {
    const chart = this._charts[sourceId];
    if (!chart) throw new Error(`Unknown chart: ${sourceId}`);
    if (typeof chart.subscribeAction !== 'function') {
      throw new Error(`Chart ${sourceId} has no subscribeAction method`);
    }

    const handler = (eventData) => {
      if (this._syncState === SyncState.SYNCING) return;
      if (eventData) {
        this.syncRanges(sourceId, eventData);
      }
    };

    chart.subscribeAction('onVisibleRangeChange', handler);
    this._subscriptions.set(sourceId, { handler, chart });

    return () => this.unsubscribe(sourceId);
  }

  /**
   * Detach the sync handler using v10's unsubscribeAction API.
   * v10 API: chart.unsubscribeAction('onVisibleRangeChange', callback)
   */
  unsubscribe(sourceId) {
    const subscription = this._subscriptions.get(sourceId);
    if (!subscription) return;

    const { handler, chart } = subscription;
    if (chart && typeof chart.unsubscribeAction === 'function') {
      chart.unsubscribeAction('onVisibleRangeChange', handler);
    } else {
      this._log('warn', 'unsubscribe', `chart ${sourceId} has no unsubscribeAction method`, { sourceId });
    }

    this._subscriptions.delete(sourceId);
  }

  /**
   * Wire bidirectional sync across all registered charts.
   */
  wireSync() {
    const unsubs = this.chartIds().map((id) => this.subscribe(id));
    return () => unsubs.forEach((fn) => fn());
  }

  // ---------------------------------------------------------------------------
  // Price-scale mode (v10 API)
  // ---------------------------------------------------------------------------

  /**
   * Flip between linear and logarithmic scale across all charts.
   * v10 API uses overrideYAxis() with custom createRange for log scale.
   *
   * @returns {string} the newly-active ScaleMode
   */
  toggleLogScale() {
    return this.setLogScale(
      this._scaleMode === ScaleMode.LINEAR ? ScaleMode.LOGARITHMIC : ScaleMode.LINEAR,
    );
  }

  /**
   * Set price scale mode (linear or logarithmic).
   * v10 API: overrideYAxis() for custom scale, overrideYAxis(null) to reset.
   */
  setLogScale(mode) {
    if (mode !== ScaleMode.LINEAR && mode !== ScaleMode.LOGARITHMIC) {
      throw new Error(`Unknown scale mode: ${mode}`);
    }
    if (this._scaleMode === mode) return mode;
    this._scaleMode = mode;

    for (const id of this.chartIds()) {
      const chart = this._charts[id];
      if (!chart) continue;

      if (mode === ScaleMode.LOGARITHMIC) {
        if (typeof chart.overrideYAxis === 'function') {
          chart.overrideYAxis({
            createRange: (params) => {
              const { high, low } = params || {};
              if (typeof high !== 'number' || typeof low !== 'number') {
                return null;
              }
              const logHigh = Math.log10(high > 0 ? high : 1);
              const logLow = Math.log10(low > 0 ? low : 1);
              return {
                from: logLow,
                to: logHigh,
              };
            },
          });
        }
      } else {
        if (typeof chart.overrideYAxis === 'function') {
          chart.overrideYAxis(null);
        }
      }
    }

    this._emit('scalechange', { mode });
    this._log('info', 'setLogScale', `scale mode → ${mode}`, { mode });
    return mode;
  }

  // ---------------------------------------------------------------------------
  // Data cache (v10 API)
  // ---------------------------------------------------------------------------

  /**
   * Cache candles for a symbol.
   * In v10, data is provided via setDataLoader(), not setData() on a series.
   */
  setData(symbol, candles) {
    if (!Array.isArray(candles)) throw new TypeError('setData requires an array of candles');
    this._cache.set(symbol, candles);
    this._emit('datachange', { symbol, count: candles.length });
    return this;
  }

  getData(symbol) {
    return this._cache.get(symbol) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Range loading
  // ---------------------------------------------------------------------------

  /**
   * Load a millisecond window via the injected loader, updating the data cache.
   * CRITICAL: Binance timestamp is milliseconds, pass through unchanged to v10.
   */
  async loadRange(startMs, endMs, options = {}) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      throw new RangeError('loadRange requires finite startMs < endMs');
    }
    if (this._managerState === ManagerState.LOADING) {
      throw new Error('loadRange: a load is already in progress');
    }
    if (!this._loader) throw new Error('loadRange: no loader configured');
    this._log('info', 'loadRange.start', 'loading range', { startMs, endMs });
    this._transition(ManagerState.LOADING);
    try {
      const results = await this._loader(startMs, endMs, options.signal);
      for (const entry of results || []) {
        const candles = this._toCandle ? entry.rows.map(this._toCandle) : entry.rows;
        this.setData(entry.id, candles);
      }
      this._loadedRange = { startMs, endMs };
      this._transition(ManagerState.READY);
      this._emit('rangechange', { range: { startMs, endMs }, origin: 'load' });
      this._log('info', 'loadRange.complete', 'range loaded', {
        startMs,
        endMs,
        symbols: (results || []).map((entry) => entry.id),
      });
      return this.getState();
    } catch (err) {
      this._transition(ManagerState.ERROR);
      this._logLoadError('loadRange.error', err, { startMs, endMs });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  /**
   * Frozen, read-only snapshot of the manager state.
   */
  getState() {
    const cacheSummary = {};
    for (const [symbol, candles] of this._cache) cacheSummary[symbol] = candles.length;
    return Object.freeze({
      state: this._managerState,
      syncState: this._syncState,
      scaleMode: this._scaleMode,
      charts: [...this.chartIds()],
      visibleRange: this._visibleRange ? { ...this._visibleRange } : null,
      loadedRange: this._loadedRange ? { ...this._loadedRange } : null,
      cache: Object.freeze(cacheSummary),
    });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _transition(next) {
    const prev = this._managerState;
    const allowed = TRANSITIONS[prev] || new Set();
    if (!allowed.has(next)) {
      throw new Error(`Invalid state transition: ${prev} → ${next}`);
    }
    this._managerState = next;
    this._emit('statechange', { from: prev, to: next });
    this._log('debug', 'transition', `${prev} → ${next}`, { from: prev, to: next });
    return this;
  }
}
