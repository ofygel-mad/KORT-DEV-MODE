import { test, expect } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

test('login screen exposes primary auth actions', async ({ page }) => {
  await clearSession(page);
  await preparePage(page);
  await page.goto('/auth/login');
  await expect(page.getByPlaceholder('Email или номер телефона')).toBeVisible();
  await expect(page.getByPlaceholder('Пароль')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать компанию' })).toBeVisible();
});
