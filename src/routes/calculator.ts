/**
 * Future calculator API endpoints (stubs).
 *
 * POST /api/calculator/validate — validates a CalculatorInputs payload.
 * POST /api/calculator/compute  — will compute position math server-side.
 *
 * Both are deliberately unimplemented (HTTP 501). They validate the incoming
 * payload against the shared schemas (throwing the sanitized 400 envelope on
 * invalid input) so the API contract is pinned today and only the computation
 * needs wiring later (see PLAN.md "Notes for Future Implementation").
 *
 * Authentication is enforced at the Cloudflare Access edge (same policy as
 * /api/records and /api/client-log), not in Worker code.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { CalculatorInputs } from '../domains/calculator-rules';
import { ErrorCode, ValidationError } from '../lib/errors';
import { validationMessage } from '../lib/validate';
import type { ApiResponse, Env } from '../types';

const calculator = new Hono<{ Bindings: Env }>();

/** Stub response body shared by both endpoints (Phase 11 envelope contract). */
const NOT_IMPLEMENTED = {
  ok: false,
  error: { code: ErrorCode.INTERNAL_ERROR, message: 'Not yet implemented' },
} as const;

/** Parse JSON body and validate against CalculatorInputs, throwing on failure. */
async function parseBody(c: Context): Promise<void> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('body', 'Invalid JSON body');
  }
  const parsed = CalculatorInputs.safeParse(body);
  if (!parsed.success) throw new ValidationError('body', validationMessage(parsed.error));
}

calculator.post('/api/calculator/validate', async (c) => {
  await parseBody(c);
  return c.json(NOT_IMPLEMENTED satisfies ApiResponse<never>, 501);
});

calculator.post('/api/calculator/compute', async (c) => {
  await parseBody(c);
  return c.json(NOT_IMPLEMENTED satisfies ApiResponse<never>, 501);
});

export default calculator;