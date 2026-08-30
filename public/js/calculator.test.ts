import { describe, expect, it } from 'vitest';
import { calculatePosition, MAX_LEVERAGE, MIN_LEVERAGE } from './calculator.js';

describe('calculator.js position sizing (CALC-01..CALC-04)', () => {
  it('long position: position size, SL $, TP $, R:R, loss %, gain % all correct', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
      leverage: 1,
    });
    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBeCloseTo(0.023809523809523808, 12);
    expect(result.stopLossAmount).toBeCloseTo(23.80952380952381, 9);
    expect(result.takeProfitAmount).toBeCloseTo(23.80952380952381, 9);
    expect(result.riskRewardRatio).toBeCloseTo(1, 9);
    expect(result.lossRatePercent).toBeCloseTo(2.380952380952381, 9);
    expect(result.gainRatePercent).toBeCloseTo(2.380952380952381, 9);
    expect(result.warnings).toEqual({ riskRewardTooLow: false, liquidationRisk: false });
  });

  it('short position: directional logic flips correctly', () => {
    const result = calculatePosition({
      longShort: 'short',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 43000,
      takeProfitPrice: 41000,
      leverage: 1,
    });
    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBeCloseTo(0.023809523809523808, 12);
    expect(result.stopLossAmount).toBeCloseTo(23.80952380952381, 9);
    expect(result.takeProfitAmount).toBeCloseTo(23.80952380952381, 9);
    expect(result.riskRewardRatio).toBeCloseTo(1, 9);
    expect(result.warnings).toEqual({ riskRewardTooLow: false, liquidationRisk: false });
  });

  it('liquidation risk: SL amount exceeding margin triggers warning', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 50,
      entryPrice: 42000,
      stopLoss: 40000,
      takeProfitPrice: 43000,
      leverage: 50,
    });
    expect(result.isValid).toBe(true);
    expect(result.stopLossAmount).toBeCloseTo(119.04761904761904, 9);
    expect(result.stopLossAmount).toBeGreaterThan(50);
    expect(result.warnings.liquidationRisk).toBe(true);
  });

  it('R:R < 1.0 triggers riskRewardTooLow warning', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41500,
      takeProfitPrice: 42400,
      leverage: 1,
    });
    expect(result.isValid).toBe(true);
    expect(result.riskRewardRatio).toBeCloseTo(0.8, 9);
    expect(result.warnings.riskRewardTooLow).toBe(true);
  });

  it('entry price zero → invalid (division-by-zero guard)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 0,
      stopLoss: 41000,
      takeProfitPrice: 43000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
    expect(Number.isFinite(result.positionSize)).toBe(true);
  });

  it('margin zero → invalid', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 0,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('leverage boundaries 1x and 125x both calculate correctly', () => {
    const base = {
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
    };
    const min = calculatePosition({ ...base, leverage: MIN_LEVERAGE });
    const max = calculatePosition({ ...base, leverage: MAX_LEVERAGE });
    expect(min.isValid).toBe(true);
    expect(min.positionSize).toBeCloseTo(0.023809523809523808, 12);
    expect(max.isValid).toBe(true);
    expect(max.positionSize).toBeCloseTo(2.976190476190476, 9);
  });

  it('long with SL above entry → invalid (wrong side)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 43000,
      takeProfitPrice: 44000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('short with SL below entry → invalid (wrong side)', () => {
    const result = calculatePosition({
      longShort: 'short',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 40000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });
});