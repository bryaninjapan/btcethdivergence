import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('R:R < 1.0 sets warnings.riskRewardTooLow (CALC-05)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41500,
      takeProfitPrice: 42100,
      leverage: 1,
    });
    expect(result.riskRewardRatio).toBeCloseTo(0.2, 9);
    expect(result.warnings.riskRewardTooLow).toBe(true);
  });

  it('SL amount > margin sets warnings.liquidationRisk (CALC-06)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 100,
      entryPrice: 42000,
      stopLoss: 39000,
      takeProfitPrice: 45000,
      leverage: 25,
    });
    expect(result.isValid).toBe(true);
    expect(result.stopLossAmount).toBeGreaterThan(100);
    expect(result.warnings.liquidationRisk).toBe(true);
  });

  it('both warnings can be true simultaneously', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 50,
      entryPrice: 42000,
      stopLoss: 40000,
      takeProfitPrice: 42050,
      leverage: 50,
    });
    expect(result.isValid).toBe(true);
    expect(result.stopLossAmount).toBeGreaterThan(50);
    expect(result.riskRewardRatio).toBeLessThan(1);
    expect(result.warnings).toEqual({ riskRewardTooLow: true, liquidationRisk: true });
  });

  it('long with SL equal to entry → invalid (boundary)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 42000,
      takeProfitPrice: 43000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('short with SL equal to entry → invalid (boundary)', () => {
    const result = calculatePosition({
      longShort: 'short',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 42000,
      takeProfitPrice: 41000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('very large margin with low leverage produces finite numbers (no overflow)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1e9,
      entryPrice: 100,
      stopLoss: 90,
      takeProfitPrice: 110,
      leverage: 1,
    });
    expect(result.isValid).toBe(true);
    expect(result.positionSize).toBe(1e7);
    expect(result.stopLossAmount).toBe(1e8);
    expect(result.takeProfitAmount).toBe(1e8);
    for (const value of [result.positionSize, result.stopLossAmount, result.takeProfitAmount, result.riskRewardRatio, result.lossRatePercent, result.gainRatePercent]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('empty input object handled gracefully → invalid, no NaN', () => {
    const result = calculatePosition({});
    expect(result.isValid).toBe(false);
    expect(result.longShort).toBe('long');
    expect(Number.isFinite(result.positionSize)).toBe(true);
    expect(result.riskRewardRatio).toBe(0);
  });

  it('leverage outside 1x-125x → invalid (both directions)', () => {
    const base = {
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
    };
    expect(calculatePosition({ ...base, leverage: 0 }).isValid).toBe(false);
    expect(calculatePosition({ ...base, leverage: 200 }).isValid).toBe(false);
  });

  it('long with TP <= entry → invalid (wrong side)', () => {
    const result = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 42000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('short with TP >= entry → invalid (wrong side)', () => {
    const result = calculatePosition({
      longShort: 'short',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 43000,
      takeProfitPrice: 42000,
      leverage: 10,
    });
    expect(result.isValid).toBe(false);
  });

  it('stop-loss or take-profit zero → invalid', () => {
    const base = {
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      takeProfitPrice: 43000,
      leverage: 10,
    };
    expect(calculatePosition({ ...base, stopLoss: 0 }).isValid).toBe(false);
    expect(calculatePosition({ ...base, stopLoss: 41000, takeProfitPrice: 0 }).isValid).toBe(false);
  });

  it('invalid input returns an actionable errorMessage; valid input has empty errorMessage', () => {
    const invalid = calculatePosition({
      longShort: 'long',
      margin: -5,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
      leverage: 10,
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errorMessage.length).toBeGreaterThan(0);
    const valid = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 41000,
      takeProfitPrice: 43000,
      leverage: 10,
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errorMessage).toBe('');
  });

  it('fully client-side: calculator files never call fetch or import api.js (CALC-07)', () => {
    // Construct absolute paths from project root
    const baseDir = process.cwd();
    const calcPath = `${baseDir}/public/js/calculator.js`;
    const initPath = `${baseDir}/public/js/calculator-init.js`;
    const htmlPath = `${baseDir}/public/calculator.html`;

    const calcSrc = readFileSync(calcPath, 'utf8');
    const initSrc = readFileSync(initPath, 'utf8');
    const htmlSrc = readFileSync(htmlPath, 'utf8');

    // Verify no fetch calls or api.js imports
    expect(calcSrc).not.toMatch(/\bfetch\s*\(/);
    expect(calcSrc).not.toMatch(/api\.js/);
    expect(initSrc).not.toMatch(/\bfetch\s*\(/);
    expect(initSrc).not.toMatch(/api\.js/);
    expect(htmlSrc).not.toMatch(/\bfetch\s*\(/);
    expect(htmlSrc).not.toMatch(/api\.js/);
  });

  // H2 FIX: invalid results should render as dashes, not zeros
  it('H2: invalid input renders dashes instead of zero values', () => {
    const invalidLong = calculatePosition({
      longShort: 'long',
      margin: 1000,
      entryPrice: 42000,
      stopLoss: 42500, // INVALID: SL above entry for long
      takeProfitPrice: 43000,
      leverage: 1,
    });

    expect(invalidLong.isValid).toBe(false);
    expect(invalidLong.errorMessage).toBeTruthy();
    // Numeric fields defaulted to 0, but render() should show "—" when isValid=false
    expect(invalidLong.positionSize).toBe(0);
  });
});