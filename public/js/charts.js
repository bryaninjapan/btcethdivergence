import { api } from './api.js';
import { createRangeSync } from './chart-sync.js';
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

let btcChart = null, ethChart = null, btcSeries = null, ethSeries = null;
let sync = null, unsubBtc = null, unsubEth = null;

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

function fillSelect(select, values) {
  select.replaceChildren();
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    select.appendChild(opt);
  }
}

function rebuildDays(pickerEl) {
  const y = Number(pickerEl.querySelector('[data-part="year"]').value);
  const m = Number(pickerEl.querySelector('[data-part="month"]').value);
  const prev = Number(pickerEl.querySelector('[data-part="day"]').value) || 1;
  fillSelect(pickerEl.querySelector('[data-part="day"]'), dayOptions(y, m));
  pickerEl.querySelector('[data-part="day"]').value = String(Math.min(prev, daysInMonth(y, m)));
}

function setPickerFromEpoch(pickerEl, ts) {
  const p = epochToParts(ts);
  fillSelect(pickerEl.querySelector('[data-part="year"]'), yearOptions());
  fillSelect(pickerEl.querySelector('[data-part="month"]'), monthOptions());
  fillSelect(pickerEl.querySelector('[data-part="hour"]'), hourOptions());
  pickerEl.querySelector('[data-part="year"]').value = String(p.year);
  pickerEl.querySelector('[data-part="month"]').value = String(p.month);
  pickerEl.querySelector('[data-part="day"]').value = String(p.day);
  pickerEl.querySelector('[data-part="hour"]').value = String(p.hour);
  rebuildDays(pickerEl);
}

function pickerEpoch(pickerEl) {
  return buildUtcEpoch(
    Number(pickerEl.querySelector('[data-part="year"]').value),
    Number(pickerEl.querySelector('[data-part="month"]').value),
    Number(pickerEl.querySelector('[data-part="day"]').value),
    Number(pickerEl.querySelector('[data-part="hour"]').value),
  );
}

function setPickersFromMs(startMs, endMs) {
  setPickerFromEpoch(document.querySelector('[data-picker="start"]'), Math.floor(startMs / 1000));
  setPickerFromEpoch(document.querySelector('[data-picker="end"]'), Math.floor(endMs / 1000));
}

function setLogScale(enabled) {
  const mode = enabled
    ? LightweightCharts.PriceScaleMode.Logarithmic
    : LightweightCharts.PriceScaleMode.Normal;
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const [btcRows, ethRows] = await Promise.all([
      loadWindow('BTCUSDT', startMs, endMs, controller),
      loadWindow('ETHUSDT', startMs, endMs, controller),
    ]);
    clearTimeout(timeoutId);
    if (loadingEl) loadingEl.hidden = true;

    btcSeries.setData(btcRows.map(toCandle));
    ethSeries.setData(ethRows.map(toCandle));

    const initial = btcChart.timeScale().getVisibleLogicalRange();
    if (initial) ethChart.timeScale().setVisibleLogicalRange(initial);

    setPickersFromMs(startMs, endMs);
    const summary = document.getElementById('range-summary');
    if (summary) {
      summary.textContent = `${new Date(startMs).toISOString()} ~ ${new Date(endMs).toISOString()} (UTC)`;
    }
  } catch (error) {
    if (loadingEl) loadingEl.hidden = true;
    errorEl.textContent = `載入 K 線失敗：${error.message}`;
    errorEl.hidden = false;
  } finally {
    sync = sync || createRangeSync();
    unsubBtc = sync.link(btcChart.timeScale(), ethChart.timeScale());
    unsubEth = sync.link(ethChart.timeScale(), btcChart.timeScale());
  }
}

async function init() {
  const initial = parseRangeParams(window.location.search) ?? nowRange();
  const btc = renderChart('btc-chart', []);
  const eth = renderChart('eth-chart', []);
  btcChart = btc.chart; btcSeries = btc.series;
  ethChart = eth.chart; ethSeries = eth.series;
  window.__charts = { btcChart, ethChart, btcSeries, ethSeries };

  setPickersFromMs(initial.startMs, initial.endMs);
  await loadRange(initial.startMs, initial.endMs);

  document.getElementById('log-scale').addEventListener('change', (e) => setLogScale(e.target.checked));
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

init();