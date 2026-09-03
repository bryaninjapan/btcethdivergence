// Calculator validation rules for both backend and frontend.
//
// Single source of truth for the leverage/position calculator's input and
// output contracts. The frozen client `public/js/calculator.js` runs fully in
// the browser today; these Zod schemas prepare for future server-side
// calculator endpoints by capturing the same rules in a reusable, typed form
// (CODE-03 DRY validation).
//
// Field names intentionally match the frozen client vocabulary
// (calculator.js:6-9, calculator-init.js:14-16) so a future API consumes the
// exact same shape the UI produces: margin, entryPrice, stopLoss,
// takeProfitPrice, leverage, longShort.

import { z } from 'zod';

/** Maximum leverage multiplier (matches frozen public/js/calculator.js). */
export const MAX_LEVERAGE = 125;
/** Minimum leverage multiplier (matches frozen public/js/calculator.js). */
export const MIN_LEVERAGE = 1;

/** All 6 input fields accepted by the calculator, in form order. */
export const INPUT_FIELDS = [
  'margin',
  'entryPrice',
  'stopLoss',
  'takeProfitPrice',
  'leverage',
  'longShort',
] as const;

/** The 8 computed output fields (warnings live in a separate subobject). */
export const OUTPUT_FIELDS = [
  'positionSize',
  'stopLossAmount',
  'takeProfitAmount',
  'riskRewardRatio',
  'lossRatePercent',
  'gainRatePercent',
  'isValid',
  'errorMessage',
] as const;

/** Warnings subobject fields, mirroring calculator.js:27. */
export const WARNING_FIELDS = ['riskRewardTooLow', 'liquidationRisk'] as const;

/**
 * User-facing error strings, verbatim from the frozen client
 * (calculator.js:71-86). Keeping them here makes a future API return the same
 * messages the UI already shows.
 */
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
} as const;

/**
 * Normalizes a raw direction value to the canonical 'long' | 'short'.
 * Mirrors frozen calculator.js:66-69 normalizeDirection(): only the exact
 * short variants ('short', 'Short', 'SHORT') map to 'short'; everything else
 * (including case mismatches like 'sHoRt') is 'long'.
 */
function normalizeDirection(value: string): 'long' | 'short' {
  return ['short', 'Short', 'SHORT'].includes(value) ? 'short' : 'long';
}

/**
 * CalculatorInputs — validates and normalizes the 6 calculator form fields.
 *
 * longShort is normalized via z.transform (Option A, TDD-verified) so client
 * values like 'SHORT'/'Short' pass through exactly as the frozen client would
 * handle them, rather than being rejected by a strict enum.
 */
export const CalculatorInputs = z
  .object({
    margin: z.number().finite().positive(ERROR_MESSAGES.marginPositive),
    entryPrice: z.number().finite().positive(ERROR_MESSAGES.entryPricePositive),
    stopLoss: z.number().finite().positive(ERROR_MESSAGES.stopLossPositive),
    takeProfitPrice: z
      .number()
      .finite()
      .positive(ERROR_MESSAGES.takeProfitPositive),
    leverage: z
      .number()
      .finite()
      .min(MIN_LEVERAGE, ERROR_MESSAGES.leverageRange)
      .max(MAX_LEVERAGE, ERROR_MESSAGES.leverageRange),
    longShort: z
      .string()
      .default('long')
      .transform(normalizeDirection)
      .pipe(z.enum(['long', 'short'])),
  })
  .superRefine((d, ctx) => {
    // Direction-dependent SL/TP placement rules (calculator.js:79-85).
    if (d.longShort === 'short') {
      if (d.stopLoss <= d.entryPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['stopLoss'],
          message: ERROR_MESSAGES.shortStopLossAboveEntry,
        });
      }
      if (d.takeProfitPrice >= d.entryPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['takeProfitPrice'],
          message: ERROR_MESSAGES.shortTakeProfitBelowEntry,
        });
      }
    } else {
      if (d.stopLoss >= d.entryPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['stopLoss'],
          message: ERROR_MESSAGES.longStopLossBelowEntry,
        });
      }
      if (d.takeProfitPrice <= d.entryPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['takeProfitPrice'],
          message: ERROR_MESSAGES.longTakeProfitAboveEntry,
        });
      }
    }
  });

/**
 * CalculatorOutputs — validates the computed output shape a future compute
 * endpoint will return. Enumerates the 9 computed fields + warnings subobject
 * only; input echoes are intentionally out of scope (see PLAN.md I3: the full
 * frozen calculatePosition() return also echoes the 6 inputs).
 */
/**
 * CalculatorOutputs — computed position metrics (9 fields, results-only design).
 *
 * Design Choice: Option C (Results Only)
 * - Returns calculated output only, no input echo (margin, entryPrice, stopLoss, etc.)
 * - Rationale: API responsibility = "compute", not "repeat"
 * - Client already knows its own inputs; Server provides new computed data
 * - Aligned with REST best practices (Stripe, OpenAI API pattern)
 * - Verified via TDD comparison (.planning/phases/phase-17/L2-TDD-Schema-Comparison.test.ts)
 *
 * Future /api/calculator/compute (Phase 18+) will return this schema shape.
 * See LEARNING.md "L2 Deep Dive: CalculatorOutputs Schema Design" for full analysis.
 */
export const CalculatorOutputs = z.object({
  isValid: z.boolean(),
  errorMessage: z.string(),
  positionSize: z.number().finite().nonnegative(),
  stopLossAmount: z.number().finite().nonnegative(),
  takeProfitAmount: z.number().finite().nonnegative(),
  riskRewardRatio: z.number().finite().nonnegative(),
  lossRatePercent: z.number().finite().nonnegative(),
  gainRatePercent: z.number().finite().nonnegative(),
  warnings: z.object({
    riskRewardTooLow: z.boolean(),
    liquidationRisk: z.boolean(),
  }),
});

export type CalculatorInput = z.infer<typeof CalculatorInputs>;
export type CalculatorOutput = z.infer<typeof CalculatorOutputs>;