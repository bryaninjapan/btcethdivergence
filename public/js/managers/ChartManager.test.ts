import { describe, expect, it } from 'vitest';
import {
  ChartManager,
  CHART_IDS,
  DEFAULT_WINDOW_SECONDS,
  ManagerState,
  PADDING_SECONDS,
  ScaleMode,
  SyncState,
  isUsableRange,
  nowRange,
  parseRangeParams,
  recordToRange,
} from './ChartManager.js';

// v10 API mocks (replaces v9 timeScale/priceScale)
class FakeChartV10 {
  constructor(id) {
    this.id = id;
    this.scrollCount = 0;
    this.scrollTs = null;
    this.subscribers = {};
    this.overrides = null;
  }

  subscribeAction(actionType, handler) {
    if (!this.subscribers[actionType]) {
      this.subscribers[actionType] = [];
    }
    this.subscribers[actionType].push(handler);
  }

  unsubscribeAction(actionType, handler) {
    if (!this.subscribers[actionType]) return;
    this.subscribers[actionType] = this.subscribers[actionType].filter((h) => h !== handler);
  }

  scrollToTimestamp(ts) {
    this.scrollCount += 1;
    this.scrollTs = ts;
  }

  overrideYAxis(override) {
    this.overrides = override;
  }

  setDataLoader(loader) {
    this.loader = loader;
  }

  setSymbol(symbol) {
    this.symbol = symbol;
  }

  setPeriod(period) {
    this.period = period;
  }

  // Test helper to fire events
  fireVisibleRangeChange(range) {
    if (this.subscribers['onVisibleRangeChange']) {
      for (const h of this.subscribers['onVisibleRangeChange']) {
        h(range);
      }
    }
  }
}

function makeChartV10(id) {
  return new FakeChartV10(id);
}

function makePair(charts = {}) {
  const btc = makeChartV10('BTCUSDT');
  const eth = makeChartV10('ETHUSDT');
  const manager = new ChartManager();
  manager.initCharts([
    { id: 'BTCUSDT', chart: btc },
    { id: 'ETHUSDT', chart: eth },
  ]);
  return { manager, btc, eth };
}

describe('ChartManager range math (migrated chart-range.js)', () => {
  it('recordToRange applies exactly ±24h padding before ms conversion', () => {
    const { startMs, endMs } = recordToRange({ start_time: 1704067200, end_time: 1704074400 });
    expect(startMs).toBe(1703980800000);
    expect(endMs).toBe(1704160800000);
    expect(startMs).toBe((1704067200 - PADDING_SECONDS) * 1000);
    expect(endMs).toBe((1704074400 + PADDING_SECONDS) * 1000);
  });

  it('parseRangeParams parses a valid start/end pair', () => {
    expect(parseRangeParams('?start=1703980800000&end=1704160800000')).toEqual({
      startMs: 1703980800000,
      endMs: 1704160800000,
    });
  });

  it('parseRangeParams empty string returns null', () => {
    expect(parseRangeParams('')).toBeNull();
  });

  it('parseRangeParams missing end param returns null', () => {
    expect(parseRangeParams('?start=1703980800000')).toBeNull();
  });

  it('parseRangeParams missing start param returns null', () => {
    expect(parseRangeParams('?end=1704160800000')).toBeNull();
  });

  it('parseRangeParams non-numeric values return null', () => {
    expect(parseRangeParams('?start=abc&end=xyz')).toBeNull();
  });

  it('parseRangeParams inverted range returns null', () => {
    expect(parseRangeParams('?start=10&end=5')).toBeNull();
    expect(parseRangeParams('?start=5&end=5')).toBeNull();
  });

  it('parseRangeParams ignores extra params', () => {
    expect(parseRangeParams('?symbol=BTCUSDT&start=1703980800000&end=1704160800000')).toEqual({
      startMs: 1703980800000,
      endMs: 1704160800000,
    });
  });

  it('nowRange returns a 30-day window anchored near now', () => {
    const r = nowRange();
    expect(r.endMs - r.startMs).toBe(DEFAULT_WINDOW_SECONDS * 1000);
    expect(Math.abs(r.endMs - Date.now())).toBeLessThanOrEqual(1000);
  });

  it('round-trip: recordToRange output parses back exactly', () => {
    const { startMs, endMs } = recordToRange({ start_time: 1704067200, end_time: 1704074400 });
    expect(parseRangeParams(`?start=${startMs}&end=${endMs}`)).toEqual({ startMs, endMs });
  });

  it('isUsableRange rejects null, NaN, and non-finite bounds', () => {
    expect(isUsableRange(null)).toBe(false);
    expect(isUsableRange(undefined)).toBe(false);
    expect(isUsableRange({ from: NaN, to: 5 })).toBe(false);
    expect(isUsableRange({ from: -Infinity, to: 5 })).toBe(false);
    expect(isUsableRange({ from: 1, to: 2 })).toBe(true);
  });
});

