/**
 * E2E tests for records CRUD functionality
 * Tests create, read, update, delete, and filtering
 * Configured for isolated, non-parallel execution to prevent DB pollution
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Wait for a <dialog> element to actually close.
 *
 * IMPORTANT: do NOT use `page.waitForSelector('#foo:not([open])', { state: 'hidden' })`.
 * That compound selector matches ZERO elements while the dialog is still open
 * (because the real DOM node still has the `open` attribute), and Playwright's
 * `state: 'hidden'` treats "selector matches nothing" as already satisfied.
 * That produces a false positive: the wait resolves instantly even though the
 * dialog never closed (e.g. blocked by client-side validation), which then
 * surfaces later as a confusing, unrelated failure (element not found).
 *
 * Waiting on the dialog's own locator for `state: 'hidden'` is correct because
 * the locator always resolves to the same attached element and genuinely
 * tracks its open/closed (display) transition.
 */
async function waitForDialogClosed(page: Page, dialogSelector: string) {
  await page.locator(dialogSelector).waitFor({ state: 'hidden' });
}

/**
 * Set distinct start/end hours on the record form's time pickers.
 *
 * IMPORTANT: the "new record" dialog defaults both start and end pickers to
 * the current hour (`Timestamp.now()`), so start_time === end_time unless a
 * test explicitly picks different hours. submitForm() rejects start >= end
 * with a client-side validation error and never closes the dialog, which
 * silently prevents record creation. Every test that creates a record must
 * call this (or otherwise diverge the two times) before saving.
 */
async function setDistinctTimeRange(page: Page, startHour = '0', endHour = '1') {
  await page.selectOption('[data-picker="start"] [data-part="hour"]', startHour);
  await page.selectOption('[data-picker="end"] [data-part="hour"]', endHour);
}

test.describe.serial('Records CRUD E2E', () => {
  let createdRecordNotes: string | null = null;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for records table to load
    await page.waitForSelector('#records-table', { timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up: delete any test records created during this test
    if (createdRecordNotes) {
      try {
        // Find and delete the record we created
        const recordRow = page.locator(`tr:has-text("${createdRecordNotes}")`).first();
        if (await recordRow.isVisible({ timeout: 5000 })) {
          // Find the delete button within this row
          const deleteBtn = recordRow.locator('button[data-action="delete"]');
          await deleteBtn.click({ timeout: 5000 });
          await page.waitForSelector('#delete-dialog[open]', { timeout: 10000 });
          await page.click('#confirm-delete');
          await waitForDialogClosed(page, '#delete-dialog');
        }
      } catch (e) {
        // Cleanup may fail if record already deleted or dialog behavior changed; continue anyway
      }
      createdRecordNotes = null;
    }
  });

  test('should create a new record', async ({ page }) => {
    // Click "新增" button
    await page.click('#new-record');

    // Wait for dialog
    await page.waitForSelector('#record-dialog[open]');

    // Set time range (start hour 0, end hour 1)
    await setDistinctTimeRange(page);

    // Fill in form with unique identifier
    createdRecordNotes = `E2E test record ${Date.now()}`;
    await page.fill('#notes', createdRecordNotes);
    await page.fill('#tags', 'test,e2e');

    // Save
    await page.click('#save-record');

    // Dialog should close
    await waitForDialogClosed(page, '#record-dialog');

    // Verify record appears in table
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });

  test('should edit an existing record', async ({ page }) => {
    // First create a record
    const originalNotes = `Record to edit ${Date.now()}`;
    createdRecordNotes = originalNotes;

    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);
    await page.fill('#notes', originalNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Now edit it - find the row and click edit button
    const recordRow = page.locator(`tr:has-text("${originalNotes}")`).first();
    const editBtn = recordRow.locator('button[data-action="edit"]');
    await editBtn.click();
    await page.waitForSelector('#record-dialog[open]');

    // Clear and update notes
    const updatedNotes = `Updated record ${Date.now()}`;
    createdRecordNotes = updatedNotes;
    await page.fill('#notes', updatedNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Verify update
    await expect(page.locator(`text=${updatedNotes}`)).toBeVisible();
    await expect(page.locator(`text=${originalNotes}`)).not.toBeVisible();
  });

  test('should delete a record', async ({ page }) => {
    // Create a record first
    const recordNotes = `Record to delete ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);
    await page.fill('#notes', recordNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Delete it using row-scoped selector
    const recordRow = page.locator(`tr:has-text("${recordNotes}")`).first();
    const deleteBtn = recordRow.locator('button[data-action="delete"]');
    await deleteBtn.click();
    await page.waitForSelector('#delete-dialog[open]');

    await page.click('#confirm-delete');
    await waitForDialogClosed(page, '#delete-dialog');

    // Verify it's gone
    await expect(page.locator(`text=${recordNotes}`)).not.toBeVisible();
    createdRecordNotes = null;
  });

  test('should filter records by type', async ({ page }) => {
    // Create a record with specific type
    createdRecordNotes = `Specific type record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);

    // Select type
    const typeOption = page.locator('input[name="type"][value="btc_hh_eth_lh"]');
    await typeOption.check();

    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Filter by this type
    await page.selectOption('#type-filter', 'btc_hh_eth_lh');

    // Wait for filter to apply
    await page.waitForTimeout(200);

    // Verify record is visible
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });

  test('should filter records by tag', async ({ page }) => {
    // Create a record with specific tag
    createdRecordNotes = `Tagged record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);
    await page.fill('#notes', createdRecordNotes);
    await page.fill('#tags', 'important,test');
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Filter by tag
    await page.fill('#tag-filter', 'important');

    // Wait for debounce (records.js debounces at 250ms, add buffer)
    await page.waitForTimeout(350);

    // Verify record is visible
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });

  test('should display MSB status in table', async ({ page }) => {
    // Create a record with MSB
    createdRecordNotes = `Record with MSB ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);

    // Check MSB=yes
    const msbYes = page.locator('input[name="msb"][value="yes"]');
    await msbYes.check();

    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Verify MSB column shows the value
    const recordRow = page.locator(`tr:has-text("${createdRecordNotes}")`).first();
    const msbCell = recordRow.locator('td:has-text("有重要結構破裂")');
    await expect(msbCell).toBeVisible();
  });

  test('should load record for chart viewing', async ({ page }) => {
    // Create a record
    createdRecordNotes = `Chart test record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);
    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Click "查看K線" button on the row we created
    const recordRow = page.locator(`tr:has-text("${createdRecordNotes}")`).first();
    const viewButton = recordRow.locator('button[data-action="view-chart"]');
    await viewButton.click();

    // Should navigate to the charts page with time parameters.
    // NOTE: Cloudflare Workers Static Assets (html_handling: auto-trailing-slash,
    // the default) redirects "/charts.html" -> "/charts", stripping the
    // extension. Match both forms rather than assuming the literal ".html" URL.
    await page.waitForURL(/\/charts(\.html)?(\?|$)/);
    expect(page.url()).toContain('start=');
    expect(page.url()).toContain('end=');
  });

  test('should persist records across navigation', async ({ page }) => {
    // Create a record
    createdRecordNotes = `Persistent record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await setDistinctTimeRange(page);
    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await waitForDialogClosed(page, '#record-dialog');

    // Navigate to charts and back
    await page.goto('/charts.html');
    await page.goto('/');

    // Record should still be there
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });
});
