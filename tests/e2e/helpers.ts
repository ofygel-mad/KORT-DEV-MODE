import { expect, type Page } from '@playwright/test';

async function setInputValue(page: Page, placeholder: string, value: string) {
  const input = page.getByPlaceholder(placeholder);
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill(value);
}

async function triggerClickByRole(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
}

export async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
  });
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto('/auth/login', { waitUntil: 'load' });
  await page.evaluate(async () => {
    try {
      const auth = await import('/src/shared/stores/auth.ts');
      auth.useAuthStore.getState().clearAuth();
    } catch {
      // Ignore while the app bundle is still booting.
    }

    try {
      const pin = await import('/src/shared/stores/pin.ts');
      pin.usePinStore.getState().clearPin();
    } catch {
      // Ignore while the app bundle is still booting.
    }

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
  });
  await page.reload({ waitUntil: 'load' });
  await page.goto('/auth/login', { waitUntil: 'load' });
  await expect(page).toHaveURL(/\/auth\/login$/);
}

export async function navigateWithinApp(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

export async function loginAs(page: Page, email: string, password = 'demo1234') {
  await preparePage(page);
  await clearSession(page);
  await setInputValue(page, 'Email или номер телефона', email);
  await setInputValue(page, 'Пароль', password);
  await triggerClickByRole(page, 'Войти');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 });
}
