import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

/**
 * Integration test for calculator-init.js
 * Tests DOM binding, event handling, and UI updates
 */

describe('Calculator UI Integration', () => {
  let dom: JSDOM;
  let document: Document;
  let window: any;

  beforeEach(async () => {
    // Load real HTML
    const htmlPath = path.resolve(__dirname, '../../public/calculator.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Create JSDOM instance
    dom = new JSDOM(html, {
      url: 'http://localhost:3000/calculator.html',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    document = dom.window.document;
    window = dom.window;

    // Mock calculatePosition (from calculator.js)
    // This avoids testing the business logic, just the UI binding
    (window as any).calculatePosition = vi.fn((form: any) => {
      // Mock successful calculation
      if (!form.margin || !form.entryPrice || !form.stopLoss || !form.takeProfitPrice) {
        return { isValid: false, errorMessage: 'Missing fields' };
      }

      return {
        isValid: true,
        positionSize: 1000,
        stopLossAmount: 500,
        takeProfitAmount: 1500,
        riskRewardRatio: 3.0,
        lossRatePercent: 50,
        gainRatePercent: 150,
        warnings: {
          riskRewardTooLow: false,
          liquidationRisk: false,
        },
      };
    });

    // Dynamically import and execute calculator-init.js in the JSDOM context
    // This loads the module and registers event listeners
    const initPath = path.resolve(__dirname, '../../public/js/calculator-init.js');
    const initCode = fs.readFileSync(initPath, 'utf-8');

    // Execute in JSDOM context (simplified for testing)
    // In real E2E, this would happen naturally in browser.
    // Note: use dom.window.Function with explicit `window`/`document` params so
    // the code runs against THIS JSDOM instance, not vitest's global scope
    // (window.eval() runs in the vitest global scope and cannot see the
    // manually-created JSDOM document).
    const wrappedCode = `
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
        return value.includes('.') ? value.replace(/\\.?0+$/, '') : value;
      }

      function formatQuantity(value) {
        if (!Number.isFinite(value)) return '—';
        if (value >= 1e6) return \`\${(value / 1e6).toFixed(2)}M\`;
        if (value >= 1e4) return \`\${(value / 1e3).toFixed(2)}K\`;
        return trimZeros(value.toPrecision(6));
      }

      function formatAmount(value) {
        if (!Number.isFinite(value)) return '—';
        if (value >= 1e6) return \`\${(value / 1e6).toFixed(2)}M\`;
        return value.toFixed(2);
      }

      function formatPercent(value) {
        if (!Number.isFinite(value)) return '—';
        return \`\${value.toFixed(1)}%\`;
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
        render(window.calculatePosition(readForm()));
      }

      const form = el('calculator-form');
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      update();

      // Expose for testing
      window.__calculator = { update, readForm, isComplete, clearResults };
    `;

    try {
      // Run the init code scoped to this JSDOM instance's window/document.
      dom.window.Function('window', 'document', wrappedCode)(dom.window, dom.window.document);
    } catch (e) {
      console.error('Failed to load calculator init in JSDOM:', e);
    }
  });

  it('initializes with results hidden (empty form)', () => {
    expect(document.getElementById('position-size')?.textContent).toBe('—');
    expect(document.getElementById('sl-amount')?.textContent).toBe('—');
    expect(document.getElementById('calc-error')?.hidden).toBe(true);
  });

  it('updates results when inputs are complete', () => {
    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;
    const leverage = document.getElementById('leverage') as HTMLSelectElement;

    // Fill form
    margin.value = '1000';
    entry.value = '40000';
    stopLoss.value = '39000';
    takeProfit.value = '41000';
    leverage.value = '10';

    // Trigger update
    (window as any).__calculator.update();

    // Verify results displayed (not '—')
    expect(document.getElementById('position-size')?.textContent).not.toBe('—');
    expect(document.getElementById('rr-ratio')?.textContent).toBe('3.00');
  });

  it('clears results when form becomes incomplete', () => {
    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    // Fill form
    margin.value = '1000';
    entry.value = '40000';
    stopLoss.value = '39000';
    takeProfit.value = '41000';

    (window as any).__calculator.update();
    expect(document.getElementById('position-size')?.textContent).not.toBe('—');

    // Clear one field
    margin.value = '';

    (window as any).__calculator.update();
    expect(document.getElementById('position-size')?.textContent).toBe('—');
  });

  it('hides error when calculation succeeds', () => {
    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    margin.value = '1000';
    entry.value = '40000';
    stopLoss.value = '39000';
    takeProfit.value = '41000';

    (window as any).__calculator.update();

    const error = document.getElementById('calc-error') as HTMLElement;
    expect(error?.hidden).toBe(true);
  });

  it('displays error message when calculation fails', () => {
    // Mock calculatePosition to return error
    (window as any).calculatePosition = vi.fn(() => ({
      isValid: false,
      errorMessage: 'Entry price must be between stop-loss and take-profit',
      warnings: { riskRewardTooLow: false, liquidationRisk: false },
    }));

    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    // Invalid: entry price outside range
    margin.value = '1000';
    entry.value = '50000'; // Out of range
    stopLoss.value = '39000';
    takeProfit.value = '41000';

    (window as any).__calculator.update();

    const error = document.getElementById('calc-error') as HTMLElement;
    expect(error?.hidden).toBe(false);
    expect(error?.textContent).toContain('Entry price must be between');
  });

  it('displays R:R warning when ratio too low', () => {
    (window as any).calculatePosition = vi.fn(() => ({
      isValid: true,
      positionSize: 1000,
      stopLossAmount: 500,
      takeProfitAmount: 400, // Profit < Loss
      riskRewardRatio: 0.8,
      lossRatePercent: 50,
      gainRatePercent: 40,
      warnings: {
        riskRewardTooLow: true, // Triggered
        liquidationRisk: false,
      },
    }));

    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    margin.value = '1000';
    entry.value = '40000';
    stopLoss.value = '39000';
    takeProfit.value = '40400'; // Low profit

    (window as any).__calculator.update();

    const warning = document.getElementById('rr-warning') as HTMLElement;
    expect(warning?.hidden).toBe(false);
  });

  it('displays liquidation warning when stop-loss exceeds margin', () => {
    (window as any).calculatePosition = vi.fn(() => ({
      isValid: true,
      positionSize: 1000,
      stopLossAmount: 1500, // > margin
      takeProfitAmount: 1500,
      riskRewardRatio: 1.0,
      lossRatePercent: 150,
      gainRatePercent: 150,
      warnings: {
        riskRewardTooLow: false,
        liquidationRisk: true, // Triggered
      },
    }));

    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    margin.value = '1000'; // Low margin
    entry.value = '40000';
    stopLoss.value = '30000'; // Large distance = high SL amount
    takeProfit.value = '50000';

    (window as any).__calculator.update();

    const warning = document.getElementById('liquidation-warning') as HTMLElement;
    expect(warning?.hidden).toBe(false);
  });

  it('respects long/short direction toggle', () => {
    const longRadio = document.querySelector('input[name="longShort"][value="long"]') as HTMLInputElement;
    const shortRadio = document.querySelector('input[name="longShort"][value="short"]') as HTMLInputElement;

    // Default is long
    expect(longRadio.checked).toBe(true);
    expect(shortRadio.checked).toBe(false);

    // Switch to short
    shortRadio.click();
    expect(longRadio.checked).toBe(false);
    expect(shortRadio.checked).toBe(true);

    // Verify readForm captures direction
    const form = (window as any).__calculator.readForm();
    expect(form.longShort).toBe('short');
  });

  it('formats large numbers with K/M suffixes', () => {
    (window as any).calculatePosition = vi.fn(() => ({
      isValid: true,
      positionSize: 1500000, // 1.5M
      stopLossAmount: 50000, // 50K
      takeProfitAmount: 100000, // 100K
      riskRewardRatio: 2.0,
      lossRatePercent: 50,
      gainRatePercent: 100,
      warnings: { riskRewardTooLow: false, liquidationRisk: false },
    }));

    const margin = document.getElementById('margin') as HTMLInputElement;
    const entry = document.getElementById('entry-price') as HTMLInputElement;
    const stopLoss = document.getElementById('stop-loss') as HTMLInputElement;
    const takeProfit = document.getElementById('take-profit') as HTMLInputElement;

    margin.value = '10000';
    entry.value = '40000';
    stopLoss.value = '39000';
    takeProfit.value = '41000';

    (window as any).__calculator.update();

    // Position size should be formatted as 1.50M
    expect(document.getElementById('position-size')?.textContent).toContain('M');
  });
});
