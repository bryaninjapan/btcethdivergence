// Shared divergence type definitions (mirrors backend/src/domains/divergence.ts)
// Based on K-line high/low combinations between BTC and ETH
export const DIVERGENCE_TYPES = [
  'btc_hh_eth_lh',    // BTC HH (High-High) + ETH LH (Low-High)
  'btc_lh_eth_hh',    // BTC LH (Low-High) + ETH HH (High-High)
  'btc_ll_eth_hl',    // BTC LL (Low-Low) + ETH HL (High-Low)
  'btc_hl_eth_ll'     // BTC HL (High-Low) + ETH LL (Low-Low)
];

export const TYPE_LABELS = {
  btc_hh_eth_lh: 'BTC 創新高 / ETH 反彈不力',
  btc_lh_eth_hh: 'BTC 反彈 / ETH 創新高',
  btc_ll_eth_hl: 'BTC 創新低 / ETH 支撐',
  btc_hl_eth_ll: 'BTC 支撐 / ETH 創新低'
};

// Major Structure Break indicator
export const MSB_LABELS = {
  yes: '有重要結構破裂',
  no: '無重要結構破裂'
};
