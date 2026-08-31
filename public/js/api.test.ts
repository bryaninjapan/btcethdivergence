import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ApiError, api, describeApiError } from './api.js';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = originalFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('api() fetch wrapper', () => {
  it('valid JSON response {ok:true} → returns body.data', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: true, data: { id: 5, name: 'test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const result = await api('/api/test');
    expect(result).toEqual({ id: 5, name: 'test' });
  });

  it('JSON response {ok:false} → throws ApiError with structured error code/message', async () => {
    global.fetch = async () =>
      new Response(
        JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );

    const err = await api('/api/test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    expect((err as ApiError).message).toBe('Validation failed');
  });

  it('non-JSON response (HTML) → throws ApiError without cryptic JSON message', async () => {
    global.fetch = async () =>
      new Response('<html><body>Internal Server Error</body></html>', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });

    const err = await api('/api/test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INTERNAL_ERROR');
    expect((err as ApiError).message).toBe('Internal Server Error');
  });

  it('404 HTML response → throws ApiError with a meaningful message', async () => {
    global.fetch = async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/html' },
      });

    const err = await api('/api/test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INTERNAL_ERROR');
    expect((err as ApiError).message).toBe('Not Found');
  });

  it('includes credentials: include in fetch options for Cloudflare Access cookies', async () => {
    let capturedOptions: any = null;
    global.fetch = async (url: string, options?: RequestInit) => {
      capturedOptions = options;
      return new Response(JSON.stringify({ ok: true, data: { test: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await api('/api/klines');
    expect(capturedOptions?.credentials).toBe('include');
  });

  it('forwards extra options (method, body) to fetch', async () => {
    let capturedOptions: any = null;
    global.fetch = async (url: string, options?: RequestInit) => {
      capturedOptions = options;
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await api('/api/records', { method: 'POST', body: '{}' });
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.body).toBe('{}');
  });
});

describe('describeApiError()', () => {
  it('maps SERVICE_ERROR to a friendly message', () => {
    const error = new ApiError('SERVICE_ERROR', 'raw');
    expect(describeApiError(error)).toBe('Service temporarily unavailable. Please try again.');
  });

  it('maps DATABASE_ERROR to a friendly message', () => {
    const error = new ApiError('DATABASE_ERROR', 'raw');
    expect(describeApiError(error)).toBe('Database error. Please try again.');
  });

  it('returns the original message for VALIDATION_ERROR', () => {
    const error = new ApiError('VALIDATION_ERROR', 'start_time must be before end_time');
    expect(describeApiError(error)).toBe('start_time must be before end_time');
  });

  it('falls back for non-ApiError input', () => {
    expect(describeApiError(new Error('boom'), 'fallback')).toBe('boom');
    expect(describeApiError(undefined, 'fallback')).toBe('fallback');
  });
});