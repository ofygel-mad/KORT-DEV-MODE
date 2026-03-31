import { expect, test } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('create customer adds a new row in CRM customers', async ({ page }) => {
  const customerName = `Тестовый клиент ${Date.now()}`;

  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/customers');

  await page.getByRole('button', { name: 'Добавить' }).click();
  await page.getByPlaceholder('Имя *').fill(customerName);
  await page.getByPlaceholder('Телефон').fill('+7 701 555 44 33');
  await page.getByRole('button', { name: 'Создать' }).click();

  await expect(page.getByRole('cell', { name: customerName })).toBeVisible();
});

test('create deal adds a new card in CRM deals', async ({ page }) => {
  const dealTitle = `Тестовая сделка ${Date.now()}`;

  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/deals');

  await page.getByRole('button', { name: 'Новая сделка' }).click();
  await page.getByPlaceholder('Название сделки...').fill(dealTitle);
  await page.getByRole('button', { name: 'Создать' }).click();

  await expect(page.getByRole('button', { name: new RegExp(dealTitle) })).toBeVisible();
});
