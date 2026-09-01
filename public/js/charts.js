import { api, ApiError, describeApiError } from './api.js';
import { createRangeSync } from './chart-sync.js';
import { Timestamp } from './timestamp.js';
import {
  dayOptions,
  daysInMonth,
  hourOptions,
  monthOptions,
  yearOptions,
  buildUtcEpoch,
  epochToParts,
} from './datetime.js';
import { nowRange, parseRangeParams } from './chart-range.js';
import { createChartState } from './chart-state.js';
import {
  fillSelect,
  rebuildDays,
  setPickerFromEpoch,
  pickerEpoch,
} from './datetime-helpers.js';

// Chart state factory instance
const chartState = createChartState();

// Subscription management (not part of state factory)
let sync = null, unsubBtc = null, unsubEth = null;
let activeController = null;

function toCandle(row) {
  return {
    time: row.open_time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  };
}

async function loadWindow(symbol, startMs, endMs, controller) {
  return api(`/api/klines?symbol=${encodeURIComponent(symbol)}&start=${startMs}&end=${endMs}`, {
    signal: controller?.signal,
  });
}

function renderChart(containerId, candles) {
  const chart = LightweightCharts.createChart(document.getElementById(containerId), {
    height: 420,
    layout: {
      background: { type: 'solid', color: '#ffffff' },
      textColor: '#1f2328',
    },
    timeScale: { borderColor: '#d0d7de', rightOffset: 5 },
    rightPriceScale: { borderColor: '#d0d7de' },
  });
  const series = chart.addSeries(LightweightCharts.CandlestickSeries, {
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

function setLogScale(enabled) {
  const mode = enabled
    ? LightweightCharts.PriceScaleMode.Logarithmic
    : LightweightCharts.PriceScaleMode.Normal;
  const btcChart = chartState.get('btcChart');
  const ethChart = chartState.get('ethChart');
  for (const chart of [btcChart, ethChart]) {
    if (chart) chart.priceScale('right').applyOptions({ mode });
  }
}

async function loadRange(startMs, endMs) {
  const errorEl = document.getElementById('chart-error');
  const loadingEl = document.getElementById('chart-loading');
  if (unsubBtc) unsubBtc();
  if (unsubEth) unsubEth();
  if (loadingEl) loadingEl.hidden = false;
  errorEl.hidden = true;
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const [btcRows, ethRows] = await Promise.all([
      loadWindow('BTCUSDT', startMs, endMs, controller),
      loadWindow('ETHUSDT', startMs, endMs, controller),
    ]);

    if (loadingEl) loadingEl.hidden = true;

    const btcSeries = chartState.get('btcSeries');
    const ethSeries = chartState.get('ethSeries');
    btcSeries.setData(btcRows.map(toCandle));
    ethSeries.setData(ethRows.map(toCandle));

    const btcChart = chartState.get('btcChart');
    const ethChart = chartState.get('ethChart');
    const initial = btcChart.timeScale().getVisibleLogicalRange();
    if (initial) ethChart.timeScale().setVisibleLogicalRange(initial);

    setPickersFromMs(startMs, endMs);
    const summary = document.getElementById('range-summary');
    if (summary) {
      summary.textContent = `${new Date(startMs).toISOString()} ~ ${new Date(endMs).toISOString()} (UTC)`;
    }
  } catch (error) {
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
    activeController = null;
    sync = sync || createRangeSync();
    const btcChart = chartState.get('btcChart');
    const ethChart = chartState.get('ethChart');
    unsubBtc = sync.link(btcChart.timeScale(), ethChart.timeScale());
    unsubEth = sync.link(ethChart.timeScale(), btcChart.timeScale());
  }
}

async function init() {
  const initial = parseRangeParams(window.location.search) ?? nowRange();
  const btc = renderChart('btc-chart', []);
  const eth = renderChart('eth-chart', []);
  chartState.set('btcChart', btc.chart).set('btcSeries', btc.series);
  chartState.set('ethChart', eth.chart).set('ethSeries', eth.series);

  setPickersFromMs(initial.startMs, initial.endMs);
  await loadRange(initial.startMs, initial.endMs);

  document.getElementById('log-scale').addEventListener('change', (e) => setLogScale(e.target.checked));
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