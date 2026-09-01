import { describe, expect, it } from 'vitest';
import {
  ChartManager,
  ManagerState,
  ScaleMode,
  SyncState,
} from './ChartManager.js';

class FakeTimeScale {
  constructor() {
    this.handlers = [];
    this.range = null;
    this.applyCount = 0;
  }
  subscribeVisibleLogicalRangeChange(fn) {
    this.handlers.push(fn);
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
    this.range = range;
    for (const h of [...this.handlers]) h(range);
  }
  getVisibleLogicalRange() {
    return this.range;
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

function candle(openTime, price = 100) {
  return { time: openTime, open: price, high: price, low: price, close: price };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('ChartManager integration — full chart workflows', () => {
  it('full session: init -> load -> sync -> scale toggle -> reload keeps state consistent', async () => {
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    const btcSeries = makeSeries();
    const ethSeries = makeSeries();
    const manager = new ChartManager({
      toCandle: (row) => candle(row.time),
      load: async (startMs, endMs) => [
        { id: 'BTCUSDT', rows: [{ time: startMs }, { time: startMs + 1 }] },
        { id: 'ETHUSDT', rows: [{ time: startMs }, { time: startMs + 1 }] },
      ],
    });

    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: btcSeries },
      { id: 'ETHUSDT', chart: eth, series: ethSeries },
    ]);
    manager.wireSync();

    await manager.loadRange(1000, 3000);
    expect(btcSeries.data).toHaveLength(2);
    expect(ethSeries.data).toHaveLength(2);
    expect(manager.getState().loadedRange).toEqual({ startMs: 1000, endMs: 3000 });

    btc._ts.setVisibleLogicalRange({ from: 3, to: 7 });
    expect(eth._ts.range).toEqual({ from: 3, to: 7 });

    manager.toggleLogScale();
    expect(manager.getState().scaleMode).toBe(ScaleMode.LOGARITHMIC);
    expect(btc._scale.mode).toBe(1);
    expect(eth._scale.mode).toBe(1);

    await manager.loadRange(5000, 9000);
    expect(manager.getState().state).toBe(ManagerState.READY);
    expect(manager.getState().scaleMode).toBe(ScaleMode.LOGARITHMIC);
    expect(ethSeries.calls).toEqual([2, 2]);
  });

  it('strict re-entrancy: a second loadRange while loading is rejected; first completes cleanly', async () => {
    const gate = deferred();
    const manager = new ChartManager({
      load: async (startMs, endMs) => {
        if (endMs === 2000) await gate.promise;
        return [{ id: 'BTCUSDT', rows: [{ time: endMs }] }];
      },
    });
    const series = makeSeries();
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series }]);

    const p1 = manager.loadRange(1000, 2000);
    await expect(manager.loadRange(3000, 4000)).rejects.toThrow('already in progress');
    gate.resolve();
    await p1;
    expect(series.data[0].time).toBe(2000);
    expect(manager.getState().state).toBe(ManagerState.READY);

