import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { detectCurrentPage, markActivePage } from './nav';

describe('detectCurrentPage', () => {
  it('detects records page at root', () => {
    expect(detectCurrentPage('/')).toBe('records');
  });

  it('detects records page at index.html', () => {
    expect(detectCurrentPage('/index.html')).toBe('records');
  });

  it('detects records page at empty pathname', () => {
    expect(detectCurrentPage('')).toBe('records');
  });

  it('detects charts page with .html extension', () => {
    expect(detectCurrentPage('/charts.html')).toBe('charts');
  });

  it('detects charts page without .html extension', () => {
    expect(detectCurrentPage('/charts')).toBe('charts');
  });

  it('detects calculator page with .html extension', () => {
    expect(detectCurrentPage('/calculator.html')).toBe('calculator');
  });

  it('detects calculator page without .html extension', () => {
    expect(detectCurrentPage('/calculator')).toBe('calculator');
  });

  it('returns null for unknown pages', () => {
    expect(detectCurrentPage('/unknown.html')).toBeNull();
  });

  it('handles trailing slashes', () => {
    expect(detectCurrentPage('/charts/')).toBe('charts');
    expect(detectCurrentPage('/calculator/')).toBe('calculator');
  });
});

describe('markActivePage', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a minimal DOM structure for testing
    container = document.createElement('div');
    container.innerHTML = `
      <nav class="top-nav">
        <div class="nav-links">
          <a href="/" class="nav-link" data-page="records">記錄表</a>
          <a href="/charts.html" class="nav-link" data-page="charts">K線圖</a>
          <a href="/calculator.html" class="nav-link" data-page="calculator">槓桿計算</a>
        </div>
      </nav>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('marks the records page as active', () => {
    markActivePage('records');
    const recordsLink = document.querySelector('[data-page="records"]');
    expect(recordsLink?.classList.contains('active')).toBe(true);
  });

  it('marks the charts page as active', () => {
    markActivePage('charts');
    const chartsLink = document.querySelector('[data-page="charts"]');
    expect(chartsLink?.classList.contains('active')).toBe(true);
  });

  it('marks the calculator page as active', () => {
    markActivePage('calculator');
    const calcLink = document.querySelector('[data-page="calculator"]');
    expect(calcLink?.classList.contains('active')).toBe(true);
  });

  it('removes active class from other links', () => {
    markActivePage('records');
    const chartsLink = document.querySelector('[data-page="charts"]');
    const calcLink = document.querySelector('[data-page="calculator"]');
    expect(chartsLink?.classList.contains('active')).toBe(false);
    expect(calcLink?.classList.contains('active')).toBe(false);
  });

  it('handles null page gracefully', () => {
    expect(() => markActivePage(null)).not.toThrow();
    // No link should be active
    const activeLinks = document.querySelectorAll('[data-page].active');
    expect(activeLinks.length).toBe(0);
  });
});
