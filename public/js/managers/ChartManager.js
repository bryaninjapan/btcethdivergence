/**
 * ChartManager — unified chart state machine for the BTC/ETH divergence tracker.
 *
 * Consolidates the previously scattered chart-state.js, chart-range.js, and
 * chart-sync.js modules into a single, testable state machine. It encapsulates:
 *   - the two chart/series instances (BTCUSDT, ETHUSDT)
 *   - the current visible (logical) range
 *   - the log/linear price-scale mode
 *   - the sync-lock state (re-entrancy guard)
 *   - the data cache
 *
 * No bundler: plain ESM consumed by charts.js at runtime and by vitest.
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
 * Used to ignore the transient -Infinity/NaN ranges LWC emits at data edges.
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

const DEFAULT_PRICE_SCALE_MODE = Object.freeze({
  linear: 0,
  logarithmic: 1,
});

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
   * @param {object} [options.priceScaleMode] map of ScaleMode -> LWC PriceScaleMode
   * @param {Function} [options.load] async (startMs, endMs, signal) -> [{id, rows}]
   * @param {Function} [options.toCandle] optional (row) -> candle normalizer
   * @param {object} [options.logger] optional structured logger (createLogger from logger.js);
   *   when absent, no logs are emitted (state machine stays dependency-free).
   */
  constructor(options = {}) {
    this._charts = {};
    this._series = {};
    this._priceScaleMode = options.priceScaleMode || DEFAULT_PRICE_SCALE_MODE;
    this._loader = options.load || null;
    this._toCandle = options.toCandle || null;
    this._logger = options.logger || null;

    // Validate required scale modes
    if (!Number.isFinite(this._priceScaleMode.linear)) {
      throw new TypeError('priceScaleMode must include linear mode (numeric value)');
    }
    if (!Number.isFinite(this._priceScaleMode.logarithmic)) {
      throw new TypeError('priceScaleMode must include logarithmic mode (numeric value)');
    }

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

  // Aborts are expected control flow (superseded loads, timeouts); they are
  // logged at debug level so they never spam Workers Logs as exceptions.
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
   * Register chart/series pairs. Each entry: { id, chart, series }.
   * Transitions INIT -> READY (or READY -> READY for a re-init).
   */
  initCharts(charts) {
    if (!Array.isArray(charts) || charts.length === 0) {
      throw new TypeError('initCharts requires a non-empty array of { id, chart, series }');
    }
    for (const entry of charts) {
      if (!entry || typeof entry.id !== 'string' || !entry.chart || !entry.series) {
        throw new TypeError('initCharts entries must be { id, chart, series }');
      }
    }
    this._charts = {};
    this._series = {};
    this._cache.clear();
    this._chartIds = [];
    for (const entry of charts) {
      this._charts[entry.id] = entry.chart;
      this._series[entry.id] = entry.series;
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
    return this._series[id] ?? null;
  }

  chartIds() {
    return [...this._chartIds];
  }

  // ---------------------------------------------------------------------------
  // Visible (logical) range — with re-entrancy guards
  // ---------------------------------------------------------------------------

  /**
   * Apply a logical range to every chart except the source. Re-entrancy safe:
   * while the sync lock is held, both this and syncRanges become no-ops.
   *
   * v10 Note: KLineChart v10 does not provide a direct setVisibleLogicalRange method.
   * Instead, use scrollToTimestamp() to navigate to a specific timestamp, or
   * rely on event-driven sync via subscribeAction('onVisibleRangeChange').
   *
   * @returns {boolean} true when applied, false when ignored (locked/not usable)
   */
  setVisibleRange(range, sourceId) {
    if (!isUsableRange(range)) return false;
    if (this._syncState === SyncState.SYNCING) return false;
    this._syncState = SyncState.SYNCING;
    try {
      this._visibleRange = { from: range.from, to: range.to };
      // v10: No direct setVisibleLogicalRange; this method is informational/legacy.
      // Actual sync happens via event-driven subscribeAction in subscribe().
      for (const id of this.chartIds()) {
        if (id === sourceId) continue;
        // v10 chart API: use scrollToTimestamp() or rely on event propagation
        // For now, just log the requested range (actual navigation via events)
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
   * Forward the source chart's logical range to the other charts.
   * Re-entrancy safe via the sync lock. When called from a visible-range-change
   * handler the event's own range is supplied via the 'range' parameter.
   *
   * v10 Note: The range is always provided from the subscribeAction('onVisibleRangeChange')
   * event data. There is no pull-based fallback to getVisibleLogicalRange() in v10,
   * so this method requires the range parameter (event-driven only).
   *
   * @param {string} sourceId
   * @param {{from:number,to:number}|null} [range] event-provided range (required in v10)
   * @returns {boolean} true when synced, false when locked/unknown/not usable
   */
  syncRanges(sourceId, range) {
    if (this._syncState === SyncState.SYNCING) return false;
    const chart = this._charts[sourceId];
    if (!chart) return false;

    // v10: range must be provided from event; no fallback to timeScale().getVisibleLogicalRange()
    const resolved = range;
    if (!isUsableRange(resolved)) return false;

    this._syncState = SyncState.SYNCING;
    try {
      this._visibleRange = { from: resolved.from, to: resolved.to };

      // v10: No direct setVisibleLogicalRange API on timeScale.
      // Sync is handled by broadcasting rangechange events; observers (UI, tests)
      // can subscribe via chartManager.on('rangechange', ...) and navigate other charts.
      for (const id of this.chartIds()) {
        if (id === sourceId) continue;
        // Note: v10 chart navigation would go via scrollToTimestamp() or external control
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
   * Attach the sync handler to a chart using v10 subscribeAction.
   * The handler is called whenever the visible range changes (zoom, scroll, or external sync).
   * Re-entrancy safe: while syncing, handlers are no-ops (prevents feedback loops).
   * Returns an unsubscribe function.
   *
   * v10 API change: Uses chart.subscribeAction('onVisibleRangeChange', callback)
   * instead of v9's chart.timeScale().onVisibleLogicalRangeChange(callback).
   * The v10 callback receives event data with { from, to, realFrom, realTo } logical indices.
   */
  subscribe(sourceId) {
    const chart = this._charts[sourceId];
    if (!chart) throw new Error(`Unknown chart: ${sourceId}`);

    // v10 API: subscribeAction (not timeScale().subscribeVisibleLogicalRangeChange)
    if (typeof chart.subscribeAction !== 'function') {
      throw new Error(`Chart ${sourceId} does not support subscribeAction (v10 API required)`);
    }

    const handler = (data) => {
      if (this._syncState === SyncState.SYNCING) return;
      // In v10, data contains { from, to, realFrom, realTo }; extract as range
      const range = data && data.from !== undefined ? { from: data.from, to: data.to } : null;
      if (range) {
        this.syncRanges(sourceId, range);
      }
    };

    // v10 subscribeAction: subscribe to 'onVisibleRangeChange' action
    chart.subscribeAction('onVisibleRangeChange', handler);
    this._subscriptions.set(sourceId, { handler, action: 'onVisibleRangeChange' });
    return () => this.unsubscribe(sourceId);
  }

  /**
   * Unsubscribe a chart's visible range change handler.
   * v10 API: chart.unsubscribeAction(action, handler) instead of chart.timeScale().unsubscribe()
   */
  unsubscribe(sourceId) {
    const subscription = this._subscriptions.get(sourceId);
    if (!subscription) return;

    const chart = this._charts[sourceId];
    if (!chart) {
      this._log('warn', 'unsubscribe', `no chart for ${sourceId}`, { sourceId });
      this._subscriptions.delete(sourceId);
      return;
    }

    // v10 API: chart.unsubscribeAction (not chart.timeScale().unsubscribeVisibleLogicalRangeChange)
    if (typeof chart.unsubscribeAction !== 'function') {
      this._log('warn', 'unsubscribe', `chart ${sourceId} does not support unsubscribeAction (v10 API required)`, { sourceId });
      this._subscriptions.delete(sourceId);
      return;
    }

    chart.unsubscribeAction(subscription.action, subscription.handler);
    this._subscriptions.delete(sourceId);
  }

  /**
   * Wire bidirectional sync across all registered charts. Returns an
   * unsubscribe function that detaches every subscription.
   */
  wireSync() {
    const unsubs = this.chartIds().map((id) => this.subscribe(id));
    return () => unsubs.forEach((fn) => fn());
  }

  // ---------------------------------------------------------------------------
  // Price-scale mode
  // ---------------------------------------------------------------------------

  /**
   * Flip between linear and logarithmic scale across all charts.
   * @returns {string} the newly-active ScaleMode
   */
  toggleLogScale() {
    return this.setLogScale(
      this._scaleMode === ScaleMode.LINEAR ? ScaleMode.LOGARITHMIC : ScaleMode.LINEAR,
    );
  }

  /**
   * Set logarithmic or linear price scale mode across all charts.
   *
   * v10 API: Use chart.overrideYAxis() to set the price scale type.
   * In v10, there's no priceScale('right') method; instead, use overrideYAxis()
   * with a custom createRange callback to determine linear vs logarithmic scaling.
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

      // v10 API: overrideYAxis() configures the price axis behavior
      // Set tickSize and other options based on mode (linear vs logarithmic)
      const yAxisConfig = {
        type: mode === ScaleMode.LOGARITHMIC ? 'log' : 'normal',
        inside: false,
        position: 'right',
      };

      // v10: call chart.overrideYAxis() if available, else log warning
      if (typeof chart.overrideYAxis === 'function') {
        chart.overrideYAxis(yAxisConfig);
      } else {
        this._log('warn', 'setLogScale', `chart ${id} does not support overrideYAxis (v10 API required)`, { mode });
      }
    }

    this._emit('scalechange', { mode });
    this._log('info', 'setLogScale', `scale mode → ${mode}`, { mode });
    return mode;
  }

  // ---------------------------------------------------------------------------
  // Data cache
  // ---------------------------------------------------------------------------

  /**
   * Cache candles for a symbol and apply them to the chart.
   *
   * v10 API: Instead of series.setData(), use chart.applyNewData() to render new data.
   * This replaces all data currently displayed on the chart.
   */
  setData(symbol, candles) {
    if (!Array.isArray(candles)) throw new TypeError('setData requires an array of candles');
    this._cache.set(symbol, candles);

    // v10: Get the chart (not series) and call applyNewData()
    const chart = this._charts[symbol];
    if (chart && typeof chart.applyNewData === 'function') {
      chart.applyNewData(candles);
      this._log('debug', 'setData', `applied ${candles.length} candles to ${symbol}`, { symbol, count: candles.length });
    } else if (chart) {
      this._log('warn', 'setData', `chart ${symbol} does not support applyNewData (v10 API required)`, { symbol });
    }

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
   * Load a millisecond window via the injected loader, updating the data cache
   * and series, then transitioning the machine through LOADING -> READY.
   * Re-entrancy guarded: throws if a load is already in flight.
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
   * Frozen, read-only snapshot of the manager state (safe for assertions and
   * UI rendering; never exposes mutable internals).
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