    const p2 = await manager.loadRange(3000, 4000);
    expect(p2.loadedRange).toEqual({ startMs: 3000, endMs: 4000 });
  });

  it('sync under stress: 100 rapid cross-directional range events stay consistent', () => {
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    const manager = new ChartManager();
    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: makeSeries() },
      { id: 'ETHUSDT', chart: eth, series: makeSeries() },
    ]);
    manager.wireSync();

    for (let i = 0; i < 50; i += 1) {
      btc._ts.fire({ from: i, to: i + 10 });
      eth._ts.fire({ from: i + 1, to: i + 11 });
    }

    expect(btc._ts.range).toEqual({ from: 50, to: 60 });
    expect(eth._ts.range).toEqual({ from: 50, to: 60 });
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
    expect(manager.getState().visibleRange).toEqual({ from: 50, to: 60 });
  });

  it('failed load -> error displayed state -> retry recovers fully', async () => {
    let calls = 0;
    const manager = new ChartManager({
      load: async () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
        return [{ id: 'BTCUSDT', rows: [{ time: 1 }] }];
      },
    });
    const series = makeSeries();
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series }]);

    await expect(manager.loadRange(1, 100)).rejects.toThrow('boom');
    expect(manager.getState().state).toBe(ManagerState.ERROR);
    expect(series.data).toBeNull();

    await manager.loadRange(1, 100);
    expect(manager.getState().state).toBe(ManagerState.READY);
    expect(series.data).toHaveLength(1);
    expect(manager.getData('BTCUSDT')).toHaveLength(1);
  });

  it('aborted load (signal) transitions to ERROR; a fresh load recovers', async () => {
    const gate = deferred();
    let abortSignal;
    const manager = new ChartManager({
      load: async (startMs, endMs, signal) => {
        abortSignal = signal;
        if (signal?.aborted) throw new Error('Aborted');
        await gate.promise;
        if (signal?.aborted) throw new Error('Aborted');
        return [{ id: 'BTCUSDT', rows: [] }];
      },
    });
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);

    const controller = new AbortController();
    const pending = manager.loadRange(1, 100, { signal: controller.signal });
    controller.abort();
    gate.resolve();
    await expect(pending).rejects.toThrow();
    expect(manager.getState().state).toBe(ManagerState.ERROR);
    expect(abortSignal).toBe(controller.signal);

    await manager.loadRange(200, 300);
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('setVisibleRange then a user pan still syncs the other chart', () => {
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    const manager = new ChartManager();
    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: makeSeries() },
      { id: 'ETHUSDT', chart: eth, series: makeSeries() },
    ]);
    manager.wireSync();

    manager.setVisibleRange({ from: 0, to: 10 }, 'BTCUSDT');
    expect(eth._ts.range).toEqual({ from: 0, to: 10 });

    btc._ts.setVisibleLogicalRange({ from: 1, to: 11 });
    expect(eth._ts.range).toEqual({ from: 1, to: 11 });
    expect(manager.getState().visibleRange).toEqual({ from: 1, to: 11 });
  });

  it('data gaps: unequal dataset lengths sync logically with no crash', () => {
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    const manager = new ChartManager();
    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: makeSeries() },
      { id: 'ETHUSDT', chart: eth, series: makeSeries() },
    ]);
    manager.wireSync();

    btc._ts.setVisibleLogicalRange({ from: 100, to: 149 });
    expect(eth._ts.range).toEqual({ from: 100, to: 149 });
    expect(manager.getState().syncState).toBe(SyncState.IDLE);
  });

  it('unsubscribe mid-session stops sync; re-subscribe restores it', () => {
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    const manager = new ChartManager();
    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: makeSeries() },
      { id: 'ETHUSDT', chart: eth, series: makeSeries() },
    ]);
    const unsub = manager.wireSync();

    btc._ts.fire({ from: 1, to: 2 });
    expect(eth._ts.applyCount).toBe(1);

    unsub();
    btc._ts.fire({ from: 3, to: 4 });
    expect(eth._ts.applyCount).toBe(1);

    manager.wireSync();
    btc._ts.fire({ from: 5, to: 6 });
    expect(eth._ts.applyCount).toBe(2);
    expect(eth._ts.range).toEqual({ from: 5, to: 6 });
  });

  it('loadRange applies toCandle normalization to every symbol', async () => {
    const manager = new ChartManager({
      toCandle: (row) => ({ time: row.time, open: row.price, high: row.price, low: row.price, close: row.price }),
      load: async () => [
        { id: 'BTCUSDT', rows: [{ time: 1, price: 5 }, { time: 2, price: 6 }] },
        { id: 'ETHUSDT', rows: [{ time: 1, price: 1 }] },
      ],
    });
    const btcSeries = makeSeries();
    const ethSeries = makeSeries();
    manager.initCharts([
      { id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: btcSeries },
      { id: 'ETHUSDT', chart: makeChart('ETHUSDT'), series: ethSeries },
    ]);

    await manager.loadRange(1, 100);

    expect(btcSeries.data[0]).toEqual({ time: 1, open: 5, high: 5, low: 5, close: 5 });
    expect(ethSeries.data[0]).toEqual({ time: 1, open: 1, high: 1, low: 1, close: 1 });
    expect(manager.getState().cache).toEqual({ BTCUSDT: 2, ETHUSDT: 1 });
  });

  it('full state machine lifecycle across a realistic session', async () => {
    let fail = false;
    const transitions = [];
    const manager = new ChartManager({
      load: async (startMs, endMs) => {
        if (fail) throw new Error('boom');
        return [{ id: 'BTCUSDT', rows: [{ time: startMs }] }];
      },
    });
    manager.on('statechange', (e) => transitions.push(`${e.from}->${e.to}`));
    manager.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);

    await manager.loadRange(1, 100);
    fail = true;
    await expect(manager.loadRange(2, 100)).rejects.toThrow('boom');
    fail = false;
    await manager.loadRange(3, 100);

    expect(transitions).toEqual([
      'init->ready',
      'ready->loading',
      'loading->ready',
      'ready->loading',
      'loading->error',
      'error->loading',
      'loading->ready',
    ]);
    expect(manager.getState().state).toBe(ManagerState.READY);
  });

  it('emits rangechange events for load, sync, and explicit set origins', async () => {
    const manager = new ChartManager({
      load: async (startMs, endMs) => [
        { id: 'BTCUSDT', rows: [{ time: startMs }] },
        { id: 'ETHUSDT', rows: [{ time: startMs }] },
      ],
    });
    const btc = makeChart('BTCUSDT');
    const eth = makeChart('ETHUSDT');
    manager.initCharts([
      { id: 'BTCUSDT', chart: btc, series: makeSeries() },
      { id: 'ETHUSDT', chart: eth, series: makeSeries() },
    ]);
    manager.wireSync();
    const origins = [];
    manager.on('rangechange', (e) => origins.push(e.origin));

    await manager.loadRange(1, 100);
    btc._ts.fire({ from: 2, to: 12 });
    manager.setVisibleRange({ from: 3, to: 13 }, 'BTCUSDT');

    expect(origins).toEqual(['load', 'sync', 'set']);
  });

  it('multiple managers operate independently in parallel (no shared state)', async () => {
    const a = new ChartManager({ load: async () => [{ id: 'BTCUSDT', rows: [{ time: 1 }] }] });
    const b = new ChartManager({ load: async () => [{ id: 'BTCUSDT', rows: [{ time: 2 }] }] });
    a.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);
    b.initCharts([{ id: 'BTCUSDT', chart: makeChart('BTCUSDT'), series: makeSeries() }]);

    const [ra, rb] = await Promise.all([a.loadRange(1, 100), b.loadRange(1, 100)]);

    expect(ra.cache.BTCUSDT).toBe(1);
    expect(rb.cache.BTCUSDT).toBe(1);
    expect(a.getData('BTCUSDT')[0].time).toBe(1);
    expect(b.getData('BTCUSDT')[0].time).toBe(2);
  });

  it('scale changes survive a failed reload (scale mode is not reset on error)', async () => {
    let fail = false;
    const manager = new ChartManager({
      load: async () => {
        if (fail) throw new Error('boom');
        return [{ id: 'BTCUSDT', rows: [] }];
      },
    });
    const chart = makeChart('BTCUSDT');
    manager.initCharts([{ id: 'BTCUSDT', chart, series: makeSeries() }]);

    manager.toggleLogScale();
    await manager.loadRange(1, 100);
    fail = true;
    await expect(manager.loadRange(2, 100)).rejects.toThrow('boom');

    expect(manager.getState().scaleMode).toBe(ScaleMode.LOGARITHMIC);
    expect(chart._scale.mode).toBe(1);
  });
});