import { api, ApiError, describeApiError } from './api.js';
import { ChartManager, ScaleMode, nowRange, parseRangeParams } from './managers/ChartManager.js';
import { Timestamp } from './timestamp.js';
import {
  rebuildDays,
  setPickerFromEpoch,
  pickerEpoch,
} from './datetime-helpers.js';

// Constants
const LOAD_TIMEOUT_MS = 15000;  // 15 seconds for load operation

// Direct Lightweight Charts API surface (2 references; <=5 required by phase).
const { createChart, CandlestickSeries } = LightweightCharts;
const { Normal, Logarithmic } = LightweightCharts.PriceScaleMode;

const chartManager = new ChartManager({
  priceScaleMode: { linear: Normal, logarithmic: Logarithmic },
  toCandle: (row) => ({
    time: row.open_time,
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

function renderChart(containerId, candles) {
  const chart = createChart(document.getElementById(containerId), {
    height: 420,
    layout: {
      background: { type: 'solid', color: '#ffffff' },
      textColor: '#1f2328',
    },
    timeScale: { borderColor: '#d0d7de', rightOffset: 5 },
    rightPriceScale: { borderColor: '#d0d7de' },
  });
  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });
  series.setData(candles);
  return { chart, series };
}

function setPickersFromMs(startMs, endMs) {
  setPickerFromEpoch(document.querySelector('[data-picker="start"]'), Timestamp.fromMillis(startMs).toSeconds());
  setPickerFromEpoch(document.querySelector('[data-picker="end"]'), Timestamp.fromMillis(endMs).toSeconds());
}

async function loadRange(startMs, endMs) {
  // Supersede any in-flight load before starting a new one so the manager's
  // strict re-entrancy guard never rejects a user-initiated reload.
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  if (inFlight) {
    const previous = inFlight;
    inFlight = null;
    await previous.catch((error) => {
      // Only log non-abort errors for debugging
      if (error?.name !== 'AbortError' && !(error instanceof DOMException)) {
        console.warn('Superseded load failed:', error);
      }
    });
  }

  const errorEl = document.getElementById('chart-error');
  const loadingEl = document.getElementById('chart-loading');
  if (loadingEl) loadingEl.hidden = false;
  errorEl.hidden = true;

  const controller = new AbortController();
  activeController = controller;
  const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

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
      if (activeController !== controller) return; // superseded by a newer load
      if (loadingEl) loadingEl.hidden = true;

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
  chartManager.initCharts([
    { id: 'BTCUSDT', chart: btc.chart, series: btc.series },
    { id: 'ETHUSDT', chart: eth.chart, series: eth.series },
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

init().catch((error) => {
  console.error('Charts initialization failed:', error);
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