import { api, ApiError, describeApiError } from './api.js';
import { ChartManager, ScaleMode, nowRange, parseRangeParams } from './managers/ChartManager.js';
import { Timestamp } from './timestamp.js';
import {
  rebuildDays,
  setPickerFromEpoch,
  pickerEpoch,
} from './datetime-helpers.js';
import { classifyError, consoleSink, createBeaconSink, createLogger, installGlobalHandlers } from './logger.js';

// Constants
const LOAD_TIMEOUT_MS = 15000;  // 15 seconds for load operation

// v10 KLineChart API surface — replaces lightweight-charts v9
// Global klinecharts object is available via UMD CDN in charts.html
// (no imports needed; window.klinecharts is available at runtime)
const klinecharts = window.klinecharts || {};
if (!klinecharts.init) {
  throw new Error('KLineChart v10 library not loaded. Check charts.html <script> tag.');
}

// Structured logger: dev console (structured JSON) + client-log beacon. The
// beacon sink is fire-and-forget with a 2s timeout; it never blocks the UI.
const logger = createLogger('charts', { sinks: [consoleSink(), createBeaconSink()] });

/**
 * Create ChartManager for v10 KLineChart.
 * v10 API: priceScaleMode is no longer Linear/Logarithmic enum; use numeric values directly.
 * PriceScaleMode mapping (from v10 docs):
 *   0 = Normal (linear)
 *   1 = Logarithmic
 */
const chartManager = new ChartManager({
  // v10 price scale modes: 0 = normal (linear), 1 = logarithmic
  priceScaleMode: { linear: 0, logarithmic: 1 },
  logger,
  // Data transformation: v9 used 'time'; v10 uses 'timestamp' (already in ms from Binance)
  // No Math.floor() conversion — pass through unchanged.
  toCandle: (row) => ({
    timestamp: row.open_time,  // v10: timestamp field (ms, not seconds)
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }),
  load: async (startMs, endMs, signal) => {
    const [btcRows, ethRows] = await Promise.all([
      api(`/api/klines?symbol=BTCUSDT&start=${startMs}&end=${endMs}`, { signal }),
      api(`/api/klines?symbol=ETHUSDT&start=${startMs}&end=${endMs}`, { signal }),
    ]);
    return [
      { id: 'BTCUSDT', rows: btcRows },
      { id: 'ETHUSDT', rows: ethRows },
    ];
  },
});

let activeController = null;
let inFlight = null;

/**
 * Create a v10 KLineChart and render the candlestick chart.
 * v10 API differs from v9:
 *   - chart = klinecharts.init(dom) — initialize chart on DOM element
 *   - chart.renderChart('kline', { ...options }) — render candlestick series
 *   - No separate series object; indicators/overlays are managed by the chart
 *   - Data is set via chart.setDataLoader() or chart.applyNewData()
 *
 * @param {string} containerId — DOM element ID
 * @param {Array} candles — initial candlestick data (currently unused; data comes from loader)
 * @returns {{ chart, series: null }} — chart object only (v10 has no separate series)
 */
function renderChart(containerId, candles) {
  const dom = document.getElementById(containerId);
  if (!dom) throw new Error(`Container not found: ${containerId}`);

  // v10 API: Initialize chart on the DOM element
  const chart = klinecharts.init(dom, {
    layout: {
      backgroundColor: '#ffffff',
      textColor: '#1f2328',
    },
    // v10 style config uses nested structure (different from v9's flat layout)
    style: {
      grid: {
        horizontal: {
          color: '#f0f0f0',
          show: true,
        },
        vertical: {
          color: '#f0f0f0',
          show: true,
        },
      },
    },
  });

  // v10 API: Render candlestick indicator
  chart.renderChart('kline', {
    styles: {
      // K-line (candlestick) colors
      up: {
        color: '#26a69a',         // green for up
        borderColor: '#26a69a',
        wickColor: '#26a69a',
      },
      down: {
        color: '#ef5350',         // red for down
        borderColor: '#ef5350',
        wickColor: '#ef5350',
      },
      // Volume bar (if shown)
      volume: {
        up: '#26a69a',
        down: '#ef5350',
      },
    },
  });

  // v10 has no separate series object; return chart only
  // Caller can use chart methods directly (e.g., chart.applyNewData, chart.setDataLoader)
  return { chart, series: null };
}

function setPickersFromMs(startMs, endMs) {
  setPickerFromEpoch(document.querySelector('[data-picker="start"]'), Timestamp.fromMillis(startMs).toSeconds());
  setPickerFromEpoch(document.querySelector('[data-picker="end"]'), Timestamp.fromMillis(endMs).toSeconds());
}

