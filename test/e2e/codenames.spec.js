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

test('Spymaster-Panel: Hinweis mit Zahl geben', async ({ page }) => {
  await page.locator('.btn-start').first().click();
  await expect(page.locator('.cn-grid')).toBeVisible();

  // Spymaster-Panel mit Hinweis-Eingabe + Zahlen-Buttons
  const panel = page.locator('.cn-spymaster-panel');
  await expect(panel).toBeVisible();
  const clue = panel.locator('input.name-input-big');
  await expect(clue).toBeVisible();

  // Hinweis-Wort + Zahl wählen
  await clue.fill('Tier');
  await panel.locator('.imposter-btn', { hasText: '3' }).click();

  // Hinweis geben → Phase wechselt zum Raten
  const give = panel.locator('button', { hasText: /Hinweis geben/ });
  await expect(give).toBeEnabled();
  await give.click();

  // Nach dem Hinweis rät das Team → Eingabefeld ist verschwunden
  await expect(clue).toHaveCount(0);
});

test('Geheimkarte ein-/ausblenden funktioniert', async ({ page }) => {
  await page.locator('.btn-start').first().click();
  await expect(page.locator('.cn-grid')).toBeVisible();
  const toggle = page.locator('.cn-spymaster-panel button', { hasText: /Verbergen|Karte zeigen/ });
  await expect(toggle).toBeVisible();
  const before = (await toggle.textContent()) || '';
  await toggle.click();
  await expect(toggle).not.toHaveText(before);
});
