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

// KLineChart v10.0.3 API (CDN UMD global)
// Note: klinecharts is the global namespace (lowercase)
const { init: createChart } = window.klinecharts || {};

// Structured logger: dev console (structured JSON) + client-log beacon. The
// beacon sink is fire-and-forget with a 2s timeout; it never blocks the UI.
const logger = createLogger('charts', { sinks: [consoleSink(), createBeaconSink()] });

const chartManager = new ChartManager({
  logger,
  toCandle: (row) => ({
    // CRITICAL TIMESTAMP CONTRACT (v10.0.3):
    // - Binance `open_time` is milliseconds (13 digits, e.g., 1693526400000)
    // - KLineChart v10 requires `timestamp` key with milliseconds
    // - NO conversion: pass timestamp through unchanged
    // - Wrong: timestamp: Math.floor(row.open_time / 1000)  // Would render 1970 dates!
    // - Correct: timestamp: row.open_time  // Pass through unchanged (13-digit ms)
    timestamp: row.open_time,
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
    volume: parseFloat(row.volume),
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
 * Create and configure a v10 KLineChart chart with style config.
 *
 * v10 API: klinecharts.init(container, options) where options includes styles nested object
 * Style config is translated from v9's flat structure to v10's nested structure:
 * - v9 upColor/downColor → v10 candle.bar.upColor / candle.bar.downColor
 * - v9 layout background → v10 candle.area.backgroundColor (or grid background)
 * - v9 textColor → v10 xAxis.tickText.color, yAxis.tickText.color
 * - v9 timeScale/rightPriceScale borders → v10 xAxis.axisLine / yAxis.axisLine
 */
function renderChart(containerId, candles) {
  const container = document.getElementById(containerId);

  // v10 style config (nested structure)
  const styles = {
    grid: {
      show: true,
      horizontal: {
        show: true,
        color: '#e8e8e8',
        style: 'dashed',
        size: 1,
      },
      vertical: {
        show: true,
        color: '#e8e8e8',
        style: 'dashed',
        size: 1,
      },
    },
    candle: {
      type: 'candle_solid',
      bar: {
        upColor: '#26a69a',
        downColor: '#ef5350',
        noChangeColor: '#888888',
      },
      priceMark: {
        show: true,
        high: {
          color: '#999999',
          textMargin: 5,
        },
        low: {
          color: '#999999',
          textMargin: 5,
        },
        last: {
          upColor: '#26a69a',
          downColor: '#ef5350',
          noChangeColor: '#888888',
        },
      },
      tooltip: {
        text: {
          color: '#ffffff',
        },
        box: {
          backgroundColor: '#1f2328',
          borderColor: '#666666',
        },
      },
    },
    xAxis: {
      axisLine: {
        color: '#d0d7de',
        size: 1,
      },
      tickLine: {
        show: true,
        color: '#d0d7de',
        size: 1,
      },
      tickText: {
        color: '#1f2328',
        margin: 5,
      },
    },
    yAxis: {
      axisLine: {
        color: '#d0d7de',
        size: 1,
      },
      tickLine: {
        show: true,
        color: '#d0d7de',
        size: 1,
      },
      tickText: {
        color: '#1f2328',
        margin: 5,
      },
    },
    crosshair: {
      show: true,
      horizontal: {
        show: true,
        color: '#999999',
        style: 'dashed',
        size: 1,
      },
      vertical: {
        show: true,
        color: '#999999',
        style: 'dashed',
        size: 1,
      },
    },
  };

  // v10 API: init() returns a Chart instance directly (no series creation needed)
  const chart = createChart(container, {
    locale: 'en-US',
    timezone: 'UTC',
    styles,
  });

  // v10 API: Data is provided via setDataLoader(), not series.setData()
  if (chart && typeof chart.setDataLoader === 'function') {
    chart.setDataLoader({
      getBars: ({ callback }) => {
        // Provide cached candles to the chart
        callback(candles);
      },
    });
  }

  return { chart };  // No series in v10
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
  // v10 API: only chart is needed (no separate series object)
  chartManager.initCharts([
    { id: 'BTCUSDT', chart: btc.chart },
    { id: 'ETHUSDT', chart: eth.chart },
  ]);
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

// Test hook: expose chart references for e2e testing (v10 API: no series object)
if (typeof window !== 'undefined') {
  window.__test_charts = {
    get btcChart() { return chartManager.getChart('BTCUSDT'); },
    get ethChart() { return chartManager.getChart('ETHUSDT'); },
    get chartManager() { return chartManager; },
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