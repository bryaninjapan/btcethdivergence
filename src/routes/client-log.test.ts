import { describe, expect, it } from 'vitest';
import clientLog from './client-log';
import app from '../index';
import type { Env } from '../types';

const mockEnv: Env = {
  DB: {} as D1Database,
  INGEST_TOKEN: 'unused',
  ASSETS: {} as Fetcher,
};

const validRecord = {
  timestamp: '2026-09-03T05:30:15.234Z',
  level: 'error',
  component: 'charts',
  action: 'loadRange.error',
  message: 'Chart load failed',
  context: { startMs: 1000, endMs: 2000 },
  error: { name: 'NetworkError', message: 'fetch failed', kind: 'service' },
};

describe('POST /api/client-log (beacon endpoint)', () => {
  it('accepts a valid payload and returns 202 Accepted with an id', async () => {
    const res = await clientLog.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRecord),
    }, mockEnv);

    expect(res.status).toBe(202);
    const body: any = await res.json();
    expect(body.status).toBe('accepted');
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an invalid schema (missing required level) with 400', async () => {
    const res = await clientLog.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: '2026-09-03T05:30:15.234Z' }),
    }, mockEnv);

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('level');
  });

  it('rejects an invalid level value with 400', async () => {
    const res = await clientLog.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validRecord, level: 'verbose' }),
    }, mockEnv);

    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await clientLog.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    }, mockEnv);

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.status).toBe('error');
  });

  it('rejects oversized payloads (>64 KB) with 413', async () => {
    const big = { ...validRecord, message: 'x'.repeat(64 * 1024) };
    const res = await clientLog.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(big),
    }, mockEnv);

    expect(res.status).toBe(413);
    const body: any = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('64 KB');
  });

  it('enforces the CORS boundary (no Allow-Origin for untrusted origins)', async () => {
    const res = await app.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil.com',
      },
      body: JSON.stringify(validRecord),
    }, mockEnv);

    // Auth is enforced at the CF Access edge; CORS is the in-code second layer.
    expect(res.status).toBe(202);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows the production origin through CORS', async () => {
    const res = await app.request('http://localhost/api/client-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://btcethdivergence.bryanlab.cc',
      },
      body: JSON.stringify(validRecord),
    }, mockEnv);

    expect(res.status).toBe(202);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://btcethdivergence.bryanlab.cc');
  });
});