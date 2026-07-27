const { test, expect } = require('@playwright/test');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

test.describe('E2E Flujo Registro', () => {
  test('1. Página de registro es accesible', async ({ page }) => {
    try {
      await page.goto(`${FRONTEND_URL}/registro`);
      await page.waitForLoadState('domcontentloaded');

      const registerForm = page.locator('form').first();
      await expect(registerForm).toBeVisible({ timeout: 10000 });

      const heading = page.locator('h1, h2, .auth-header').first();
      await expect(heading).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible en ' + FRONTEND_URL);
      } else {
        throw err;
      }
    }
  });

  test('2. Formulario tiene campos necesarios', async ({ page }) => {
    try {
      await page.goto(`${FRONTEND_URL}/registro`);
      await page.waitForLoadState('domcontentloaded');

      const cueInput = page.locator('input[placeholder*="9 dígitos"], input[maxLength="9"]').first();
      await expect(cueInput).toBeVisible();

      const nombreInput = page.locator('input[placeholder*="María Gómez"], input[type="text"]').first();
      await expect(nombreInput).toBeVisible();

      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible();

      const passwordInput = page.locator('input[type="password"]').first();
      await expect(passwordInput).toBeVisible();
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });

  test('3. Validación de CUE inválido', async ({ page }) => {
    try {
      await page.goto(`${FRONTEND_URL}/registro`);
      await page.waitForLoadState('domcontentloaded');

      const cueInput = page.locator('input[placeholder*="9 dígitos"], input[maxLength="9"]').first();
      await cueInput.fill('123');
      await cueInput.blur();

      const nombreInput = page.locator('input[placeholder*="María Gómez"], input[type="text"]').first();
      await nombreInput.fill('Usuario Test');

      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill('test@ejemplo.com');

      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('123456');

      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      const isInvalid = await cueInput.evaluate(el => !el.checkValidity());
      const msgError = page.locator('.msg-error, .msg');
      const isErrorVisible = await msgError.isVisible().catch(() => false);

      expect(isInvalid || isErrorVisible).toBe(true);
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('net::ERR_CONNECTION_REFUSED')) {
        test.skip(true, 'Frontend server no disponible');
      } else {
        throw err;
      }
    }
  });
});
