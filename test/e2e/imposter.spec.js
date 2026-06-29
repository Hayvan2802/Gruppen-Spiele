import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Imposter' }).click();
  // Warten bis Setup-Screen geladen
  await expect(page.locator('.ninput').first()).toBeVisible();
});

test('Setup-Screen zeigt Spielerfelder', async ({ page }) => {
  const inputs = page.locator('.ninput');
  await expect(inputs.first()).toBeVisible();
  expect(await inputs.count()).toBeGreaterThanOrEqual(3);
});

test('Lokales Spiel starten mit 3 Spielern', async ({ page }) => {
  const inputs = page.locator('.ninput');
  await inputs.nth(0).fill('Alice');
  await inputs.nth(1).fill('Bob');
  await inputs.nth(2).fill('Clara');

  await page.locator('.btn-start').first().click();

  // Karten-Reveal-Screen erscheint
  await expect(page.locator('.rev-card')).toBeVisible();
});

test('Karte antippen zeigt Rolle', async ({ page }) => {
  const inputs = page.locator('.ninput');
  await inputs.nth(0).fill('Alice');
  await inputs.nth(1).fill('Bob');
  await inputs.nth(2).fill('Clara');
  await page.locator('.btn-start').first().click();

  await expect(page.locator('.rev-card')).toBeVisible();
  await page.locator('.rev-card').click();
  await expect(page.locator('.card-front')).toBeVisible();
});
