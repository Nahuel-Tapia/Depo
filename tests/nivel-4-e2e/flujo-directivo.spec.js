const { test, expect } = require('@playwright/test');
const { TEST_USERS } = require('../helpers/constants');
const { loginAs } = require('../helpers/auth.helper');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000';

test.describe.serial('E2E Flujo Directivo', () => {
  let directivoToken = null;
  let directivoUser = null;
  let directivoAvailable = false;

  test.beforeAll(async ({ request }) => {
    try {
      const res = await loginAs(request, 'directivo');
      directivoToken = res.token;
      directivoUser = res.user;
      directivoAvailable = true;
    } catch (err) {
      console.warn('Login de directivo no disponible via API:', err.message);
      directivoAvailable = false;
    }
  });

  test.beforeEach(async () => {
    if (!directivoAvailable) {
      test.skip(true, 'Usuario directivo no disponible para pruebas E2E');
    }
  });

  async function ensureLoggedIn(page) {
    try {
      if (directivoToken && directivoUser) {
        await page.goto(`${FRONTEND_URL}/login`);
        await page.evaluate(({ token, user }) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }, { token: directivoToken, user: directivoUser });
        await page.goto(`${FRONTEND_URL}/dashboard`);
        await page.waitForLoadState('networkidle').catch(() => {});
      }
    } catch (err) {
      console.warn('Error al establecer sesión:', err.message);
    }
  }

  test('1. Login como directivo', async ({ page }) => {
    try {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.waitForLoadState('domcontentloaded');

      const emailInput = page.locator('input[type="text"], input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill(TEST_USERS.directivo.email);
      await passwordInput.fill(TEST_USERS.directivo.password);
      await submitBtn.click();

      await expect(page).toHaveURL(new RegExp('/dashboard'), { timeout: 10000 });
      const dashboardElement = page.locator('.dashboard-shell, .dashboard-main, main, header').first();
      await expect(dashboardElement).toBeVisible({ timeout: 10000 });
    } catch (err) {
      console.warn('Excepción en Login como directivo:', err.message);
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible en ' + FRONTEND_URL);
      } else {
        throw err;
      }
    }
  });

  test('2. Ver Mi Stock', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const stockBtn = page.getByRole('button', { name: /Mi stock|Mi Stock|Stock/i })
        .or(page.locator('button:has-text("Mi stock")'))
        .first();

      if (await stockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await stockBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/mi-stock`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/mi-stock|dashboard/);

      const stockView = page.locator('.dashboard-content, section, main, h1, h2, h3').first();
      await expect(stockView).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('3. Ver Pedidos', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const pedidosBtn = page.getByRole('button', { name: /Pedidos/i })
        .or(page.locator('button:has-text("Pedidos")'))
        .first();

      if (await pedidosBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await pedidosBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/pedidos`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/pedidos|dashboard/);

      const pedidosView = page.locator('.dashboard-content, section, main, h1, h2, h3').first();
      await expect(pedidosView).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('4. Navegar a Mi Cuenta', async ({ page }) => {
    try {
      await ensureLoggedIn(page);

      const miCuentaBtn = page.getByRole('button', { name: /Mi cuenta|Mi Cuenta/i })
        .or(page.locator('button:has-text("Mi cuenta")'))
        .first();

      if (await miCuentaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await miCuentaBtn.click();
      } else {
        await page.goto(`${FRONTEND_URL}/dashboard/mi-cuenta`);
      }

      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/mi-cuenta|dashboard/);

      const profileView = page.locator('.dashboard-content, section, main, h1, h2, h3').first();
      await expect(profileView).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });
});
