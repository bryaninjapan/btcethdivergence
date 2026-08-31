import { describe, it, expect } from 'vitest';
import app from './index';
import type { Env } from './types';

const mockEnv: Env = {
  DB: {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ success: true }),
        all: async () => ({ results: [] }),
        first: async () => null,
      }),
    }),
  } as any,
  ASSETS: {} as any,
};

describe('Worker CORS headers', () => {
  it('includes Access-Control-Allow-Origin for browser cookie requests', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('includes Access-Control-Allow-Credentials when allowing cookies', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('includes proper CORS headers for OPTIONS preflight requests', async () => {
    const req = new Request('http://localhost/api/klines', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://btcethdivergence.bryanlab.cc',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});