async function loadRange(startMs, endMs) {
  // Supersede any in-flight load before starting a new one so the manager's
  // strict re-entrancy guard never rejects a user-initiated reload.
  if (activeController) {
    activeController.abort('superseded');
    activeController = null;
  }
  if (inFlight) {
    const previous = inFlight;
    inFlight = null;
    await previous.catch((error) => {
      const kind = classifyError(error);
      if (kind === 'abort-timeout' || kind === 'abort-superseded') {
        logger.debug('loadRange.superseded', 'Previous load aborted', { startMs, endMs, kind });
      } else {
        logger.warn('loadRange.superseded', 'Superseded load failed', { startMs, endMs, kind });
      }
    });
  }

  const errorEl = document.getElementById('chart-error');
  const loadingEl = document.getElementById('chart-loading');
  if (loadingEl) loadingEl.hidden = false;
  errorEl.hidden = true;

  const controller = new AbortController();
  activeController = controller;
  // Distinguish timeout aborts from supersede aborts so classifyError() can
  // report the precise cause in logs.
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Load timed out', 'TimeoutError')),
    LOAD_TIMEOUT_MS,
  );

  const promise = (async () => {
    try {
      await chartManager.loadRange(startMs, endMs, { signal: controller.signal });
      if (activeController !== controller) return; // superseded by a newer load
      if (loadingEl) loadingEl.hidden = true;
      setPickersFromMs(startMs, endMs);
      const summary = document.getElementById('range-summary');
      if (summary) {
        summary.textContent = `${new Date(startMs).toISOString()} ~ ${new Date(endMs).toISOString()} (UTC)`;
      }
    } catch (error) {
      if (activeController !== controller) {
        // A newer load superseded this one — expected, not an error.
        logger.debug('loadRange.superseded', 'Superseded by a newer load', { startMs, endMs });
        return;
      }
      if (loadingEl) loadingEl.hidden = true;

      logger.captureException('loadRange.error', error, {
        startMs,
        endMs,
        kind: classifyError(error),
      });

      let message = describeApiError(error, '載入 K 線失敗');
      // For non-ApiError, add fallback prefix
      if (!(error instanceof ApiError)) {
        message = `載入 K 線失敗：${message}`;
      }

      errorEl.textContent = message;
      errorEl.hidden = false;
    } finally {
      clearTimeout(timeoutId);
      if (activeController === controller) activeController = null;
    }
  })();

  inFlight = promise;
  try {
    return await promise;
  } finally {
    if (inFlight === promise) inFlight = null;
  }
}

async function init() {
  const initial = parseRangeParams(window.location.search) ?? nowRange();
  const btc = renderChart('btc-chart', []);
  const eth = renderChart('eth-chart', []);

  // v10 Note: renderChart() returns { chart, series: null } since v10 manages series internally
  // ChartManager.initCharts expects the chart object; it will use chart methods directly
  chartManager.initCharts([
    { id: 'BTCUSDT', chart: btc.chart, series: btc.chart },  // series = chart in v10
    { id: 'ETHUSDT', chart: eth.chart, series: eth.chart },
  ]);

  // Wire up the event-based sync for both charts
  // v10: Uses chart.subscribeAction('onVisibleRangeChange') internally (see ChartManager.subscribe)
  chartManager.wireSync();

  setPickersFromMs(initial.startMs, initial.endMs);
  await loadRange(initial.startMs, initial.endMs);

  document.getElementById('log-scale').addEventListener('change', (e) => {
    chartManager.setLogScale(e.target.checked ? ScaleMode.LOGARITHMIC : ScaleMode.LINEAR);
  });
  for (const pickerEl of [document.querySelector('[data-picker="start"]'), document.querySelector('[data-picker="end"]')]) {
    pickerEl
      .querySelector('[data-part="year"]')
      .addEventListener('change', () => rebuildDays(pickerEl));
    pickerEl
      .querySelector('[data-part="month"]')
      .addEventListener('change', () => rebuildDays(pickerEl));
  }
  document.getElementById('load-range').addEventListener('click', () => {
    const startSec = pickerEpoch(document.querySelector('[data-picker="start"]'));
    const endSec = pickerEpoch(document.querySelector('[data-picker="end"]'));
    const summary = document.getElementById('range-summary');
    if (startSec >= endSec) {
      logger.warn('loadRange.invalidRange', '開始時間必須早於結束時間', { startSec, endSec });
      summary.textContent = '開始時間必須早於結束時間';
      return;
    }
    loadRange(startSec * 1000, endSec * 1000);
  });
}

// Test hook: expose chart references for e2e testing
if (typeof window !== 'undefined') {
  window.__test_charts = {
    get btcChart() { return chartManager.getChart('BTCUSDT'); },
    get ethChart() { return chartManager.getChart('ETHUSDT'); },
    get btcSeries() { return chartManager.getSeries('BTCUSDT'); },
    get ethSeries() { return chartManager.getSeries('ETHUSDT'); },
  };
}

// Capture uncaught exceptions and unhandled rejections into the logger (which
// also forwards them to the client-log beacon).
installGlobalHandlers(logger);

init().catch((error) => {
  logger.captureException('init', error, {});
  const errorEl = document.getElementById('chart-error');
  if (errorEl) {
    let message = describeApiError(error, '圖表初始化失敗');
    // For non-ApiError, add fallback prefix
    if (!(error instanceof ApiError)) {
      message = `圖表初始化失敗：${message}`;
    }

    errorEl.textContent = message;
    errorEl.hidden = false;
  }
});