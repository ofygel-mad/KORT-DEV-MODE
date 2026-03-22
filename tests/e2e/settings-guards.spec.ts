import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test('pending membership lands on company-access gate after login', async ({ page }) => {
  await loginAs(page, 'pending@demo.kz');
  await expect(page).toHaveURL(/\/settings\/company-access$/);
  await expect(page.getByText('Ожидайте подтверждения администратора')).toBeVisible();
});
