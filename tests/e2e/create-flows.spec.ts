import { test, expect } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

test('create customer opens card after submit', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/customers');
  await page.getByRole('button', { name: 'Новый клиент' }).click();
  await page.getByLabel('Имя и фамилия').fill('Тестовый Клиент');
  await page.getByLabel('Телефон').fill('+7 701 555 44 33');
  await page.getByRole('button', { name: 'Создать клиента' }).click();
  await expect(page).toHaveURL(/\/customers\//);
  await expect(page.getByRole('heading', { name: 'Тестовый Клиент' })).toBeVisible();
});

test('create deal opens card after submit', async ({ page }) => {
  await loginAs(page, 'owner@demo.kz');
  await navigateWithinApp(page, '/deals');
  await page.getByRole('button', { name: 'Новая сделка' }).click();
  await page.getByRole('textbox', { name: 'Название сделки*' }).evaluate((element) => {
    const input = element as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, 'Тестовая сделка');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByLabel('Клиент').selectOption({ label: 'Асем Нурланова - ТОО Альфа' });
  await page.getByLabel('Этап сделки').selectOption({ label: 'Квалификация' });
  await page.getByLabel('Сумма').fill('250000');
  await page.getByRole('button', { name: 'Создать сделку' }).click();
  await expect(page).toHaveURL(/\/deals\//);
  await expect(page.getByRole('heading', { name: 'Тестовая сделка' })).toBeVisible();
});
