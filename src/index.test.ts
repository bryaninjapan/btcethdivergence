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
  INGEST_TOKEN: 'unused',
  ASSETS: {} as any,
};

describe('Worker CORS headers', () => {
  it('allows localhost origins for development', async () => {
    const req = new Request('http://localhost/api/health', {
      headers: { 'Origin': 'http://localhost:3000' },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows 127.0.0.1 for development', async () => {
    const req = new Request('http://localhost/api/health', {
      headers: { 'Origin': 'http://127.0.0.1:8000' },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8000');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows production domain (btcethdivergence.bryanlab.cc)', async () => {
    const req = new Request('http://localhost/api/klines', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://btcethdivergence.bryanlab.cc',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://btcethdivergence.bryanlab.cc',
    );
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('rejects untrusted origins', async () => {
    const req = new Request('http://localhost/api/health', {
      headers: { 'Origin': 'https://evil.com' },
    });
    const res = await app.fetch(req, mockEnv);

    // Hono cors middleware returns null → browser gets no Allow-Origin header
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows requests without origin header', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, mockEnv);

    // No origin header → allowed (server-to-server, tests, etc)
    expect(res.status).toBe(200);
  });
});
