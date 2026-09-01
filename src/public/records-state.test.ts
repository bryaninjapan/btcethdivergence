/**
 * Records state manager tests — verify isolation and CRUD operations
 */

import { describe, it, expect } from 'vitest';
import { createRecordsManager } from '../../public/js/records-state';

// tsconfig lib is [ES2022, WebWorker] (no DOM); access the jsdom globals
// via globalThis and treat DOM nodes as any.
const window = globalThis as unknown as { [key: string]: any };

describe('createRecordsManager factory', () => {
  it('should create isolated state instances', () => {
    const manager1 = createRecordsManager();
    const manager2 = createRecordsManager();

    manager1.setRecords([{ id: 1 }]);
    manager2.setRecords([{ id: 2 }]);

    expect(manager1.getRecords()).toEqual([{ id: 1 }]);
    expect(manager2.getRecords()).toEqual([{ id: 2 }]);
  });

  it('should manage records cache', () => {
    const manager = createRecordsManager();
    const records = [
      { id: 1, type: 'btc_hh_eth_lh', notes: 'test' },
      { id: 2, type: 'btc_lh_eth_hh', notes: 'another' },
    ];

    manager.setRecords(records);

    const cached = manager.getRecords();
    expect(cached).toEqual(records);
    expect(cached).not.toBe(records); // New array reference
  });

  it('should manage editing state', () => {
    const manager = createRecordsManager();

    expect(manager.getEditingId()).toBeNull();

    manager.startEditing(42);
    expect(manager.getEditingId()).toBe(42);

    manager.stopEditing();
    expect(manager.getEditingId()).toBeNull();
  });

  it('should manage delete confirmation state', () => {
    const manager = createRecordsManager();

    expect(manager.getDeleteId()).toBeNull();

    manager.startDelete(99);
    expect(manager.getDeleteId()).toBe(99);

    manager.clearDelete();
    expect(manager.getDeleteId()).toBeNull();
  });

  it('should manage request tokens for deduplication', () => {
    const manager = createRecordsManager();

    expect(manager.getLatestRequestToken()).toBe(0);

    const token1 = manager.nextRequestToken();
    expect(token1).toBe(1);

    const token2 = manager.nextRequestToken();
    expect(token2).toBe(2);

    expect(manager.getLatestRequestToken()).toBe(2);
  });

  it('should support method chaining', () => {
    const manager = createRecordsManager();
    const records = [{ id: 1 }];

    const result = manager
      .setRecords(records)
      .startEditing(1)
      .nextRequestToken();

    expect(manager.getEditingId()).toBe(1);
    expect(manager.getLatestRequestToken()).toBe(1);
  });

  it('should throw on unknown state key', () => {
    const manager = createRecordsManager();

    expect(() => manager.get('unknownKey')).toThrow('Unknown state key');
    expect(() => manager.set('unknownKey', 123)).toThrow('Unknown state key');
  });

  it('should return frozen state snapshot', () => {
    const manager = createRecordsManager();
    manager.setRecords([{ id: 1 }]);

    const snapshot = manager.getState();

    expect(snapshot.recordsCache).toHaveLength(1);
    expect(() => {
      // @ts-expect-error Testing that frozen state is immutable
      snapshot.recordsCache = [];
    }).toThrow();
  });

  it('should not pollute global window object', () => {
    const keysBefore = Object.keys(window);

    createRecordsManager();

    const keysAfter = Object.keys(window);
    expect(keysBefore.length).toBe(keysAfter.length);
  });
});
