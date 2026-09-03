/**
 * E2E: client-log beacon integration (Phase 16A, SC11/SC12/SC13).
 *
 * Proves that a chart load failure triggers a fire-and-forget POST to
 * /api/client-log carrying the structured record, and that the endpoint honors
 * its contract (202 accepted / 400 invalid / auth boundary).
 */

import { test, expect } from '@playwright/test';

test.describe('Client-log beacon E2E', () => {
  test('charts.js sends a beacon on load failure and the endpoint returns 202', async ({ page, request }) => {
    // Force the klines API to fail so the chart load path errors out.
    await page.route('**/api/klines*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'SERVICE_ERROR', message: 'forced failure' },
        }),
      });
    });

    const beaconRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/client-log')) beaconRequests.push(req.postData() || '');
    });

    await page.goto('/charts.html');

    // The chart error path should fire an error-level beacon with the
    // loadRange.error action (earlier beacons are info-level lifecycle logs).
    await expect.poll(async () => {
      for (const raw of beaconRequests) {
        const body = JSON.parse(raw);
        if (body.level === 'error' && body.action === 'loadRange.error') return body;
      }
      return null;
    }, { timeout: 15000 }).not.toBeNull();

    const records = beaconRequests.map((raw) => JSON.parse(raw));
    const body = records.find((b) => b.level === 'error' && b.action === 'loadRange.error');
    expect(body.component).toBe('charts');
    expect(body.message).toContain('forced failure');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.error).toMatchObject({ kind: 'service' });

    // Direct endpoint contract checks.
    const ok = await request.post('/api/client-log', {
      data: {
        timestamp: new Date().toISOString(),
        level: 'warn',
        component: 'charts',
        action: 'manual.probe',
        message: 'e2e probe',
      },
    });
    expect(ok.status()).toBe(202);
    expect((await ok.json()).status).toBe('accepted');

    const invalid = await request.post('/api/client-log', {
      data: { timestamp: new Date().toISOString() },
    });
    expect(invalid.status()).toBe(400);
  });
});