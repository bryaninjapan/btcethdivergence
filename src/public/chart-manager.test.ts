/**
 * ChartManager factory tests — verify isolation, state snapshots, and no global
 * pollution. Replaces the retired createChartState factory tests.
 */

import { describe, it, expect } from 'vitest';
import { ChartManager, ScaleMode } from '../../public/js/managers/ChartManager.js';

// tsconfig lib is [ES2022, WebWorker] (no DOM); access the jsdom globals
// via globalThis and treat DOM nodes as any.
const window = globalThis as unknown as { [key: string]: any };

function makeFakeChart(id: string) {
  const handlers: Array<(range: any) => void> = [];
  const ts = {
    handlers,
    range: null as any,
    subscribeVisibleLogicalRangeChange(fn: (range: any) => void) {
      handlers.push(fn);
    },
    unsubscribeVisibleLogicalRangeChange(fn: (range: any) => void) {
      const i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    },
    setVisibleLogicalRange(range: any) {
      this.range = range;
      for (const h of [...handlers]) h(range);
    },
    getVisibleLogicalRange() {
      return this.range;
    },
  };
  const scale = {
    mode: null as any,
    applyOptions(opts: any) {
      if ('mode' in opts) this.mode = opts.mode;
    },
  };
  return { id, timeScale: () => ts, priceScale: () => scale };
}

function makeSeries() {
  return { data: null as any, setData(d: any) { this.data = d; } };
}

describe('ChartManager factory', () => {
  it('should create isolated state instances', () => {
    const m1 = new ChartManager();
    const m2 = new ChartManager();
    m1.initCharts([{ id: 'BTCUSDT', chart: makeFakeChart('BTCUSDT'), series: makeSeries() }]);
    m2.initCharts([{ id: 'BTCUSDT', chart: makeFakeChart('BTCUSDT'), series: makeSeries() }]);

    m1.toggleLogScale();

    expect(m1.getState().scaleMode).toBe(ScaleMode.LOGARITHMIC);
    expect(m2.getState().scaleMode).toBe(ScaleMode.LINEAR);
  });

  it('should initialize charts and transition to READY', () => {
    const manager = new ChartManager();
    const chart = makeFakeChart('BTCUSDT');

    manager.initCharts([{ id: 'BTCUSDT', chart, series: makeSeries() }]);

    expect(manager.getChart('BTCUSDT')).toBe(chart);
    expect(manager.getState().state).toBe('ready');
  });

  it('should return a frozen state snapshot', () => {
    const manager = new ChartManager();
    manager.initCharts([{ id: 'BTCUSDT', chart: makeFakeChart('BTCUSDT'), series: makeSeries() }]);

    const snapshot = manager.getState();

    expect(() => {
      // @ts-expect-error Testing that frozen state is immutable
      snapshot.state = 'bogus';
    }).toThrow();
  });

  it('should not pollute global window object', () => {
    const keysBefore = Object.keys(window);

    new ChartManager();

    const keysAfter = Object.keys(window);
    expect(keysBefore.length).toBe(keysAfter.length);
  });
});