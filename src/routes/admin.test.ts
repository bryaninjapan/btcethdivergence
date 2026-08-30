import { describe, expect, it, vi } from 'vitest';
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

/**
 * Minimal fake D1Database supporting the .first() call used by
 * getBackfillCursor, so we can exercise the /api/admin/backfill-cursor
 * route end-to-end through the real `auth()` middleware.
 */
class FakeD1Database {
  prepare(_sql: string) {
    return {
      bind(..._params: unknown[]) {
        return {
          first: async <T>() => null as unknown as T,
        };
      },
    };
  }
}

const INGEST_TOKEN = 'super-secret-token-value-1234567890';

function makeEnv(): Env {
  return { DB: new FakeD1Database() as unknown as Env['DB'], INGEST_TOKEN };
}

async function callBackfillCursor(authHeader: string | undefined) {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers.Authorization = authHeader;
  }
  return admin.request(
    '/api/admin/backfill-cursor?symbol=BTCUSDT',
    { headers },
    makeEnv(),
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
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Unauthorized');
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
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects a malformed Authorization scheme (missing "Bearer " prefix)', async () => {
    const res = await callBackfillCursor(INGEST_TOKEN);
    expect(res.status).toBe(401);
  });

  it('actually invokes node:crypto timingSafeEqual for a same-length comparison (proves constant-time compare is used, not ===)', async () => {
    timingSafeEqualSpy.mockClear();
    const res = await callBackfillCursor(`Bearer ${INGEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
  });

  it('does not invoke timingSafeEqual for a mismatched-length token (short-circuits before the constant-time compare)', async () => {
    timingSafeEqualSpy.mockClear();
    const res = await callBackfillCursor('Bearer short');

    expect(res.status).toBe(401);
    expect(timingSafeEqualSpy).not.toHaveBeenCalled();
  });
});
