import { test, expect } from '@playwright/test';

/**
 * E2E tests for calculator-init.js
 * Tests DOM binding, event handling, and UI updates in real browser
 */

test.describe('Calculator UI — Leverage Calculator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to calculator page
    await page.goto('/calculator.html');

    // Wait for form to load
    await expect(page.locator('#calculator-form')).toBeVisible();
  });

  test('initializes with results hidden (empty form)', async ({ page }) => {
    // Verify all results are hidden (show dashes)
    await expect(page.locator('#position-size')).toContainText('—');
    await expect(page.locator('#sl-amount')).toContainText('—');
    await expect(page.locator('#tp-amount')).toContainText('—');
    await expect(page.locator('#rr-ratio')).toContainText('—');
    await expect(page.locator('#loss-rate')).toContainText('—');
    await expect(page.locator('#gain-rate')).toContainText('—');

    // Verify error is hidden
    const error = page.locator('#calc-error');
    await expect(error).toBeHidden();
  });

  test('updates results when form is complete', async ({ page }) => {
    // Fill form
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '10');

    // Wait for results to update
    await page.waitForTimeout(100);

    // Verify results are displayed (not dashes)
    const positionSize = page.locator('#position-size');
    await expect(positionSize).not.toContainText('—');

    // Verify specific calculations
    const rrRatio = page.locator('#rr-ratio');
    await expect(rrRatio).toContainText(/\d+\.\d+/);
  });

  test('clears results when form becomes incomplete', async ({ page }) => {
    // Fill complete form
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '10');

    // Wait for results
    await page.waitForTimeout(100);
    let positionSize = page.locator('#position-size');
    await expect(positionSize).not.toContainText('—');

    // Clear margin field
    await page.fill('#margin', '');

    // Wait for update
    await page.waitForTimeout(100);

    // Verify results cleared
    positionSize = page.locator('#position-size');
    await expect(positionSize).toContainText('—');
  });

  test('hides error when calculation succeeds', async ({ page }) => {
    // Fill valid form
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '10');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Verify error is hidden
    const error = page.locator('#calc-error');
    await expect(error).toBeHidden();
  });

  test('displays error when entry price is invalid', async ({ page }) => {
    // Fill form with invalid entry price (outside SL/TP range)
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '50000'); // Outside [39000, 41000]
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '10');

    // Wait for validation
    await page.waitForTimeout(100);

    // Verify error is shown
    const error = page.locator('#calc-error');
    await expect(error).toBeVisible();
  });

  test('displays R:R warning when risk/reward ratio is low', async ({ page }) => {
    // Fill form with poor risk/reward (small profit, large loss)
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '38000'); // Large loss
    await page.fill('#take-profit', '40100'); // Small profit (R:R = 0.05)
    await page.selectOption('#leverage', '10');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Verify R:R warning is shown
    const warning = page.locator('#rr-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('盈虧比低於 1:1');
  });

  test('displays liquidation warning when SL exceeds margin', async ({ page }) => {
    // Fill form with large distance between entry and SL
    await page.fill('#margin', '100'); // Small margin
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '30000'); // Huge distance
    await page.fill('#take-profit', '50000');
    await page.selectOption('#leverage', '10'); // High leverage

    // Wait for calculation
    await page.waitForTimeout(100);

    // Verify liquidation warning is shown
    const warning = page.locator('#liquidation-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('止損金額超過保證金');
  });

  test('respects long/short direction toggle', async ({ page }) => {
    // Default should be long
    const longRadio = page.locator('input[name="longShort"][value="long"]');
    await expect(longRadio).toBeChecked();

    // Switch to short
    const shortRadio = page.locator('input[name="longShort"][value="short"]');
    await shortRadio.click();
    await expect(shortRadio).toBeChecked();
    await expect(longRadio).not.toBeChecked();

    // Fill form
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '41000'); // For short: profit below entry
    await page.fill('#take-profit', '39000');
    await page.selectOption('#leverage', '10');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Verify results updated (calculation should work for short too)
    const positionSize = page.locator('#position-size');
    await expect(positionSize).not.toContainText('—');
  });

  test('displays position size with precision', async ({ page }) => {
    // Fill form with normal values
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '10');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Position size should be displayed as a number (no K/M formatting)
    const positionSize = page.locator('#position-size');
    const text = await positionSize.textContent();

    // Should be numeric value
    expect(text).toMatch(/\d+(\.\d+)?/);
    expect(text).not.toBe('—');
  });

  test('updates in real-time as user types', async ({ page }) => {
    // Start with empty
    await expect(page.locator('#position-size')).toContainText('—');

    // Fill each field and verify updates
    await page.fill('#margin', '1000');
    await page.waitForTimeout(50);

    await page.fill('#entry-price', '40000');
    await page.waitForTimeout(50);

    await page.fill('#stop-loss', '39000');
    await page.waitForTimeout(50);

    // Still incomplete (missing take-profit)
    await expect(page.locator('#position-size')).toContainText('—');

    // Complete the form
    await page.fill('#take-profit', '41000');
    await page.waitForTimeout(100);

    // Now results should appear
    await expect(page.locator('#position-size')).not.toContainText('—');
  });

  test('recalculates when leverage is changed', async ({ page }) => {
    // Fill form
    await page.fill('#margin', '1000');
    await page.fill('#entry-price', '40000');
    await page.fill('#stop-loss', '39000');
    await page.fill('#take-profit', '41000');
    await page.selectOption('#leverage', '5');

    // Get initial position size
    await page.waitForTimeout(100);
    const positionSizeElement = page.locator('#position-size');
    const initial = await positionSizeElement.textContent();

    // Change leverage
    await page.selectOption('#leverage', '10');
    await page.waitForTimeout(100);

    // Position size should change (typically double at 2x leverage)
    const updated = await positionSizeElement.textContent();
    expect(updated).not.toBe(initial);
  });

  test('handles edge case: zero values gracefully', async ({ page }) => {
    // Fill with zeros
    await page.fill('#margin', '0');
    await page.fill('#entry-price', '0');
    await page.fill('#stop-loss', '0');
    await page.fill('#take-profit', '0');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Should either show error or show 0 results, not crash
    const positionSize = page.locator('#position-size');
    const text = await positionSize.textContent();

    // Verify page still responsive (didn't crash)
    await expect(page.locator('#calculator-form')).toBeVisible();
  });

  test('handles edge case: very large values gracefully', async ({ page }) => {
    // Fill with very large numbers
    await page.fill('#margin', '999999999');
    await page.fill('#entry-price', '999999');
    await page.fill('#stop-loss', '999998');
    await page.fill('#take-profit', '1000000');
    await page.selectOption('#leverage', '125');

    // Wait for calculation
    await page.waitForTimeout(100);

    // Should calculate without crashing
    const positionSize = page.locator('#position-size');
    const text = await positionSize.textContent();

    // Should not be empty or error (or should show error gracefully)
    expect(text).toBeTruthy();
  });
});
