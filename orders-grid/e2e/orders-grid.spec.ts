import { expect, test } from '@playwright/test';

test('renders the orders grid with paging', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.dx-datagrid')).toBeVisible();

  const rows = page.locator('.dx-datagrid-rowsview .dx-data-row');
  await rows.first().waitFor({ state: 'visible' });
  expect(await rows.count()).toBeGreaterThanOrEqual(10);

  await expect(page.getByText('ORD-10001')).toBeVisible();
  await expect(page.locator('.dx-datagrid-pager')).toContainText('500');
});

test('opens the detail drawer when a row is clicked', async ({ page }) => {
  await page.goto('/');

  const rows = page.locator('.dx-datagrid-rowsview .dx-data-row');
  await rows.first().waitFor({ state: 'visible' });
  await rows.first().click();

  await expect(page.getByTestId('order-drawer')).toBeVisible();
});
