import { describe, expect, it } from 'vitest';
import { DIVERGENCE_TYPES, TYPE_LABELS } from './divergence.js';

describe('divergence.js shared constants', () => {
  it('exposes the four supported divergence types (K-line based)', () => {
    expect(DIVERGENCE_TYPES).toEqual([
      'btc_hh_eth_lh',
      'btc_lh_eth_hh',
      'btc_ll_eth_hl',
      'btc_hl_eth_ll',
    ]);
  });

  it('labels every divergence type (mirrors backend src/domains/divergence.ts)', () => {
    expect(Object.keys(TYPE_LABELS).sort()).toEqual([...DIVERGENCE_TYPES].sort());
    for (const type of DIVERGENCE_TYPES) {
      expect(TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('labels match the backend single source of truth (src/domains/divergence.ts)', () => {
    expect(TYPE_LABELS).toEqual({
      btc_hh_eth_lh: 'BTC 創新高 / ETH 反彈不力',
      btc_lh_eth_hh: 'BTC 反彈 / ETH 創新高',
      btc_ll_eth_hl: 'BTC 創新低 / ETH 支撐',
      btc_hl_eth_ll: 'BTC 支撐 / ETH 創新低',
    });
  });
});