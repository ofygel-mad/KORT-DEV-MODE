import { test, expect } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('customer card can be edited from drawer', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/customers/c-001');
  await page.getByRole('button', { name: 'Изменить' }).click();
  await page.getByLabel('Имя и фамилия').fill('Тестовый клиент обновлён');
  await page.locator('button[form="customer-edit-form"]').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: 'Тестовый клиент обновлён' })).toBeVisible();
});

test('deal card can be edited from drawer', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/deals/d-001');
  await page.getByRole('button', { name: 'Редактировать' }).click();
  await page.getByLabel('Название').fill('Сделка обновлена');
  await page.locator('button[form="deal-edit-form"]').evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: 'Сделка обновлена' })).toBeVisible();
});
