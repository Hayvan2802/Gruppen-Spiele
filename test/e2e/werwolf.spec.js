import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

// Werwolf ist jetzt eine normale Vue-Komponente derselben App-Instanz (kein
// Shadow-DOM mehr) — die CSS-Isolation läuft über die Klasse .wwapp.
test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Werwolf' }).click();
  // Werwolf-Komponente inline sichtbar (kein #ww-host / Shadow-DOM)
  await expect(page.locator('.wwapp')).toBeVisible({ timeout: 10000 });
});

test('Werwolf-Screen öffnet sich inline (ohne Shadow-DOM)', async ({ page }) => {
  await expect(page.locator('.wwapp')).toBeVisible();
  await expect(page.locator('.wwapp .logo-moon')).toBeVisible();
  // Kein Shadow-Host mehr im DOM
  expect(await page.locator('#ww-host').count()).toBe(0);
});

test('Reaktivität funktioniert in der geteilten Vue-Instanz', async ({ page }) => {
  const num = page.locator('.wwapp .pc-num');
  await expect(num).toHaveText('8');
  // "+"-Button ist der zweite .cnt-btn in der Spielerzahl-Zeile
  await page.locator('.wwapp .pc-row .cnt-btn').nth(1).click();
  await expect(num).toHaveText('9');
});

test('Werwolf-CSS ist korrekt eingebettet (.wwapp-Scope greift)', async ({ page }) => {
  // Der Start-Button trägt die Werwolf-typische Optik (Verlauf, nicht Haupt-App-CSS).
  const bg = await page.locator('.wwapp .btn-start').evaluate(
    el => getComputedStyle(el).backgroundImage
  );
  expect(bg).toContain('gradient');
});

test('Zurück-Button erscheint und führt zur Spielauswahl', async ({ page }) => {
  await expect(page.locator('.back-corner')).toBeVisible({ timeout: 10000 });
  await page.locator('.back-corner').click();
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible();
});
