export const MAX_LEVERAGE = 125;
export const MIN_LEVERAGE = 1;

export function calculatePosition(params = {}) {
  const longShort = normalizeDirection(params.longShort);
  const margin = Number(params.margin);
  const entryPrice = Number(params.entryPrice);
  const stopLoss = Number(params.stopLoss);
  const takeProfitPrice = Number(params.takeProfitPrice);
  const leverage = Number(params.leverage);

  const base = {
    isValid: false,
    errorMessage: '',
    longShort,
    margin,
    entryPrice,
    stopLoss,
    takeProfitPrice,
    leverage,
    positionSize: 0,
    stopLossAmount: 0,
    takeProfitAmount: 0,
    riskRewardRatio: 0,
    lossRatePercent: 0,
    gainRatePercent: 0,
    warnings: { riskRewardTooLow: false, liquidationRisk: false },
  };

  const errorMessage = validateInput({ longShort, margin, entryPrice, stopLoss, takeProfitPrice, leverage });
  if (errorMessage) {
    return { ...base, errorMessage };
  }

  const positionSize = (margin * leverage) / entryPrice;
  let lossAmount;
  let profitAmount;
  if (longShort === 'short') {
    lossAmount = positionSize * (stopLoss - entryPrice);
    profitAmount = positionSize * (entryPrice - takeProfitPrice);
  } else {
    lossAmount = positionSize * (entryPrice - stopLoss);
    profitAmount = positionSize * (takeProfitPrice - entryPrice);
  }

  const riskRewardRatio = profitAmount / lossAmount;
  const lossRatePercent = (lossAmount / margin) * 100;
  const gainRatePercent = (profitAmount / margin) * 100;

  return {
    ...base,
    isValid: true,
    positionSize,
    stopLossAmount: lossAmount,
    takeProfitAmount: profitAmount,
    riskRewardRatio,
    lossRatePercent,
    gainRatePercent,
    warnings: {
      riskRewardTooLow: riskRewardRatio < 1.0,
      liquidationRisk: lossAmount > margin,
    },
  };
}

function normalizeDirection(value) {
  if (value === 'short' || value === 'Short' || value === 'SHORT' || value === false) return 'short';
  return 'long';
}

function validateInput({ longShort, margin, entryPrice, stopLoss, takeProfitPrice, leverage }) {
  if (!Number.isFinite(margin) || margin <= 0) return '保證金必須大於 0';
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return '入場價必須大於 0';
  if (!Number.isFinite(leverage) || leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) {
    return `槓桿必須介於 ${MIN_LEVERAGE}x 到 ${MAX_LEVERAGE}x`;
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) return '止損價必須大於 0';
  if (!Number.isFinite(takeProfitPrice) || takeProfitPrice <= 0) return '止盈價必須大於 0';
  if (longShort === 'short') {
    if (stopLoss <= entryPrice) return '做空時止損價必須高於入場價';
    if (takeProfitPrice >= entryPrice) return '做空時止盈價必須低於入場價';
  } else {
    if (stopLoss >= entryPrice) return '做多時止損價必須低於入場價';
    if (takeProfitPrice <= entryPrice) return '做多時止盈價必須高於入場價';
  }
  return '';
}