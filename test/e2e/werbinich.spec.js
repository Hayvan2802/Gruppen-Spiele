import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Wer bin ich?' }).click();
  // Warten bis Setup-Screen geladen
  await expect(page.locator('.ninput').first()).toBeVisible();
});

test('Setup-Screen zeigt Spielerfelder', async ({ page }) => {
  const inputs = page.locator('.ninput');
  await expect(inputs.first()).toBeVisible();
  expect(await inputs.count()).toBeGreaterThanOrEqual(2);
});

test('Lokales Spiel starten', async ({ page }) => {
  await page.locator('.btn-start').first().click();

  // Karten-Verteil-Screen erscheint
  await expect(page.locator('.wbi-card-wrap')).toBeVisible();
});

test('Karte antippen zeigt Begriff', async ({ page }) => {
  await page.locator('.btn-start').first().click();

  await expect(page.locator('.wbi-card-wrap')).toBeVisible();
  await page.locator('.wbi-card').click();
  await expect(page.locator('.wbi-card-front')).toBeVisible();
});
