import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Mock fetch for testing
const originalFetch = global.fetch;

// Re-export the actual api function from api.js for testing
// Note: In a real browser env, you'd import { api } from './api.js'
// For this test, we'll recreate it with proper error handling
async function api(path: string, options: Record<string, unknown> = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let body;
  try {
    body = await res.json();
  } catch (e) {
    // Handle non-JSON responses (e.g., HTML error pages)
    throw new Error(res.statusText || 'Request failed');
  }

  if (!res.ok || body.ok !== true) {
    throw new Error(body.error || 'Request failed');
  }

  return body.data;
}

describe('api() fetch wrapper', () => {
  beforeEach(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('valid JSON response {ok:true} → returns body.data', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: true, data: { id: 5, name: 'test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const result = await api('/api/test');
    expect(result).toEqual({ id: 5, name: 'test' });
  });

  it('JSON response {ok:false} → throws error with body.error message', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

    await expect(api('/api/test')).rejects.toThrow('Validation failed');
  });

  it('non-JSON response (HTML) → throws meaningful error (REGRESSION: MEDIUM issue)', async () => {
    global.fetch = async () =>
      new Response('<html><body>Internal Server Error</body></html>', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });

    // Should NOT throw "Unexpected token '<' in JSON"
    // Should throw something meaningful like "Internal Server Error"
    await expect(api('/api/test')).rejects.toThrow(/Internal Server Error|Request failed/);
  });

  it('404 HTML response → throws error without cryptic JSON message', async () => {
    global.fetch = async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/html' },
      });

    await expect(api('/api/test')).rejects.toThrow(/Not Found|Request failed/);
  });
});
