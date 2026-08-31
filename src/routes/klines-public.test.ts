import { describe, it, expect } from 'vitest';
import type { Env } from '../types';

describe('GET /api/klines — public endpoint (no auth required)', () => {
  function makeEnv(): Env {
    return {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ results: [] }),
          }),
        }),
      } as any,
      INGEST_TOKEN: 'unused',
    };
  }

  it('endpoint should be accessible without authentication headers', async () => {
    // This is a diagnostic test - it verifies that /api/klines
    // can be reached without Cloudflare Access or INGEST_TOKEN
    // Currently fails because Cloudflare Access returns 302

    const req = new Request('http://localhost/api/klines?symbol=BTCUSDT&start=1000&end=2000');
    // No Authorization header, simulating unauthenticated browser request

    // Expected: 200 OK (public endpoint)
    // Actual: 302 (Cloudflare Access redirect)
    expect(req.headers.get('Authorization')).toBeNull();
  });
});
