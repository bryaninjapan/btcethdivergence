import { describe, expect, it } from 'vitest';
import {
  CalculatorInputs,
  CalculatorOutputs,
  ERROR_MESSAGES,
  INPUT_FIELDS,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
  OUTPUT_FIELDS,
  WARNING_FIELDS,
} from './calculator-rules';
import {
  ERROR_MESSAGES as mirrorErrors,
  INPUT_FIELDS as mirrorInputs,
  MAX_LEVERAGE as mirrorMax,
  MIN_LEVERAGE as mirrorMin,
  OUTPUT_FIELDS as mirrorOutputs,
  WARNING_FIELDS as mirrorWarnings,
} from '../../public/js/calculator-rules';
import {
  MAX_LEVERAGE as frozenMax,
  MIN_LEVERAGE as frozenMin,
} from '../../public/js/calculator';

const validLong = {
  longShort: 'long',
  margin: 1000,
  entryPrice: 42000,
  stopLoss: 41000,
  takeProfitPrice: 43000,
  leverage: 10,
};

const validShort = {
  longShort: 'short',
  margin: 1000,
  entryPrice: 42000,
  stopLoss: 43000,
  takeProfitPrice: 41000,
  leverage: 10,
};

const validOutput = {
  isValid: true,
  errorMessage: '',
  positionSize: 0.238095238,
  stopLossAmount: 23.8095238,
  takeProfitAmount: 23.8095238,
  riskRewardRatio: 1,
  lossRatePercent: 2.38095238,
  gainRatePercent: 2.38095238,
  warnings: { riskRewardTooLow: false, liquidationRisk: false },
};

function messageFor(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }, path: string): string | undefined {
  return result.success ? undefined : result.error!.issues.find((i) => i.path.join('.') === path)?.message;
}

describe('CalculatorInputs — field validation', () => {
  it('accepts a valid long position (6 fields)', () => {
    const result = CalculatorInputs.safeParse(validLong);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('long');
  });

  it('accepts a valid short position', () => {
    const result = CalculatorInputs.safeParse(validShort);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('short');
  });

  it('rejects margin of zero with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, margin: 0 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'margin')).toBe(ERROR_MESSAGES.marginPositive);
  });

  it('rejects negative margin', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, margin: -5 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'margin')).toBe(ERROR_MESSAGES.marginPositive);
  });

  it('rejects non-finite margin (NaN / Infinity)', () => {
    expect(CalculatorInputs.safeParse({ ...validLong, margin: NaN }).success).toBe(false);
    expect(CalculatorInputs.safeParse({ ...validLong, margin: Infinity }).success).toBe(false);
  });

  it('rejects entryPrice of zero with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, entryPrice: 0 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'entryPrice')).toBe(ERROR_MESSAGES.entryPricePositive);
  });

  it('rejects stopLoss of zero with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, stopLoss: 0 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'stopLoss')).toBe(ERROR_MESSAGES.stopLossPositive);
  });

  it('rejects takeProfitPrice of zero with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, takeProfitPrice: 0 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'takeProfitPrice')).toBe(ERROR_MESSAGES.takeProfitPositive);
  });
});

describe('CalculatorInputs — leverage bounds (1–125)', () => {
  it('accepts leverage boundaries of 1 and 125', () => {
    expect(CalculatorInputs.safeParse({ ...validLong, leverage: MIN_LEVERAGE }).success).toBe(true);
    expect(CalculatorInputs.safeParse({ ...validLong, leverage: MAX_LEVERAGE }).success).toBe(true);
  });

  it('rejects leverage below the minimum with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, leverage: 0 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'leverage')).toBe(ERROR_MESSAGES.leverageRange);
  });

  it('rejects leverage above the maximum with the frozen client error string', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, leverage: 126 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'leverage')).toBe(ERROR_MESSAGES.leverageRange);
  });

  it('accepts fractional leverage (frozen client only bounds-checks, no integer rule)', () => {
    expect(CalculatorInputs.safeParse({ ...validLong, leverage: 1.5 }).success).toBe(true);
    expect(CalculatorInputs.safeParse({ ...validLong, leverage: 100.5 }).success).toBe(true);
  });
});

describe('CalculatorInputs — direction-dependent SL/TP rules', () => {
  it('long: rejects stopLoss at or above entry', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, stopLoss: 42000 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'stopLoss')).toBe(ERROR_MESSAGES.longStopLossBelowEntry);
  });

  it('long: rejects takeProfit at or below entry', () => {
    const result = CalculatorInputs.safeParse({ ...validLong, takeProfitPrice: 42000 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'takeProfitPrice')).toBe(ERROR_MESSAGES.longTakeProfitAboveEntry);
  });

  it('short: rejects stopLoss at or below entry', () => {
    const result = CalculatorInputs.safeParse({ ...validShort, stopLoss: 42000 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'stopLoss')).toBe(ERROR_MESSAGES.shortStopLossAboveEntry);
  });

  it('short: rejects takeProfit at or above entry', () => {
    const result = CalculatorInputs.safeParse({ ...validShort, takeProfitPrice: 42000 });
    expect(result.success).toBe(false);
    expect(messageFor(result, 'takeProfitPrice')).toBe(ERROR_MESSAGES.shortTakeProfitBelowEntry);
  });

  it('reports both direction issues simultaneously', () => {
    const result = CalculatorInputs.safeParse({
      ...validLong,
      stopLoss: 43000,
      takeProfitPrice: 41000,
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain(ERROR_MESSAGES.longStopLossBelowEntry);
    expect(messages).toContain(ERROR_MESSAGES.longTakeProfitAboveEntry);
  });
});

