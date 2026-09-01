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

class FakeTimeScale {
  constructor() {
    this.handlers = [];
    this.range = null;
    this.applyCount = 0;
  }
  subscribeVisibleLogicalRangeChange(fn) {
    this.handlers.push(fn);
    return undefined;
  }
  unsubscribeVisibleLogicalRangeChange(fn) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  setVisibleLogicalRange(range) {
    this.applyCount += 1;
    this.range = range;
    for (const h of [...this.handlers]) h(range);
  }
  fire(range) {
    for (const h of [...this.handlers]) h(range);
  }
  getVisibleLogicalRange() {
    return this.range;
  }
}

class ThrowingTimeScale extends FakeTimeScale {
  setVisibleLogicalRange() {
    throw new Error('boom');
  }
}

function makeChart(id) {
  const ts = new FakeTimeScale();
  const scale = { mode: null, applyOptions(opts) { if ('mode' in opts) this.mode = opts.mode; } };
  return {
    id,
    timeScale: () => ts,
    priceScale: () => scale,
    _ts: ts,
    _scale: scale,
  };
}

function makeSeries() {
  return { data: null, calls: [], setData(candles) { this.data = candles; this.calls.push(candles.length); } };
}

function makePair(charts = {}) {
  const btc = makeChart('BTCUSDT');
  const eth = makeChart('ETHUSDT');
  const btcSeries = makeSeries();
  const ethSeries = makeSeries();
  const manager = new ChartManager();
  manager.initCharts([
    { id: 'BTCUSDT', chart: btc, series: btcSeries },
    { id: 'ETHUSDT', chart: eth, series: ethSeries },
  ]);
  return { manager, btc, eth, btcSeries, ethSeries };
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
  it('returns chart and series by id', () => {
    const { manager, btc, eth, btcSeries, ethSeries } = makePair();
    expect(manager.getChart('BTCUSDT')).toBe(btc);
    expect(manager.getChart('ETHUSDT')).toBe(eth);
    expect(manager.getSeries('BTCUSDT')).toBe(btcSeries);
    expect(manager.getSeries('ETHUSDT')).toBe(ethSeries);
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
    const { manager, btcSeries } = makePair();
    manager.setData('BTCUSDT', [{ time: 1 }]);
    expect(manager.getState().cache.BTCUSDT).toBe(1);
    manager.initCharts([{ id: 'ETHUSDT', chart: makeChart('ETHUSDT'), series: btcSeries }]);
    expect(manager.getState().cache).toEqual({});
    expect(manager.chartIds()).toEqual(['ETHUSDT']);
  });
});

describe('ChartManager data cache', () => {
  it('setData pushes to the series and records the cache count', () => {
    const { manager, btcSeries } = makePair();
    const candles = [{ time: 1 }, { time: 2 }, { time: 3 }];
    manager.setData('BTCUSDT', candles);
    expect(btcSeries.data).toBe(candles);
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
    manager.setData('BTCUSDT', [{ time: 1 }]);
    expect(seen).toEqual([{ symbol: 'BTCUSDT', count: 1 }]);
  });
});

describe('ChartManager setVisibleRange & state snapshot', () => {
  it('setVisibleRange applies the range to all charts except the source', () => {
    const { manager, btc, eth } = makePair();
    const applied = manager.setVisibleRange({ from: 5, to: 45 }, 'BTCUSDT');
    expect(applied).toBe(true);
    expect(btc._ts.applyCount).toBe(0);
    expect(eth._ts.applyCount).toBe(1);
    expect(eth._ts.range).toEqual({ from: 5, to: 45 });
    expect(manager.getState().visibleRange).toEqual({ from: 5, to: 45 });
  });

  it('setVisibleRange is ignored (returns false) for non-usable ranges', () => {
    const { manager, eth } = makePair();
    expect(manager.setVisibleRange(null)).toBe(false);
    expect(manager.setVisibleRange({ from: NaN, to: 5 })).toBe(false);
    expect(eth._ts.applyCount).toBe(0);
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
