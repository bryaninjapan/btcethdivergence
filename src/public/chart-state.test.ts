/**
 * Chart state factory tests — verify isolation and no global pollution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createChartState } from '../../public/js/chart-state';

// tsconfig lib is [ES2022, WebWorker] (no DOM); access the jsdom globals
// via globalThis and treat DOM nodes as any.
const window = globalThis as unknown as { [key: string]: any };

describe('createChartState factory', () => {
  it('should create isolated state instances', () => {
    const state1 = createChartState();
    const state2 = createChartState();

    state1.set('lastZoomLevel', 2);
    state2.set('lastZoomLevel', 3);

    expect(state1.get('lastZoomLevel')).toBe(2);
    expect(state2.get('lastZoomLevel')).toBe(3);
  });

  it('should initialize charts', () => {
    const state = createChartState();
    const mockChart = { id: 'btc-chart' };

    state.initCharts(mockChart, mockChart);

    expect(state.get('btcChart')).toBe(mockChart);
    expect(state.get('ethChart')).toBe(mockChart);
  });

  it('should initialize series', () => {
    const state = createChartState();
    const mockSeries = { id: 'kline-series' };

    state.initSeries(mockSeries, mockSeries);

    expect(state.get('btcSeries')).toBe(mockSeries);
    expect(state.get('ethSeries')).toBe(mockSeries);
  });

  it('should track zoom level', () => {
    const state = createChartState();

    state.updateZoomLevel(1);
    expect(state.get('lastZoomLevel')).toBe(1);

    state.updateZoomLevel(2.5);
    expect(state.get('lastZoomLevel')).toBe(2.5);
  });

  it('should manage sync token', () => {
    const state = createChartState();

    state.setSyncToken('token-123');
    expect(state.get('syncToken')).toBe('token-123');

    state.clearSyncToken();
    expect(state.get('syncToken')).toBeNull();
  });

  it('should support method chaining', () => {
    const state = createChartState();

    const result = state
      .updateZoomLevel(1.5)
      .setSyncToken('test')
      .clearSyncToken();

    expect(result).toBe(state);
    expect(state.get('lastZoomLevel')).toBe(1.5);
    expect(state.get('syncToken')).toBeNull();
  });

  it('should throw on unknown state key', () => {
    const state = createChartState();

    expect(() => state.get('unknownKey')).toThrow('Unknown state key');
    expect(() => state.set('unknownKey', 123)).toThrow('Unknown state key');
  });

  it('should return frozen state snapshot', () => {
    const state = createChartState();
    state.updateZoomLevel(2);

    const snapshot = state.getState();

    expect(snapshot.lastZoomLevel).toBe(2);
    expect(() => {
      // @ts-expect-error Testing that frozen state is immutable
      snapshot.lastZoomLevel = 3;
    }).toThrow();
  });

  it('should not pollute global window object', () => {
    const keysBefore = Object.keys(window);

    createChartState();

    const keysAfter = Object.keys(window);
    expect(keysBefore.length).toBe(keysAfter.length);
  });
});