describe('ChartManager logical-range sync & re-entrancy (migrated chart-sync.js)', () => {
  it('forwarding: a range fired on the source is applied verbatim to the target', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: 5, to: 45 });
    expect(eth._ts.applyCount).toBe(1);
    expect(eth._ts.range).toEqual({ from: 5, to: 45 });
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    unsub();
  });

  it('re-entrancy: bidirectional wiring applies once per event, no loop', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: 5, to: 45 });
    expect(eth._ts.applyCount).toBe(1);
    expect(btc._ts.applyCount).toBe(0);
    eth._ts.fire({ from: 10, to: 50 });
    expect(btc._ts.applyCount).toBe(1);
    expect(eth._ts.applyCount).toBe(1);
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    unsub();
  });

  it('rapid-fire: each event applied exactly once, last wins, no crash', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: 0, to: 10 });
    btc._ts.fire({ from: 1, to: 11 });
    btc._ts.fire({ from: 2, to: 12 });
    expect(eth._ts.applyCount).toBe(3);
    expect(eth._ts.range).toEqual({ from: 2, to: 12 });
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    unsub();
  });

  it('null range is ignored during sync', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire(null);
    expect(eth._ts.applyCount).toBe(0);
    unsub();
  });

  it('non-finite ranges (data-boundary edges) are ignored', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: -Infinity, to: 50 });
    btc._ts.fire({ from: NaN, to: 10 });
    expect(eth._ts.applyCount).toBe(0);
    unsub();
  });

  it('gap tolerance: logical ranges forward verbatim across unequal datasets', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: 100, to: 149 });
    expect(eth._ts.range).toEqual({ from: 100, to: 149 });
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    unsub();
  });

  it('unsubscribe: the returned function detaches the handler', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    unsub();
    btc._ts.fire({ from: 1, to: 2 });
    expect(eth._ts.applyCount).toBe(0);
  });

  it('exception-safety: guard resets even when apply throws, later syncs still work', () => {
    const source = makeChart('A');
    const target = { ...makeChart('B'), timeScale: () => new ThrowingTimeScale() };
    const manager = new ChartManager();
    manager.initCharts([
      { id: 'A', chart: source, series: makeSeries() },
      { id: 'B', chart: target, series: makeSeries() },
    ]);
    manager.subscribe('A');
    expect(() => source._ts.fire({ from: 1, to: 2 })).toThrow('boom');
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    expect(() => manager.syncRanges('A', { from: 5, to: 45 })).toThrow('boom');
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
  });

  it('handler cleanup: unsubscribe prevents future notifications', () => {
    const { manager, btc, eth } = makePair();
    const unsub = manager.wireSync();
    btc._ts.fire({ from: 1, to: 10 });
    expect(eth._ts.applyCount).toBe(1);
    expect(btc._ts.handlers.length).toBe(1);
    unsub();
    expect(btc._ts.handlers.length).toBe(0);
    btc._ts.fire({ from: 2, to: 20 });
    expect(eth._ts.applyCount).toBe(1);
  });
});

