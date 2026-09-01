// Shared divergence type definitions for both backend and frontend
// Based on K-line high/low combinations between BTC and ETH
//
// Each type describes a relative-strength reading from comparing the latest
// BTC structure with the latest ETH structure at the same candle boundary:
//   - btc_hh_eth_lh: BTC makes a Higher-High while ETH only makes a
//     Lower-High → ETH is weak (fails to confirm) → BTC-led rally, ETH lagging.
//   - btc_lh_eth_hh: BTC only makes a Lower-High while ETH makes a
//     Higher-High → ETH is strong (outperforms BTC) → ETH-led strength.
//   - btc_ll_eth_hl: BTC makes a Lower-Low while ETH holds a Higher-Low
//     → ETH is strong (relative support) → ETH resilient on BTC downside.
//   - btc_hl_eth_ll: BTC holds a Higher-Low while ETH makes a Lower-Low
//     → ETH is weak (breaks first) → BTC strong relative to ETH.
export const DIVERGENCE_TYPES = [
  'btc_hh_eth_lh',    // BTC HH (High-High) + ETH LH (Low-High) — ETH weak, BTC strong
  'btc_lh_eth_hh',    // BTC LH (Low-High) + ETH HH (High-High) — ETH strong, BTC weak
  'btc_ll_eth_hl',    // BTC LL (Low-Low) + ETH HL (High-Low) — ETH strong, BTC weak
  'btc_hl_eth_ll'     // BTC HL (High-Low) + ETH LL (Low-Low) — ETH weak, BTC strong
] as const;

export const TYPE_LABELS = {
  btc_hh_eth_lh: 'BTC 創新高 / ETH 反彈不力',
  btc_lh_eth_hh: 'BTC 反彈 / ETH 創新高',
  btc_ll_eth_hl: 'BTC 創新低 / ETH 支撐',
  btc_hl_eth_ll: 'BTC 支撐 / ETH 創新低'
} as const;

// Major Structure Break indicator: whether a significant market-structure
// level (a prior swing high/low) was broken during the observed divergence.
export const MSB_LABELS = {
  yes: '有重要結構破裂',
  no: '無重要結構破裂'
} as const;

export type DivergenceType = (typeof DIVERGENCE_TYPES)[number];
export type MSBStatus = 'yes' | 'no';
