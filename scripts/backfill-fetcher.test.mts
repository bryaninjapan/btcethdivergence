import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCursor } from './backfill-fetcher.mts';

describe('fetchCursor — cursor fetch error handling (Phase 2 CR-01)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs an error and exits 1 when the cursor response body is malformed JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json{{{', { status: 200 }),
      ),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, 'exit')
      // Throw to halt execution the same way a real process exit would stop the script.
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never);

    await expect(fetchCursor('https://worker.example', 'token', 'BTCUSDT')).rejects.toThrow(
      'process.exit(1)',
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse cursor response'));
  });

  it('returns null (not a crash) when valid JSON is missing the cursor field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      ),
    );

    const cursor = await fetchCursor('https://worker.example', 'token', 'BTCUSDT');

    expect(cursor).toBeNull();
  });

  it('returns null when the whole "data" envelope is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const cursor = await fetchCursor('https://worker.example', 'token', 'BTCUSDT');

    expect(cursor).toBeNull();
  });

  it('returns the numeric cursor when the response is well-formed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { cursor: 1627473600 } }), { status: 200 }),
      ),
    );

    const cursor = await fetchCursor('https://worker.example', 'token', 'BTCUSDT');

    expect(cursor).toBe(1627473600);
  });

  it('logs an error and exits 1 on a non-OK HTTP status (e.g. network/auth failure surfaced as 401/500)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never);

    await expect(fetchCursor('https://worker.example', 'token', 'BTCUSDT')).rejects.toThrow(
      'process.exit(1)',
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read cursor: HTTP 500'));
  });

  it('propagates (does not swallow) a network-level fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(fetchCursor('https://worker.example', 'token', 'BTCUSDT')).rejects.toThrow(
      'ECONNREFUSED',
    );
  });
});
