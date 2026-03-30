import { expect, type Page } from '@playwright/test';

async function setInputValue(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value);
}

async function triggerClickByRole(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}

export async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
  });
}

export async function navigateWithinApp(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

export async function loginAs(page: Page, email: string, password = 'demo') {
  await preparePage(page);
  await page.goto('/auth/login');
  await setInputValue(page, 'Email или номер телефона', email);
  await setInputValue(page, 'Пароль', password);
  await triggerClickByRole(page, 'Войти');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });
}
