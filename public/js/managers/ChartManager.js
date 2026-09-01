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
   */
  constructor(options = {}) {
    this._charts = {};
    this._series = {};
    this._priceScaleMode = options.priceScaleMode || DEFAULT_PRICE_SCALE_MODE;
    this._loader = options.load || null;
    this._toCandle = options.toCandle || null;

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
        const ts = chart && chart.timeScale();
        if (ts) ts.setVisibleLogicalRange({ from: range.from, to: range.to });
      }
      this._emit('rangechange', {
        range: { from: range.from, to: range.to },
        sourceId: sourceId ?? null,
        origin: 'set',
      });
      return true;
    } finally {
      this._syncState = SyncState.IDLE;
    }
  }

  /**
   * Forward the source chart's logical range to the other charts.
   * Re-entrancy safe via the sync lock. When called from a visible-range-change
   * handler the event's own range is supplied; otherwise it is read from the
   * source chart's time scale (pull model).
   * @param {string} sourceId
   * @param {{from:number,to:number}|null} [range] optional event-provided range
   * @returns {boolean} true when synced, false when locked/unknown/not usable
   */
  syncRanges(sourceId, range) {
    if (this._syncState === SyncState.SYNCING) return false;
    const chart = this._charts[sourceId];
    if (!chart) return false;
    const ts = chart && chart.timeScale();
    const resolved = range ?? (ts && ts.getVisibleLogicalRange());
    if (!isUsableRange(resolved)) return false;
    this._syncState = SyncState.SYNCING;
    try {
      this._visibleRange = { from: resolved.from, to: resolved.to };
      for (const id of this.chartIds()) {
        if (id === sourceId) continue;
        const target = this._charts[id];
        const ts = target && target.timeScale();
        if (ts) ts.setVisibleLogicalRange({ from: resolved.from, to: resolved.to });
      }
      this._emit('rangechange', {
        range: { from: resolved.from, to: resolved.to },
        sourceId,
        origin: 'sync',
      });
      return true;
    } finally {
      this._syncState = SyncState.IDLE;
    }
  }

  /**
   * Attach the sync handler to a chart's time scale so panning/zooming one
   * chart drives the other. Returns an unsubscribe function.
   */
  subscribe(sourceId) {
    const chart = this._charts[sourceId];
    if (!chart) throw new Error(`Unknown chart: ${sourceId}`);
    const ts = chart.timeScale();
    if (!ts || typeof ts.subscribeVisibleLogicalRangeChange !== 'function') {
      throw new Error(`Chart ${sourceId} has no subscribable timeScale`);
    }
    const handler = (range) => {
      if (this._syncState === SyncState.SYNCING) return;
      this.syncRanges(sourceId, range);
    };
    ts.subscribeVisibleLogicalRangeChange(handler);
    this._subscriptions.set(sourceId, handler);
    return () => this.unsubscribe(sourceId);
  }

  unsubscribe(sourceId) {
    const handler = this._subscriptions.get(sourceId);
    if (!handler) return;

    const chart = this._charts[sourceId];
    if (!chart) {
      console.warn(`unsubscribe: no chart for ${sourceId}`);
      this._subscriptions.delete(sourceId);
      return;
    }

    const ts = chart.timeScale();
    if (!ts || typeof ts.unsubscribeVisibleLogicalRangeChange !== 'function') {
      console.warn(`unsubscribe: chart ${sourceId} has no unsubscribable timeScale`);
      this._subscriptions.delete(sourceId);
      return;
    }

    ts.unsubscribeVisibleLogicalRangeChange(handler);
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

  setLogScale(mode) {
    if (mode !== ScaleMode.LINEAR && mode !== ScaleMode.LOGARITHMIC) {
      throw new Error(`Unknown scale mode: ${mode}`);
    }
    if (this._scaleMode === mode) return mode;
    this._scaleMode = mode;
    const priceMode = this._priceScaleMode[mode];
    for (const id of this.chartIds()) {
      const chart = this._charts[id];
      const scale = chart && chart.priceScale && chart.priceScale('right');
      if (scale) scale.applyOptions({ mode: priceMode });
    }
    this._emit('scalechange', { mode });
    return mode;
  }

  // ---------------------------------------------------------------------------
  // Data cache
  // ---------------------------------------------------------------------------

  /**
   * Cache candles for a symbol and push them to the corresponding series.
   */
  setData(symbol, candles) {
    if (!Array.isArray(candles)) throw new TypeError('setData requires an array of candles');
    this._cache.set(symbol, candles);
    const series = this._series[symbol];
    if (series && typeof series.setData === 'function') {
      series.setData(candles);
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
      return this.getState();
    } catch (err) {
      this._transition(ManagerState.ERROR);
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
    return this;
  }
}
