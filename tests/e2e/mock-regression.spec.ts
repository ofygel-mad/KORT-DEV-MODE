import { expect, test } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('seeded customer opens in CRM drawer', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/crm/customers');

  await page.getByRole('cell', { name: 'Айдана Бекова' }).click();

  await expect(page.getByRole('link', { name: 'aidana@example.kz' })).toBeVisible();
});

test('team settings show seeded employees', async ({ page }) => {
  await loginAs(page, 'admin@kort.local');
  await navigateWithinApp(page, '/settings/team');

  await expect(page.getByRole('tab', { name: 'Команда' })).toBeVisible();
  await expect(page.getByText('Активные сотрудники компании')).toBeVisible();
  await expect(page.getByText('Дана Оспанова')).toBeVisible();
});
