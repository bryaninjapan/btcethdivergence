// Shared calculator validation constants (mirrors src/domains/calculator-rules.ts)
// Plain-JS mirror so the no-build frontend can reference the same field lists,
// leverage bounds, and error strings as the backend Zod schemas. Sync is
// enforced by the parity test in src/domains/calculator-rules.test.ts.
export const MAX_LEVERAGE = 125;
export const MIN_LEVERAGE = 1;

export const INPUT_FIELDS = [
  'margin',
  'entryPrice',
  'stopLoss',
  'takeProfitPrice',
  'leverage',
  'longShort',
];

export const OUTPUT_FIELDS = [
  'positionSize',
  'stopLossAmount',
  'takeProfitAmount',
  'riskRewardRatio',
  'lossRatePercent',
  'gainRatePercent',
  'isValid',
  'errorMessage',
];

export const WARNING_FIELDS = ['riskRewardTooLow', 'liquidationRisk'];

export const ERROR_MESSAGES = {
  marginPositive: '保證金必須大於 0',
  entryPricePositive: '入場價必須大於 0',
  stopLossPositive: '止損價必須大於 0',
  takeProfitPositive: '止盈價必須大於 0',
  leverageRange: `槓桿必須介於 ${MIN_LEVERAGE}x 到 ${MAX_LEVERAGE}x`,
  longStopLossBelowEntry: '做多時止損價必須低於入場價',
  longTakeProfitAboveEntry: '做多時止盈價必須高於入場價',
  shortStopLossAboveEntry: '做空時止損價必須高於入場價',
  shortTakeProfitBelowEntry: '做空時止盈價必須低於入場價',
};