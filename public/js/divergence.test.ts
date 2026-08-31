import { describe, expect, it } from 'vitest';
import { DIVERGENCE_TYPES, TYPE_LABELS } from './divergence.js';

describe('divergence.js shared constants', () => {
  it('exposes the three supported divergence types', () => {
    expect(DIVERGENCE_TYPES).toEqual(['time_lag', 'structural', 'opposite']);
  });

  it('labels every divergence type (mirrors backend src/domains/divergence.ts)', () => {
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...DIVERGENCE_TYPES].sort());
    for (const type of DIVERGENCE_TYPES) {
      expect(TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('labels match the backend single source of truth (src/domains/divergence.ts)', () => {
    expect(TYPE_LABELS).toEqual({
      time_lag: '時間差',
      structural: '結構背離',
      opposite: '完全反向',
    });
  });
});