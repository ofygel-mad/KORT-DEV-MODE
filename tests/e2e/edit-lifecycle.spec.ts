import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAs, navigateWithinApp } from './helpers';

const API_BASE_URL = 'http://127.0.0.1:8001/api/v1';
const E2E_EMAIL = 'admin@kort.local';
const E2E_PASSWORD = 'demo1234';
const E2E_ORG_ID = 'org-demo';

async function createDeal(request: APIRequestContext, title: string) {
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const session = await loginResponse.json();
  const headers = {
    Authorization: `Bearer ${session.access}`,
    'X-Org-Id': E2E_ORG_ID,
  };

  const createResponse = await request.post(`${API_BASE_URL}/deals`, {
    data: { title, fullName: 'E2E Client' },
    headers,
  });
  expect(createResponse.ok()).toBeTruthy();

  const createdDeal = await createResponse.json();

  return {
    id: createdDeal.id as string,
    title,
    headers,
  };
}

test('deal stage update from drawer persists in backend', async ({ page, request }) => {
  const deal = await createDeal(request, `Сделка для смены этапа ${Date.now()}`);

  await loginAs(page, E2E_EMAIL);
  await navigateWithinApp(page, '/crm/deals');

  await page.getByRole('button', { name: new RegExp(deal.title) }).click();
  await page.getByRole('button', { name: 'КП' }).click();

  await expect.poll(async () => {
    const response = await request.get(`${API_BASE_URL}/deals/${deal.id}`, {
      headers: deal.headers,
    });
    const body = await response.json();
    return body.stage_id;
  }).toBe('proposal');
});

test('deal comment added in drawer appears in activity feed', async ({ page, request }) => {
  const deal = await createDeal(request, `Сделка для комментария ${Date.now()}`);
  const comment = `Комментарий ${Date.now()}`;

  await loginAs(page, E2E_EMAIL);
  await navigateWithinApp(page, '/crm/deals');

  await page.getByRole('button', { name: new RegExp(deal.title) }).click();
  await page.getByPlaceholder('Добавить комментарий...').fill(comment);
  await page.getByRole('button', { name: '→' }).click();

  await expect(page.getByText(comment)).toBeVisible();

  await expect.poll(async () => {
    const response = await request.get(`${API_BASE_URL}/deals/${deal.id}/activities`, {
      headers: deal.headers,
    });
    const body = await response.json();
    return body.results.some((activity: { content?: string; payload?: { body?: string } }) =>
      activity.content === comment || activity.payload?.body === comment);
  }).toBe(true);
});
