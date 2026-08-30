import { describe, expect, it } from 'vitest';
import { createRangeSync } from './chart-sync.js';

class FakeTimeScale {
  constructor() {
    this.handlers = [];
    this.range = null;
    this.applyCount = 0;
  }
  subscribeVisibleLogicalRangeChange(fn) {
    this.handlers.push(fn);
    // Real LWC returns void, not an unsubscribe function
    return undefined;
  }
  unsubscribeVisibleLogicalRangeChange(fn) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  setVisibleLogicalRange(range) {
    this.applyCount += 1;
    this.range = range;
    for (const h of [...this.handlers]) h(range); // LWC notifies synchronously
  }
  fire(range) {
    for (const h of [...this.handlers]) h(range);
  }
  getVisibleLogicalRange() {
    return this.range;
  }
}

class ThrowingTimeScale extends FakeTimeScale {
  setVisibleLogicalRange() {
    throw new Error('boom');
  }
}

describe('chart-sync.js logical-range sync (CHART-08)', () => {
  it('forwarding: a range fired on the source is applied verbatim to the target', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    a.fire({ from: 5, to: 45 });
    expect(b.applyCount).toBe(1);
    expect(b.range).toEqual({ from: 5, to: 45 });
    expect(sync.isSyncing()).toBe(false);
  });

  it('re-entrancy: bidirectional wiring applies once per event, no loop, symmetric', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    sync.link(b, a);
    a.fire({ from: 5, to: 45 });
    expect(b.applyCount).toBe(1);
    expect(a.applyCount).toBe(0);
    b.fire({ from: 10, to: 50 });
    expect(a.applyCount).toBe(1);
    expect(b.applyCount).toBe(1);
    expect(sync.isSyncing()).toBe(false);
  });

  it('rapid-fire: each event applied exactly once, last wins, no crash', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    sync.link(b, a);
    a.fire({ from: 0, to: 10 });
    a.fire({ from: 1, to: 11 });
    a.fire({ from: 2, to: 12 });
    expect(b.applyCount).toBe(3);
    expect(b.range).toEqual({ from: 2, to: 12 });
    expect(sync.isSyncing()).toBe(false);
  });

  it('null range is ignored', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    a.fire(null);
    expect(b.applyCount).toBe(0);
  });

  it('non-finite ranges (data-boundary edges) are ignored', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    a.fire({ from: -Infinity, to: 50 });
    a.fire({ from: NaN, to: 10 });
    expect(b.applyCount).toBe(0);
  });

  it('gap tolerance: logical ranges forward verbatim across unequal datasets', () => {
    // A has 200 bars, B has 150 bars (a 50-bar gap) — bar indices still map directly.
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    sync.link(a, b);
    a.fire({ from: 100, to: 149 });
    expect(b.range).toEqual({ from: 100, to: 149 });
    expect(sync.isSyncing()).toBe(false);
  });

  it('unsubscribe: the returned function detaches the handler', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();
    const unsub = sync.link(a, b);
    expect(typeof unsub).toBe('function');
    unsub();
    a.fire({ from: 1, to: 2 });
    expect(b.applyCount).toBe(0);
  });

  it('exception-safety: guard resets even when apply throws, later applies still work', () => {
    const sync = createRangeSync();
    const a = new ThrowingTimeScale();
    const b = new FakeTimeScale();
    sync.link(b, a); // firing b forwards into the throwing target
    expect(() => b.fire({ from: 1, to: 2 })).toThrow();
    expect(sync.isSyncing()).toBe(false);
    sync.link(a, b);
    a.fire({ from: 5, to: 45 });
    expect(b.applyCount).toBe(1);
    expect(b.range).toEqual({ from: 5, to: 45 });
    expect(sync.isSyncing()).toBe(false);
  });

  it('handler cleanup: unsubscribe prevents future notifications', () => {
    const sync = createRangeSync();
    const a = new FakeTimeScale();
    const b = new FakeTimeScale();

    // Link and fire once
    const unsub = sync.link(a, b);
    a.fire({ from: 1, to: 10 });
    expect(b.applyCount).toBe(1);
    expect(a.handlers.length).toBe(1);

    // Unsubscribe
    unsub();
    expect(a.handlers.length).toBe(0);

    // Fire again - should not apply
    a.fire({ from: 2, to: 20 });
    expect(b.applyCount).toBe(1); // Still 1, not 2
  });
});