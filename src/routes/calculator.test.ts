import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { errorMiddleware } from '../lib/error-middleware';
import calculator from './calculator';
import app from '../index';
import type { Env } from '../types';

const mockEnv: Env = {
  DB: {} as D1Database,
  INGEST_TOKEN: 'unused',
  ASSETS: {} as Fetcher,
};

const validInput = {
  margin: 1000,
  entryPrice: 100,
  stopLoss: 95,
  takeProfitPrice: 110,
  leverage: 10,
  longShort: 'long',
};

/**
 * Wraps the calculator sub-router with errorMiddleware (mirroring records.test.ts
 * and klines.test.ts) so thrown AppErrors resolve to the sanitized envelope
 * the way they do in production via src/index.ts.
 */
async function post(path: string, body: unknown, env: Env = mockEnv) {
  const testApp = new Hono<{ Bindings: Env }>();
  testApp.onError((err, c) => errorMiddleware(err, c));
  testApp.route('/', calculator);
  return testApp.request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, env);
}

describe('POST /api/calculator/validate (stub)', () => {
  it('returns 501 with the not-implemented envelope for valid input', async () => {
    const res = await post('/api/calculator/validate', validInput);
    expect(res.status).toBe(501);
    const body: any = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Not yet implemented' },
    });
  });

  it('rejects invalid CalculatorInputs with 400 + sanitized VALIDATION_ERROR envelope', async () => {
    const res = await post('/api/calculator/validate', { ...validInput, margin: -100 });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message.length).toBeGreaterThan(0);
    // Raw zod issues are excluded from the client envelope per errorMiddleware.
    expect(body.error.details).toBeUndefined();
  });

  it('rejects non-numeric margin (string) with 400', async () => {
    const res = await post('/api/calculator/validate', { ...validInput, margin: 'abc' });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON body with 400 VALIDATION_ERROR', async () => {
    const testApp = new Hono<{ Bindings: Env }>();
    testApp.onError((err, c) => errorMiddleware(err, c));
    testApp.route('/', calculator);
    const res = await testApp.request('http://localhost/api/calculator/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    }, mockEnv);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts leverage boundary values of 1 and 125 (still 501)', async () => {
    for (const leverage of [1, 125]) {
      const res = await post('/api/calculator/validate', { ...validInput, leverage });
      expect(res.status).toBe(501);
    }
  });

  it('rejects leverage outside 1–125 with 400', async () => {
    for (const leverage of [0, 126]) {
      const res = await post('/api/calculator/validate', { ...validInput, leverage });
      expect(res.status).toBe(400);
    }
  });

  it('normalizes a missing longShort to long (still 501)', async () => {
    const { longShort: _omit, ...rest } = validInput;
    const res = await post('/api/calculator/validate', rest);
    expect(res.status).toBe(501);
  });

  it('normalizes uppercase SHORT direction (still 501)', async () => {
    const res = await post('/api/calculator/validate', {
      ...validInput,
      longShort: 'SHORT',
      stopLoss: 105,
      takeProfitPrice: 95,
    });
    expect(res.status).toBe(501);
  });

  it('rejects long with stopLoss above entry (direction rule → 400)', async () => {
    const res = await post('/api/calculator/validate', { ...validInput, stopLoss: 105 });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('envelope format is exactly { ok, error: { code, message } } — no raw text', async () => {
    const res = await post('/api/calculator/validate', validInput);
    const body: any = await res.json();
    expect(Object.keys(body).sort()).toEqual(['error', 'ok']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
  });

  it('GET /api/calculator/validate is not routed (POST-only)', async () => {
    const testApp = new Hono<{ Bindings: Env }>();
    testApp.onError((err, c) => errorMiddleware(err, c));
    testApp.route('/', calculator);
    const res = await testApp.request('http://localhost/api/calculator/validate', {
      method: 'GET',
    }, mockEnv);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/calculator/compute (stub)', () => {
  it('returns 501 with the same not-implemented envelope for valid input', async () => {
    const res = await post('/api/calculator/compute', validInput);
    expect(res.status).toBe(501);
    const body: any = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Not yet implemented' },
    });
  });

  it('rejects invalid CalculatorInputs with 400 + VALIDATION_ERROR', async () => {
    const res = await post('/api/calculator/compute', { ...validInput, takeProfitPrice: 95 });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});

describe('calculator routes — app-level CORS boundary', () => {
  it('enforces the CORS boundary (no Allow-Origin for untrusted origins)', async () => {
    const res = await app.request('http://localhost/api/calculator/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil.com',
      },
      body: JSON.stringify(validInput),
    }, mockEnv);

    // Auth is enforced at the CF Access edge; CORS is the in-code second layer.
    expect(res.status).toBe(501);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows the production origin through CORS', async () => {
    const res = await app.request('http://localhost/api/calculator/compute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://btcethdivergence.bryanlab.cc',
      },
      body: JSON.stringify(validInput),
    }, mockEnv);

    expect(res.status).toBe(501);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://btcethdivergence.bryanlab.cc');
  });
});