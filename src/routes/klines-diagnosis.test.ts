import { describe, it, expect } from 'vitest';

/**
 * MANUAL DIAGNOSTIC — excluded from `npm test` via vitest.config.ts.
 *
 * This suite makes live fetch() calls against the deployed production
 * domain to inspect Cloudflare Access edge routing behavior. It is
 * intentionally not part of the automated regression suite because:
 *   - it depends on live infrastructure state outside this repo's control
 *     (Cloudflare Access policy config/propagation), so it is
 *     non-deterministic in CI;
 *   - it exercises Cloudflare's edge, not this codebase's logic.
 *
 * To run it manually, remove the '**\/klines-diagnosis.test.ts' entry from
 * `test.exclude` in vitest.config.ts, then `npx vitest run src/routes/klines-diagnosis.test.ts`.
 */
describe('Cloudflare Access routing diagnosis', () => {
  it('PUBLIC: /api/klines should return 200 (no auth required)', async () => {
    const res = await fetch('https://btcethdivergence.bryanlab.cc/api/klines?symbol=BTCUSDT&start=1&end=2');

    console.log('✓ /api/klines status:', res.status);
    console.log('  Headers:');
    console.log('    - cf-access-domain:', res.headers.get('cf-access-domain'));
    console.log('    - www-authenticate:', res.headers.get('www-authenticate'));

    // Diagnosis: Check which Application is responding
    const text = await res.text();
    if (res.status === 302) {
      console.log('❌ Still returns 302 redirect');
      console.log('  Location:', res.headers.get('location')?.substring(0, 100));
      console.log('  This means Cloudflare Access is still intercepting');
      console.log('  Possible causes:');
      console.log('    1. Public Data APIs is not the active Application for this path');
      console.log('    2. Cloudflare needs more time to propagate changes');
      console.log('    3. Multiple Applications are configured for same path (conflict)');
    }

    expect(res.status).not.toBe(302);
  });

  it('PROTECTED: /api/records should return 302 (needs auth)', async () => {
    const res = await fetch('https://btcethdivergence.bryanlab.cc/api/records');

    console.log('✓ /api/records status:', res.status);
    expect(res.status).toBe(302);
  });
});
