import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Werwolf' }).click();
  // Warten bis Werwolf-Container sichtbar ist
  await expect(page.locator('#ww-host')).toBeVisible({ timeout: 10000 });
});

test('Werwolf-Screen öffnet sich', async ({ page }) => {
  await expect(page.locator('#ww-host')).toBeVisible();
});

test('Zurück-Button erscheint nach Laden', async ({ page }) => {
  // Werwolf meldet wwScreen='home' via Custom Event → Haupt-App zeigt ←-Button
  await expect(page.locator('.back-corner')).toBeVisible({ timeout: 10000 });
});

test('Navigation zurück zur Spielauswahl', async ({ page }) => {
  await expect(page.locator('.back-corner')).toBeVisible({ timeout: 10000 });
  await page.locator('.back-corner').click();
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible();
});

test('Werwolf-App-Inhalt im Shadow-DOM geladen', async ({ page }) => {
  // Prüft ob die Werwolf-Sub-App gemountet und sichtbar ist
  const hasContent = await page.evaluate(() => {
    const host = document.querySelector('#ww-host');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.ww-root'));
  });
  expect(hasContent).toBe(true);
});