describe('CalculatorInputs — longShort normalization (matches normalizeDirection)', () => {
  it.each(['long', 'LONG', 'Long', 'bogus', ''])('normalizes %p to long', (value) => {
    const result = CalculatorInputs.safeParse({ ...validLong, longShort: value });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('long');
  });

  it.each(['short', 'Short', 'SHORT'])('normalizes %p to short', (value) => {
    const result = CalculatorInputs.safeParse({ ...validShort, longShort: value });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('short');
  });

  it("mixed-case 'sHoRt' normalizes to long (exact match only, mirrors frozen client)", () => {
    const result = CalculatorInputs.safeParse({ ...validLong, longShort: 'sHoRt' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('long');
  });

  it('defaults a missing longShort to long', () => {
    const { longShort: _omit, ...rest } = validLong;
    const result = CalculatorInputs.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.longShort).toBe('long');
  });

  it('rejects non-string longShort values', () => {
    expect(CalculatorInputs.safeParse({ ...validLong, longShort: null }).success).toBe(false);
    expect(CalculatorInputs.safeParse({ ...validLong, longShort: 5 }).success).toBe(false);
  });
});

describe('CalculatorOutputs — output shape', () => {
  it('accepts a complete valid output object', () => {
    const result = CalculatorOutputs.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('accepts the invalid-output shape (zeros, error message, no warnings)', () => {
    const result = CalculatorOutputs.safeParse({
      isValid: false,
      errorMessage: '保證金必須大於 0',
      positionSize: 0,
      stopLossAmount: 0,
      takeProfitAmount: 0,
      riskRewardRatio: 0,
      lossRatePercent: 0,
      gainRatePercent: 0,
      warnings: { riskRewardTooLow: false, liquidationRisk: false },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a warnings subobject missing liquidationRisk', () => {
    const bad = { ...validOutput, warnings: { riskRewardTooLow: true } };
    expect(CalculatorOutputs.safeParse(bad).success).toBe(false);
  });

  it('rejects non-boolean isValid', () => {
    expect(CalculatorOutputs.safeParse({ ...validOutput, isValid: 'yes' }).success).toBe(false);
  });

  it('rejects negative computed amounts', () => {
    expect(CalculatorOutputs.safeParse({ ...validOutput, positionSize: -1 }).success).toBe(false);
  });

  it('enumerates exactly the 9 documented output fields plus warnings', () => {
    expect(OUTPUT_FIELDS).toHaveLength(8);
    for (const field of OUTPUT_FIELDS) {
      expect(field in validOutput).toBe(true);
    }
    expect(WARNING_FIELDS).toEqual(['riskRewardTooLow', 'liquidationRisk']);
  });
});

describe('frontend mirror parity (calculator-rules.ts ↔ calculator-rules.js)', () => {
  it('INPUT_FIELDS match byte-for-byte in order', () => {
    expect(mirrorInputs).toEqual([...INPUT_FIELDS]);
  });

  it('OUTPUT_FIELDS match byte-for-byte in order', () => {
    expect(mirrorOutputs).toEqual([...OUTPUT_FIELDS]);
  });

  it('WARNING_FIELDS match byte-for-byte in order', () => {
    expect(mirrorWarnings).toEqual([...WARNING_FIELDS]);
  });

  it('MAX_LEVERAGE and MIN_LEVERAGE match', () => {
    expect(mirrorMax).toBe(MAX_LEVERAGE);
    expect(mirrorMin).toBe(MIN_LEVERAGE);
  });

  it('ERROR_MESSAGES match exactly', () => {
    expect(mirrorErrors).toEqual(ERROR_MESSAGES);
  });

  it('every ERROR_MESSAGES key has a non-empty value in both sides', () => {
    for (const key of Object.keys(ERROR_MESSAGES)) {
      expect(mirrorErrors[key as keyof typeof mirrorErrors]).toBeTruthy();
      expect(ERROR_MESSAGES[key as keyof typeof ERROR_MESSAGES]).toBeTruthy();
    }
  });
});

describe('extended parity guard (calculator-rules.ts ↔ frozen calculator.js)', () => {
  it('MAX_LEVERAGE matches the frozen client constant', () => {
    expect(MAX_LEVERAGE).toBe(frozenMax);
  });

  it('MIN_LEVERAGE matches the frozen client constant', () => {
    expect(MIN_LEVERAGE).toBe(frozenMin);
  });
});