describe('ChartManager lifecycle state machine', () => {
  it('starts in INIT and transitions to READY on initCharts', () => {
    const manager = new ChartManager();
    expect(manager.getState().state).toBe(ManagerState.INIT);
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('loadRange moves READY -> LOADING -> READY on success', async () => {
    const manager = new ChartManager({ load: async () => [{ id: 'BTCUSDT', rows: [] }] });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    const events = [];
    manager.on('statechange', (e) => events.push(e.to));
    await manager.loadRange(1000, 2000);
    expect(events).toEqual([ManagerState.LOADING, ManagerState.READY]);
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('loadRange moves READY -> LOADING -> ERROR on failure and rethrows', async () => {
    const manager = new ChartManager({ load: async () => { throw new Error('network'); } });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    const events = [];
    manager.on('statechange', (e) => events.push(e.to));
    await expect(manager.loadRange(1000, 2000)).rejects.toThrow('network');
    expect(events).toEqual([ManagerState.LOADING, ManagerState.ERROR]);
    expect(manager.getState().state).toBe(ManagerState.ERROR);
  });

  it('can retry a failed load (ERROR -> LOADING -> READY)', async () => {
    let calls = 0;
    const manager = new ChartManager({
      load: async () => {
        calls += 1;
        if (calls === 1) throw new Error('first fail');
        return [{ id: 'BTCUSDT', rows: [] }];
      },
    });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await expect(manager.loadRange(1000, 2000)).rejects.toThrow('first fail');
    expect(manager.getState().state).toBe(ManagerState.ERROR);
    await manager.loadRange(1000, 2000);
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('rejects an invalid state transition (INIT -> LOADING)', async () => {
    const manager = new ChartManager({ load: async () => [] });
    await expect(manager.loadRange(1, 2)).rejects.toThrow('Invalid state transition');
  });

  it('loadRange guards against concurrent loads (re-entrancy)', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const manager = new ChartManager({
      load: async () => { await gate; return [{ id: 'BTCUSDT', rows: [] }]; },
    });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    const first = manager.loadRange(1000, 2000);
    await expect(manager.loadRange(2000, 3000)).rejects.toThrow('already in progress');
    release();
    await first;
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('loadRange rejects inverted/non-finite windows', async () => {
    const manager = new ChartManager({ load: async () => [] });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await expect(manager.loadRange(2000, 1000)).rejects.toThrow(RangeError);
    await expect(manager.loadRange(NaN, 1000)).rejects.toThrow(RangeError);
  });

  it('loadRange throws when no loader is configured', async () => {
    const manager = new ChartManager();
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await expect(manager.loadRange(1000, 2000)).rejects.toThrow('no loader');
  });
});

describe('ChartManager scale mode', () => {
  it('starts in linear mode', () => {
    const { manager } = makePair();
    expect(manager.getState().scaleMode).toBe(ScaleMode.LINEAR);
  });

  it('toggleLogScale flips to logarithmic and back', () => {
    const { manager, btc, eth } = makePair();
    expect(manager.toggleLogScale()).toBe(ScaleMode.LOGARITHMIC);
    expect(manager.getState().scaleMode).toBe(ScaleMode.LOGARITHMIC);
    expect(btc._scale.mode).toBe(1);
    expect(eth._scale.mode).toBe(1);
    expect(manager.toggleLogScale()).toBe(ScaleMode.LINEAR);
    expect(manager.getState().scaleMode).toBe(ScaleMode.LINEAR);
    expect(btc._scale.mode).toBe(0);
    expect(eth._scale.mode).toBe(0);
  });

  it('setLogScale applies the mapped price-scale mode to all charts', () => {
    const { manager, btc, eth } = makePair();
    manager.setLogScale(ScaleMode.LOGARITHMIC);
    expect(btc._scale.mode).toBe(1);
    expect(eth._scale.mode).toBe(1);
  });

  it('setLogScale is idempotent and does not re-apply when unchanged', () => {
    const { manager, btc } = makePair();
    manager.setLogScale(ScaleMode.LINEAR);
    expect(btc._scale.mode).toBe(null);
  });

  it('setLogScale rejects an unknown mode', () => {
    const { manager } = makePair();
    expect(() => manager.setLogScale('bogus')).toThrow('Unknown scale mode');
  });

  it('emits scalechange with the new mode', () => {
    const { manager } = makePair();
    const seen = [];
    manager.on('scalechange', (e) => seen.push(e.mode));
    manager.toggleLogScale();
    expect(seen).toEqual([ScaleMode.LOGARITHMIC]);
  });
});

describe('ChartManager init & accessors', () => {
  it('returns chart by id (v10: no separate series)', () => {
    const { manager, btc, eth } = makePair();
    expect(manager.getChart('BTCUSDT')).toBe(btc);
    expect(manager.getChart('ETHUSDT')).toBe(eth);
    // v10: getSeries returns the chart (no separate series object)
    expect(manager.getSeries('BTCUSDT')).toBe(btc);
    expect(manager.getSeries('ETHUSDT')).toBe(eth);
    expect(manager.getChart('NOPE')).toBeNull();
    expect(manager.getSeries('NOPE')).toBeNull();
  });

  it('exposes the registered chart ids', () => {
    const { manager } = makePair();
    expect(manager.chartIds()).toEqual(CHART_IDS);
  });

  it('initCharts rejects invalid entries', () => {
    const manager = new ChartManager();
    expect(() => manager.initCharts([])).toThrow(TypeError);
    expect(() => manager.initCharts([{ id: 'x' }])).toThrow(TypeError);
    expect(() => manager.initCharts(null)).toThrow(TypeError);
  });

  it('re-initializing resets cache and chart set', () => {
    const { manager } = makePair();
    manager.setData('BTCUSDT', [{ timestamp: 1 }]);
    expect(manager.getState().cache.BTCUSDT).toBe(1);
    const eth2 = makeChartV10('ETHUSDT');
    manager.initCharts([{ id: 'ETHUSDT', chart: eth2 }]);
    expect(manager.getState().cache).toEqual({});
    expect(manager.chartIds()).toEqual(['ETHUSDT']);
  });
});

describe('ChartManager data cache', () => {
  it('setData caches candles and records the cache count', () => {
    const { manager } = makePair();
    const candles = [{ timestamp: 1 }, { timestamp: 2 }, { timestamp: 3 }];
    manager.setData('BTCUSDT', candles);
    expect(manager.getData('BTCUSDT')).toBe(candles);
    expect(manager.getState().cache.BTCUSDT).toBe(3);
  });

  it('setData rejects non-array input', () => {
    const { manager } = makePair();
    expect(() => manager.setData('BTCUSDT', 'nope')).toThrow(TypeError);
  });

  it('getData returns null for an unknown symbol', () => {
    const { manager } = makePair();
    expect(manager.getData('NOPE')).toBeNull();
  });

  it('setData emits datachange with symbol and count', () => {
    const { manager } = makePair();
    const seen = [];
    manager.on('datachange', (e) => seen.push(e));
    manager.setData('BTCUSDT', [{ timestamp: 1 }]);
    expect(seen).toEqual([{ symbol: 'BTCUSDT', count: 1 }]);
  });
});

describe('ChartManager setVisibleRange & state snapshot', () => {
  it('setVisibleRange applies the range to all charts except the source', () => {
    const { manager, btc, eth } = makePair();
    const applied = manager.setVisibleRange({ from: 5, to: 45 }, 'BTCUSDT');
    expect(applied).toBe(true);
    expect(btc.scrollCount).toBe(0);  // v10: source chart not scrolled
    expect(eth.scrollCount).toBe(1);  // v10: other charts scrolled
    expect(eth.scrollTs).toBe(25);    // v10: scrollToTimestamp called with center (5+45)/2
    expect(manager.getState().visibleRange).toEqual({ from: 5, to: 45 });
  });

  it('setVisibleRange is ignored (returns false) for non-usable ranges', () => {
    const { manager, eth } = makePair();
    expect(manager.setVisibleRange(null)).toBe(false);
    expect(manager.setVisibleRange({ from: NaN, to: 5 })).toBe(false);
    expect(eth.scrollCount).toBe(0);
  });

  it('setVisibleRange emits rangechange with origin set', () => {
    const { manager } = makePair();
    const seen = [];
    manager.on('rangechange', (e) => seen.push(e));
    manager.setVisibleRange({ from: 1, to: 2 });
    expect(seen[0]).toMatchObject({ origin: 'set', range: { from: 1, to: 2 } });
  });

  it('syncRanges returns false for an unknown source chart', () => {
    const { manager } = makePair();
    expect(manager.syncRanges('NOPE')).toBe(false);
  });

  it('getState returns a frozen snapshot', () => {
    const { manager } = makePair();
    const s = manager.getState();
    expect(() => { s.state = 'x'; }).toThrow();
    expect(Object.isFrozen(s.cache)).toBe(true);
  });

  it('getState snapshot reflects visible and loaded ranges', async () => {
    const manager = new ChartManager({ load: async () => [{ id: 'BTCUSDT', rows: [] }] });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    manager.setVisibleRange({ from: 3, to: 9 }, 'BTCUSDT');
    await manager.loadRange(1000, 5000);
    const s = manager.getState();
    expect(s.visibleRange).toEqual({ from: 3, to: 9 });
    expect(s.loadedRange).toEqual({ startMs: 1000, endMs: 5000 });
  });

  it('does not pollute the global window object', () => {
    const before = Object.keys(globalThis);
    new ChartManager();
    expect(Object.keys(globalThis)).toEqual(before);
  });
});

describe('ChartManager structured logging (16a-01.4)', () => {
  function spyLogger() {
    const calls = [];
    const logger = {
      calls,
      info: (...args) => calls.push(['info', ...args]),
      warn: (...args) => calls.push(['warn', ...args]),
      debug: (...args) => calls.push(['debug', ...args]),
      error: (...args) => calls.push(['error', ...args]),
      captureException: (...args) => calls.push(['captureException', ...args]),
    };
    return logger;
  }

  it('logs state transitions at debug level', () => {
    const logger = spyLogger();
    const manager = new ChartManager({ logger });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    expect(logger.calls.some(([level, action]) => level === 'debug' && action === 'transition')).toBe(true);
  });

  it('logs loadRange start/complete at info level', async () => {
    const logger = spyLogger();
    const manager = new ChartManager({ logger, load: async () => [{ id: 'BTCUSDT', rows: [] }] });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await manager.loadRange(1000, 2000);
    const actions = logger.calls.map(([, action]) => action);
    expect(actions).toContain('loadRange.start');
    expect(actions).toContain('loadRange.complete');
    const complete = logger.calls.find(([, action]) => action === 'loadRange.complete');
    expect(complete[2]).toContain('range loaded');
  });

  it('captures loadRange failures as exceptions', async () => {
    const logger = spyLogger();
    const manager = new ChartManager({ logger, load: async () => { throw new TypeError('network'); } });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await expect(manager.loadRange(1000, 2000)).rejects.toThrow('network');
    const captured = logger.calls.find(([level, action]) => level === 'captureException' && action === 'loadRange.error');
    expect(captured).toBeDefined();
    expect(captured[2].message).toBe('network');
  });

  it('logs aborted loads at debug level, never as exceptions', async () => {
    const logger = spyLogger();
    const manager = new ChartManager({
      logger,
      load: async () => { throw new DOMException('aborted', 'AbortError'); },
    });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    await expect(manager.loadRange(1000, 2000)).rejects.toThrow('aborted');
    expect(logger.calls.some(([level, action]) => level === 'captureException' && action === 'loadRange.error')).toBe(false);
    expect(logger.calls.some(([level, action, , context]) => level === 'debug' && action === 'loadRange.error' && context.kind === 'abort-superseded')).toBe(true);
  });

  it('logs initCharts and setLogScale at info level', () => {
    const logger = spyLogger();
    const manager = new ChartManager({ logger });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    manager.setLogScale(ScaleMode.LOGARITHMIC);
    const actions = logger.calls.map(([, action]) => action);
    expect(actions).toContain('initCharts');
    expect(actions).toContain('setLogScale');
  });

  it('warns via the injected logger when unsubscribing a chart with no unsubscribeAction (v10)', () => {
    const logger = spyLogger();
    const manager = new ChartManager({ logger });
    const chart = makeChartV10('BTCUSDT');
    manager.initCharts([{ id: 'BTCUSDT', chart }]);
    manager.subscribe('BTCUSDT');
    // Remove the unsubscribeAction method to trigger the warning
    chart.unsubscribeAction = null;
    manager.unsubscribe('BTCUSDT');
    expect(logger.calls.some(([level, action]) => level === 'warn' && action === 'unsubscribe')).toBe(true);
  });

  it('emits no logs when no logger is injected (dependency-free default)', async () => {
    const manager = new ChartManager({ load: async () => [{ id: 'BTCUSDT', rows: [] }] });
    const chart = makeChartV10('BTCUSDT');
    manager.initCharts([{ id: 'BTCUSDT', chart }]);
    await manager.loadRange(1000, 2000);
    manager.setVisibleRange({ from: 1, to: 2 });
    manager.unsubscribe('NOPE');
    expect(manager._logger).toBeNull();
  });
});
