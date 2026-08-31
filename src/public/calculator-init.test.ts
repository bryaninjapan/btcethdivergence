import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * DOM wiring tests for the REAL public/js/calculator-init.js.
 *
 * The real module reads `document` at import time and wires the
 * #calculator-form listeners, so we inject the calculator page's <body>
 * into vitest's jsdom global document, then dynamic-import the module.
 * This exercises the actual production file (rather than an inlined copy)
 * end to end: form binding, real-time updates, validation, and warnings.
 */

describe('Calculator UI — calculator-init.js DOM wiring (real file)', () => {
  // tsconfig lib is [ES2022, WebWorker] (no DOM); access the jsdom globals
  // via globalThis and treat DOM nodes as any.
  const document = (globalThis as unknown as { document: any }).document;
  let form: any;

  function el(id: string): any {
    const node = document.getElementById(id);
    if (!node) throw new Error(`missing #${id} in injected calculator page`);
    return node;
  }

  function fill(entries: Record<string, string>): void {
    for (const [id, value] of Object.entries(entries)) {
      const input = el(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  beforeAll(async () => {
    const htmlPath = path.resolve(__dirname, '../../public/calculator.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
    if (!bodyMatch) throw new Error('calculator.html has no <body>');
    document.body.innerHTML = bodyMatch[1];

    // calculator-init.js is plain JS (no declarations, allowJs off).
    // @ts-expect-error — untyped side-effect module imported for its wiring
    await import('../../public/js/calculator-init.js');

    form = document.getElementById('calculator-form') as any;
  });

  it('initializes with results hidden (empty form)', () => {
    expect(el('position-size').textContent).toBe('—');
    expect(el('sl-amount').textContent).toBe('—');
    expect(el('rr-ratio').textContent).toBe('—');
    expect((el('calc-error') as any).hidden).toBe(true);
  });

  it('updates results in real time for a valid long position', () => {
    fill({
      margin: '1000',
      'entry-price': '40000',
      'stop-loss': '39000',
      'take-profit': '41000',
      leverage: '10',
    });

    expect(el('position-size').textContent).not.toBe('—');
    expect(el('rr-ratio').textContent).toBe('1.00');
    expect((el('calc-error') as any).hidden).toBe(true);
  });

  it('clears results when the form becomes incomplete', () => {
    fill({
      margin: '1000',
      'entry-price': '40000',
      'stop-loss': '39000',
      'take-profit': '41000',
    });
    expect(el('position-size').textContent).not.toBe('—');

    fill({ margin: '' });
    expect(el('position-size').textContent).toBe('—');
  });

  it('displays an error when the entry price is outside the SL/TP range', () => {
    fill({
      margin: '1000',
      'entry-price': '50000',
      'stop-loss': '39000',
      'take-profit': '41000',
    });

    const error = el('calc-error') as any;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/止盈價|止損價|入場價/);
  });

  it('shows the R:R warning when risk/reward is below 1:1', () => {
    fill({
      margin: '1000',
      'entry-price': '40000',
      'stop-loss': '38000',
      'take-profit': '40100',
      leverage: '10',
    });

    const warning = el('rr-warning') as any;
    expect(warning.hidden).toBe(false);
  });

  it('shows the liquidation warning when stop-loss amount exceeds margin', () => {
    fill({
      margin: '100',
      'entry-price': '40000',
      'stop-loss': '30000',
      'take-profit': '50000',
      leverage: '10',
    });

    const warning = el('liquidation-warning') as any;
    expect(warning.hidden).toBe(false);
  });

  it('respects the short direction toggle', () => {
    const shortRadio = document.querySelector(
      'input[name="longShort"][value="short"]',
    ) as any;
    shortRadio.checked = true;
    shortRadio.dispatchEvent(new Event('change', { bubbles: true }));

    fill({
      margin: '1000',
      'entry-price': '40000',
      'stop-loss': '41000',
      'take-profit': '39000',
    });

    expect(el('position-size').textContent).not.toBe('—');
    expect((el('calc-error') as any).hidden).toBe(true);
  });
});