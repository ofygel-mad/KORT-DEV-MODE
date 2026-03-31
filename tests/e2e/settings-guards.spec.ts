import { expect, test } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('pending first-login employee is redirected to set password step', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);
  await page.goto('/auth/login');

  await page.getByPlaceholder('Email или номер телефона').fill('+77010000003');
  await page.getByPlaceholder('Пароль').fill('+77010000003');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page.getByText(/установите пароль/i)).toBeVisible();
  await expect(page.getByText(/после сохранения войдите заново/i)).toBeVisible();
});
