/**
 * E2E tests for records CRUD functionality
 * Tests create, read, update, delete, and filtering
 * Configured for isolated, non-parallel execution to prevent DB pollution
 */

import { test, expect } from '@playwright/test';

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
      // Find and delete the record we created
      const recordRow = page.locator(`tr:has-text("${createdRecordNotes}")`).first();
      if (await recordRow.isVisible()) {
        // Find the delete button within this row
        const deleteBtn = recordRow.locator('button[data-action="delete"]');
        await deleteBtn.click();
        await page.waitForSelector('#delete-dialog[open]');
        await page.click('#confirm-delete');
        await page.waitForSelector('#delete-dialog:not([open])');
      }
      createdRecordNotes = null;
    }
  });

  test('should create a new record', async ({ page }) => {
    // Click "新增" button
    await page.click('#new-record');

    // Wait for dialog
    await page.waitForSelector('#record-dialog[open]');

    // Fill in form with unique identifier
    createdRecordNotes = `E2E test record ${Date.now()}`;
    await page.fill('#notes', createdRecordNotes);
    await page.fill('#tags', 'test,e2e');

    // Save
    await page.click('#save-record');

    // Dialog should close
    await page.waitForSelector('#record-dialog:not([open])');

    // Verify record appears in table
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });

  test('should edit an existing record', async ({ page }) => {
    // First create a record
    const originalNotes = `Record to edit ${Date.now()}`;
    createdRecordNotes = originalNotes;

    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await page.fill('#notes', originalNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

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

    // Verify update
    await expect(page.locator(`text=${updatedNotes}`)).toBeVisible();
    await expect(page.locator(`text=${originalNotes}`)).not.toBeVisible();
  });

  test('should delete a record', async ({ page }) => {
    // Create a record first
    const recordNotes = `Record to delete ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await page.fill('#notes', recordNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

    // Delete it using row-scoped selector
    const recordRow = page.locator(`tr:has-text("${recordNotes}")`).first();
    const deleteBtn = recordRow.locator('button[data-action="delete"]');
    await deleteBtn.click();
    await page.waitForSelector('#delete-dialog[open]');

    await page.click('#confirm-delete');
    await page.waitForSelector('#delete-dialog:not([open])');

    // Verify it's gone
    await expect(page.locator(`text=${recordNotes}`)).not.toBeVisible();
    createdRecordNotes = null;
  });

  test('should filter records by type', async ({ page }) => {
    // Create a record with specific type
    createdRecordNotes = `Specific type record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');

    // Select type
    const typeOption = page.locator('input[name="type"][value="btc_hh_eth_lh"]');
    await typeOption.check();

    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

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
    await page.fill('#notes', createdRecordNotes);
    await page.fill('#tags', 'important,test');
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

    // Filter by tag
    await page.fill('#tag-filter', 'important');

    // Wait for filter
    await page.waitForTimeout(200);

    // Verify record is visible
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });

  test('should display MSB status in table', async ({ page }) => {
    // Create a record with MSB
    createdRecordNotes = `Record with MSB ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');

    // Check MSB=yes
    const msbYes = page.locator('input[name="msb"][value="yes"]');
    await msbYes.check();

    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

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
    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

    // Click "查看K線" button on the row we created
    const recordRow = page.locator(`tr:has-text("${createdRecordNotes}")`).first();
    const viewButton = recordRow.locator('button[data-action="view-chart"]');
    await viewButton.click();

    // Should navigate to charts.html with time parameters
    await page.waitForURL(/\/charts\.html/);
    expect(page.url()).toContain('start=');
    expect(page.url()).toContain('end=');
  });

  test('should persist records across navigation', async ({ page }) => {
    // Create a record
    createdRecordNotes = `Persistent record ${Date.now()}`;
    await page.click('#new-record');
    await page.waitForSelector('#record-dialog[open]');
    await page.fill('#notes', createdRecordNotes);
    await page.click('#save-record');
    await page.waitForSelector('#record-dialog:not([open])');

    // Navigate to charts and back
    await page.goto('/charts.html');
    await page.goto('/');

    // Record should still be there
    await expect(page.locator(`text=${createdRecordNotes}`)).toBeVisible();
  });
});
