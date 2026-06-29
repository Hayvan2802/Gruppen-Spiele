import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers.js';

test('App lädt und zeigt alle Spiele', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('.game-select-name', { hasText: 'Imposter' })).toBeVisible();
  await expect(page.locator('.game-select-name', { hasText: 'Wer bin ich?' })).toBeVisible();
  await expect(page.locator('.game-select-name', { hasText: 'Codenames' })).toBeVisible();
  await expect(page.locator('.game-select-name', { hasText: 'Werwolf' })).toBeVisible();
});

test('Navigation zu Imposter-Setup und zurück', async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Imposter' }).click();
  await expect(page.locator('.back-corner')).toBeVisible();
  await page.locator('.back-corner').click();
  await expect(page.locator('.game-select-name', { hasText: 'Imposter' })).toBeVisible();
});

test('Navigation zu Wer bin ich?', async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Wer bin ich?' }).click();
  await expect(page.locator('.back-corner')).toBeVisible();
});

test('Navigation zu Codenames', async ({ page }) => {
  await waitForApp(page);
  await page.locator('.game-select-card', { hasText: 'Codenames' }).click();
  await expect(page.locator('.back-corner')).toBeVisible();
});
