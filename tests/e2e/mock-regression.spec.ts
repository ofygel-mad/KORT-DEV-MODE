import { test, expect } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('quick create deal works in mock mode board flow', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/deals');
  await page.getByRole('button', { name: 'Новая сделка' }).click();
  await page.getByRole('textbox', { name: 'Название сделки*' }).evaluate((element) => {
    const input = element as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, 'Mock regression deal');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByLabel('Клиент').selectOption({ label: 'Асем Нурланова - ТОО Альфа' });
  await page.getByLabel('Этап сделки').selectOption({ label: 'Переговоры' });
  await page.getByRole('button', { name: 'Создать сделку' }).click();
  await expect(page).toHaveURL(/\/deals\//);
});

test('owner can open team settings in mock mode', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/settings/team');
  await expect(page.getByRole('tab', { name: 'Команда' })).toBeVisible();
  await expect(page.getByText('Активные сотрудники компании')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'owner@demo.kz' })).toBeVisible();
});
