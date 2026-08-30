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

  if (!isValidInput({ longShort, margin, entryPrice, stopLoss, takeProfitPrice, leverage })) {
    return base;
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

function isValidInput({ longShort, margin, entryPrice, stopLoss, takeProfitPrice, leverage }) {
  if (!Number.isFinite(margin) || margin <= 0) return false;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return false;
  if (!Number.isFinite(leverage) || leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) return false;
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) return false;
  if (!Number.isFinite(takeProfitPrice) || takeProfitPrice <= 0) return false;
  if (longShort === 'short') {
    if (stopLoss <= entryPrice) return false;
    if (takeProfitPrice >= entryPrice) return false;
  } else {
    if (stopLoss >= entryPrice) return false;
    if (takeProfitPrice <= entryPrice) return false;
  }
  return true;
}