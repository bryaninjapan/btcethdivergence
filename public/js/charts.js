import { api } from './api.js';
import { createRangeSync } from './chart-sync.js';

const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;

function toCandle(row) {
  return {
    time: row.open_time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  };
}

async function loadWindow(symbol, controller) {
  const endMs = Date.now();
  const startMs = endMs - DEFAULT_WINDOW_SECONDS * 1000;
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

async function init() {
  const errorEl = document.getElementById('chart-error');
  const loadingEl = document.getElementById('chart-loading');
  if (loadingEl) loadingEl.hidden = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const [btcRows, ethRows] = await Promise.all([
      loadWindow('BTCUSDT', controller),
      loadWindow('ETHUSDT', controller),
    ]);
    clearTimeout(timeoutId);
    if (loadingEl) loadingEl.hidden = true;

    const btcChart = renderChart('btc-chart', btcRows.map(toCandle));
    const ethChart = renderChart('eth-chart', ethRows.map(toCandle));

    const btcScale = btcChart.chart.timeScale();
    const ethScale = ethChart.chart.timeScale();

    const initial = btcScale.getVisibleLogicalRange();
    if (initial) ethScale.setVisibleLogicalRange(initial);

    const sync = createRangeSync();
    const unsubBtc = sync.link(btcScale, ethScale);
    const unsubEth = sync.link(ethScale, btcScale);
  } catch (error) {
    if (loadingEl) loadingEl.hidden = true;
    errorEl.textContent = `載入 K 線失敗：${error.message}`;
    errorEl.hidden = false;
  }
}

init();