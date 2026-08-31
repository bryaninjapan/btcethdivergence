import { calculatePosition } from './calculator.js';

const RESULT_FIELDS = ['position-size', 'sl-amount', 'tp-amount', 'rr-ratio', 'loss-rate', 'gain-rate'];
const INPUT_IDS = ['margin', 'entry-price', 'stop-loss', 'take-profit', 'leverage'];

function el(id) {
  return document.getElementById(id);
}

function readForm() {
  return {
    longShort: document.querySelector('input[name="longShort"]:checked')?.value ?? 'long',
    margin: Number(el('margin').value),
    entryPrice: Number(el('entry-price').value),
    stopLoss: Number(el('stop-loss').value),
    takeProfitPrice: Number(el('take-profit').value),
    leverage: Number(el('leverage').value),
  };
}

function isComplete() {
  return INPUT_IDS.every((id) => el(id).value.trim() !== '');
}

function clearResults() {
  for (const id of RESULT_FIELDS) {
    el(id).textContent = '—';
  }
  el('calc-error').hidden = true;
  el('rr-warning').hidden = true;
  el('liquidation-warning').hidden = true;
}

function trimZeros(value) {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

function formatQuantity(value) {
  if (!Number.isFinite(value)) return '—';
  return trimZeros(value.toPrecision(6));
}

function formatAmount(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toFixed(2);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatRatio(value) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function render(result) {
  const dash = (fmt, value) => (result.isValid ? fmt(value) : '—');

  el('position-size').textContent = dash(formatQuantity, result.positionSize);
  el('sl-amount').textContent = dash(formatAmount, result.stopLossAmount);
  el('tp-amount').textContent = dash(formatAmount, result.takeProfitAmount);
  el('rr-ratio').textContent = dash(formatRatio, result.riskRewardRatio);
  el('loss-rate').textContent = dash(formatPercent, result.lossRatePercent);
  el('gain-rate').textContent = dash(formatPercent, result.gainRatePercent);

  const errorEl = el('calc-error');
  errorEl.hidden = result.isValid;
  errorEl.textContent = result.isValid ? '' : (result.errorMessage || '輸入無效，請檢查數值');

  el('rr-warning').hidden = !result.warnings.riskRewardTooLow;
  el('liquidation-warning').hidden = !result.warnings.liquidationRisk;
}

function update() {
  if (!isComplete()) {
    clearResults();
    return;
  }
  render(calculatePosition(readForm()));
}

const form = el('calculator-form');
form.addEventListener('input', update);
form.addEventListener('change', update);
update();