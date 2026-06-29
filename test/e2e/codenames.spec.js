import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Codenames' }).click();
  // Warten bis Setup-Screen geladen
  await expect(page.locator('.btn-start').first()).toBeVisible();
});

test('Setup-Screen zeigt Sprach-Buttons und Start-Button', async ({ page }) => {
  // Sprach-Buttons vorhanden
  await expect(page.locator('.btn-sec', { hasText: 'Deutsch' })).toBeVisible();
  // Start-Button vorhanden
  await expect(page.locator('.btn-start').first()).toBeVisible();
});

test('Lokales Spiel starten zeigt Wortraster', async ({ page }) => {
  await page.locator('.btn-start').first().click();

  // Wortraster erscheint
  await expect(page.locator('.cn-grid')).toBeVisible();
  // Mindestens 25 Karten
  const cards = page.locator('.cn-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(25);
});
