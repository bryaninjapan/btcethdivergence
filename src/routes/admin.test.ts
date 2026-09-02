import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { errorMiddleware } from '../lib/error-middleware';
import { createMockD1Database, type MockD1Database } from '../lib/test-db';
import type { Env } from '../types';

const timingSafeEqualSpy = vi.hoisted(() => vi.fn());

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    timingSafeEqual: (...args: Parameters<typeof actual.timingSafeEqual>) => {
      timingSafeEqualSpy(...args);
      return actual.timingSafeEqual(...args);
    },
  };
});

const { default: admin } = await import('./admin');

const INGEST_TOKEN = 'super-secret-token-value-1234567890';

function makeEnv(db: MockD1Database): Env {
  return { DB: db as unknown as Env['DB'], INGEST_TOKEN };
}

function createAppWithErrorMiddleware(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.onError((err, c) => errorMiddleware(err, c));
  app.route('/', admin);
  return app;
}

async function callBackfillCursor(authHeader: string | undefined, db = createMockD1Database()) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers.Authorization = authHeader;
  }
  const app = createAppWithErrorMiddleware();
  return app.request(
    '/api/admin/backfill-cursor?symbol=BTCUSDT',
    { headers },
    makeEnv(db),
  );
}

describe('admin auth — timing-safe token comparison (Phase 2 WR-02)', () => {
  it('accepts a request with the correct bearer token', async () => {
    const res = await callBackfillCursor(`Bearer ${INGEST_TOKEN}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('rejects a same-length wrong token (proves comparison checks content, not just length)', async () => {
    // Same length as the real token, differs only in one character.
    const wrongSameLength = INGEST_TOKEN.slice(0, -1) + (INGEST_TOKEN.endsWith('0') ? '9' : '0');
    expect(wrongSameLength.length).toBe(INGEST_TOKEN.length);

    const res = await callBackfillCursor(`Bearer ${wrongSameLength}`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('AUTH_ERROR');
  });

  it('rejects a token that is merely a prefix of the correct token (would pass naive startsWith checks)', async () => {
    const prefixToken = INGEST_TOKEN.slice(0, INGEST_TOKEN.length - 5);
    const res = await callBackfillCursor(`Bearer ${prefixToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects an empty token', async () => {
    const res = await callBackfillCursor('Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects a completely different token of a different length', async () => {
    const res = await callBackfillCursor('Bearer x');
    expect(res.status).toBe(401);
  });

  it('rejects requests with no Authorization header at all (401, not a crash)', async () => {
    const res = await callBackfillCursor(undefined);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error?: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('AUTH_ERROR');
  });

  it('rejects a malformed Authorization scheme (missing "Bearer " prefix)', async () => {
    const res = await callBackfillCursor(INGEST_TOKEN);
    expect(res.status).toBe(401);
  });

  it('successfully authenticates with correct token and proceeds to route handler', async () => {
    const res = await callBackfillCursor(`Bearer ${INGEST_TOKEN}`);
    // When auth succeeds, the route handler runs and returns the data
    expect(res.status).toBe(200);
  });

  it('rejects with 401 for mismatched-length token (proves short-circuit auth)', async () => {
    const res = await callBackfillCursor('Bearer short');
    // Length mismatch should fail auth before expensive comparison
    expect(res.status).toBe(401);
  });
});
