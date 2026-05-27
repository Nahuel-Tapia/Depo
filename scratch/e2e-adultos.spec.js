const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.setTimeout(120000); // 2 minutes timeout for the whole test

const SCREENSHOT_DIR = 'C:\\Users\\Docente\\.gemini\\antigravity\\brain\\071f853f-d13f-4989-9878-d4028ccd3327';

// Ensure the target screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test('Adultos Annual Request E2E Flow', async ({ page }) => {
  // Handle alert dialogs (very important for Director approval which uses alert() and reload)
  page.on('dialog', async dialog => {
    console.log(`[Dialog] Message: ${dialog.message()}`);
    await dialog.accept();
  });

  // ----------------------------------------------------
  // 1. LOGIN & CREATE REQUEST AS DIRECTIVO
  // ----------------------------------------------------
  console.log('--- STEP 1: Logging in as Directivo ---');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('input[type="text"]');
  
  await page.fill('input[type="text"]', 'directivoadultos@gmail.com');
  await page.fill('input[type="password"]', '111111');
  await page.click('button[type="submit"]');

  // Wait for login to complete and dashboard to load
  await page.waitForSelector('button.dashboard-logout');
  console.log('Directivo logged in.');

  // Take screenshot of the Directivo dashboard
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_directivo_dashboard.png'), fullPage: true });
  console.log('Directivo dashboard screenshot saved.');

  // Go to Pedidos tab
  await page.click('button:has-text("Pedidos")');
  await page.waitForTimeout(2000);

  // Clean up existing pending/blocking requests if any, to make test repeatable
  const cancelBtn = page.locator('button.sv-btn-rechazar:has-text("Cancelar")').first();
  if (await cancelBtn.isVisible()) {
    console.log('Found an existing pending request. Cancelling it to start fresh...');
    await cancelBtn.click();
    await page.waitForTimeout(2000);
  }

  // Click "Nueva solicitud"
  console.log('Creating new annual request...');
  await page.click('button:has-text("Nueva solicitud")');
  await page.waitForSelector('select');

  // Select the first kit option (Kit 3 or any available kit)
  const selectLocator = page.locator('select');
  await selectLocator.selectOption({ index: 1 });
  
  // Fill observations notes
  await page.fill('input[placeholder="Observaciones del pedido"]', 'E2E Test Request for Adultos');

  // Take screenshot of the request creation modal/form
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_directivo_request_creation.png'), fullPage: true });
  console.log('Request creation form screenshot saved.');

  // Submit request
  await page.click('button[type="submit"]:has-text("Crear solicitud")');
  await page.waitForTimeout(3000); // Wait for API response and table reload

  // Take screenshot of the table with the pending request
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_directivo_request_submitted.png'), fullPage: true });
  console.log('Request submitted screenshot saved.');

  // Logout
  await page.click('button.dashboard-logout');
  await page.waitForSelector('button[type="submit"]:has-text("Iniciar sesión")');
  console.log('Directivo logged out.');

  // ----------------------------------------------------
  // 2. LOGIN & APPROVE AS SUPERVISOR
  // ----------------------------------------------------
  console.log('--- STEP 2: Logging in as Supervisor ---');
  await page.fill('input[type="text"]', 'supadul@gmail');
  await page.fill('input[type="password"]', '111111');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForSelector('button.dashboard-logout');
  console.log('Supervisor logged in.');

  // Go to Pedidos tab
  await page.click('button:has-text("Pedidos")');
  await page.waitForTimeout(2000);

  // Locate the school row and click "Ver detalle"
  console.log('Locating the pending request...');
  const verDetalleBtn = page.locator('button.sv-btn-ver:has-text("Ver detalle")').first();
  await verDetalleBtn.click();
  await page.waitForSelector('button:has-text("Aceptar solicitud")');

  // Take screenshot of the approval modal
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_supervisor_request_modal.png'), fullPage: true });
  console.log('Supervisor detail modal screenshot saved.');

  // Click "Aceptar solicitud" to approve
  console.log('Approving request as Supervisor...');
  await page.click('button:has-text("Aceptar solicitud")');
  await page.waitForTimeout(3000); // Wait for approval API and UI update

  // Take screenshot after supervisor approved
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_supervisor_approved.png'), fullPage: true });
  console.log('Supervisor approved screenshot saved.');

  // Close modal if still open
  const closeBtn = page.locator('button:has-text("Cerrar")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }

  // Logout
  await page.click('button.dashboard-logout');
  await page.waitForSelector('button[type="submit"]:has-text("Iniciar sesión")');
  console.log('Supervisor logged out.');

  // ----------------------------------------------------
  // 3. LOGIN, APPROVE, CONSOLIDATE & SEND AS DIRECTOR
  // ----------------------------------------------------
  console.log('--- STEP 3: Logging in as Director de Área ---');
  await page.fill('input[type="text"]', 'diradultos@gmail.com');
  await page.fill('input[type="password"]', '111111');
  await page.click('button[type="submit"]');

  // Wait for login
  await page.waitForSelector('button.dashboard-logout');
  console.log('Director de Área logged in.');

  // Go to Pedidos tab
  await page.click('button:has-text("Pedidos")');
  await page.waitForTimeout(2000);

  // Click "Gestionar" for the pending request
  console.log('Locating request to approve...');
  const gestionarBtn = page.locator('button:has-text("Gestionar")').first();
  await gestionarBtn.click();
  await page.waitForSelector('button:has-text("Aprobar Solicitud")');

  // Take screenshot of the Director approval modal
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_director_approval_modal.png'), fullPage: true });
  console.log('Director approval modal screenshot saved.');

  // Click "Aprobar Solicitud" (will trigger alert dialog handled above)
  console.log('Approving request as Director...');
  await page.click('button:has-text("Aprobar Solicitud")');
  await page.waitForLoadState('load'); // Wait for reload
  await page.waitForTimeout(3000);

  // Go to "Resumen Solicitud Anual" tab
  await page.click('button:has-text("Resumen Solicitud Anual")');
  await page.waitForTimeout(2000);

  // Take screenshot of the Resumen dashboard before sending
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_director_resumen_before_send.png'), fullPage: true });
  console.log('Resumen dashboard screenshot saved.');

  // Click "Enviar a Compras" (or "🚀 Enviar a Compras")
  console.log('Consolidating and sending to Compras...');
  await page.click('button:has-text("Enviar a Compras")');
  await page.waitForTimeout(2000);

  // Handle warning modal if there are pending schools
  const confirmSendBtn = page.locator('button:has-text("Enviar de todos modos")');
  if (await confirmSendBtn.isVisible()) {
    console.log('Warning modal appeared (some schools pending). Confirming send to Compras...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_director_warning_modal.png'), fullPage: true });
    await confirmSendBtn.click();
    await page.waitForTimeout(3000);
  }

  // Take final screenshot of the planilla state (should show "Enviado a Compras")
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_director_planilla_sent.png'), fullPage: true });
  console.log('Final planilla sent screenshot saved.');

  // Logout
  await page.click('button.dashboard-logout');
  console.log('Test flow completed successfully!');
});
