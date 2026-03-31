import { chromium, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, '.auth');

async function globalSetup() {
  // Create .auth directory if it doesn't exist
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('🔴 Browser console error:', msg.text());
    });

    // Navigate to login page
    console.log('📍 Navigating to login page...');
    await page.goto('http://127.0.0.1:4173/auth/login', { waitUntil: 'networkidle' });
    console.log('✅ Login page loaded');

    // Test credentials for CI/E2E tests
    const email = 'admin@kort.local';
    const password = 'demo1234';

    // Fill in login form
    console.log('🔑 Filling login form...');
    await page.getByPlaceholder('Email или номер телефона').fill(email);
    await page.getByPlaceholder('Пароль').fill(password);

    // Submit form (use exact: true to avoid matching PIN button)
    console.log('📤 Submitting login form...');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();

    // Wait for navigation away from login page
    console.log('⏳ Waiting for redirect from login page (30s timeout)...');
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });
    console.log('✅ Successfully redirected from login page');

    // Add intro flag to sessionStorage (from helpers)
    await page.evaluate(() => {
      window.sessionStorage.setItem('kort.workspace:intro-v1', '1');
    });

    // Save state for chromium, firefox, and webkit
    const state = await page.context().storageState();

    // For chromium, save the auth state
    fs.writeFileSync(path.join(authDir, 'chromium.json'), JSON.stringify(state, null, 2));

    // For firefox and webkit, we can use the same auth state since it's browser-agnostic
    fs.writeFileSync(path.join(authDir, 'firefox.json'), JSON.stringify(state, null, 2));
    fs.writeFileSync(path.join(authDir, 'webkit.json'), JSON.stringify(state, null, 2));

    console.log('✅ Global setup: Authentication successful');
    console.log(`✅ Saved auth state to ${authDir}`);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw new Error('Failed to authenticate during global setup');
  } finally {
    await browser.close();
  }
}

export default globalSetup;
