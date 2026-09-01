/**
 * Chart state factory — encapsulates BTC/ETH chart state and methods
 * Provides isolated state management for charts without global variables
 */

export function createChartState() {
  const state = {
    btcChart: null,
    ethChart: null,
    btcSeries: null,
    ethSeries: null,
    lastZoomLevel: 1,
    syncToken: null,
  };

  return {
    /**
     * Get a state value by key
     */
    get(key) {
      if (!(key in state)) {
        throw new Error(`Unknown state key: ${key}`);
      }
      return state[key];
    },

    /**
     * Set a state value by key
     * Returns this for chaining
     */
    set(key, value) {
      if (!(key in state)) {
        throw new Error(`Unknown state key: ${key}`);
      }
      state[key] = value;
      return this;
    },

    /**
     * Get entire state as frozen object (read-only snapshot)
     */
    getState() {
      return Object.freeze({ ...state });
    },

    /**
     * Initialize charts with LiteCharts
     */
    initCharts(btcChartApi, ethChartApi) {
      this.set('btcChart', btcChartApi);
      this.set('ethChart', ethChartApi);
      return this;
    },

    /**
     * Initialize series
     */
    initSeries(btcSeriesApi, ethSeriesApi) {
      this.set('btcSeries', btcSeriesApi);
      this.set('ethSeries', ethSeriesApi);
      return this;
    },

    /**
     * Update zoom level tracking
     */
    updateZoomLevel(level) {
      this.set('lastZoomLevel', level);
      return this;
    },

    /**
     * Set sync token for deduplication
     */
    setSyncToken(token) {
      this.set('syncToken', token);
      return this;
    },

    /**
     * Clear sync token
     */
    clearSyncToken() {
      this.set('syncToken', null);
      return this;
    },
  };
}
