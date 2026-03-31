import { expect, test } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('company registration creates an account that can log in again', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);

  const unique = Date.now();
  const companyName = `Тестовая компания ${unique}`;
  const ownerName = `Тестовый руководитель ${unique}`;
  const email = `owner+${unique}@demo.kz`;
  const password = 'superpass1';

  await page.goto('/auth/register');

  let fields = page.locator('form input');
  await expect(fields).toHaveCount(6);

  await fields.nth(0).fill(companyName);
  await fields.nth(1).fill(ownerName);
  await fields.nth(2).fill(email);
  await fields.nth(4).fill(password);
  await fields.nth(5).fill(password);

  await page.getByRole('button', { name: 'Создать компанию' }).click();
  await expect(page).not.toHaveURL(/\/auth\/register$/);

  await clearSession(page);
  await page.goto('/auth/login');

  fields = page.locator('form input');
  await expect(fields).toHaveCount(2);

  await fields.nth(0).fill(email);
  await fields.nth(1).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page).not.toHaveURL(/\/auth\/login$/);
});
