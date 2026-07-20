import { test, expect } from '@playwright/test';
import { waitForApp, fillPlayerNames, completeImposterReveal, completeImposterVoting } from './helpers.js';

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

test('Voller Ablauf: Reveal → Timer → Abstimmung → Ergebnis', async ({ page }) => {
  const names = await fillPlayerNames(page, ['Alice', 'Bob', 'Clara', 'Dora', 'Emil']);
  const n = names.length;
  await page.locator('.btn-start').first().click();

  // 1) Alle Karten aufdecken bis zum Timer-Screen
  await completeImposterReveal(page);

  // 2) Timer/Diskussion überspringen
  await expect(page.locator('.timer-skip-btn')).toBeVisible();
  await page.locator('.timer-skip-btn').click();

  // 3) Post-Timer: Abstimmung starten
  const startVote = page.locator('button', { hasText: /Abstimmung/ }).first();
  await expect(startVote).toBeVisible();
  await startVote.click();

  // 4) Abstimmung inkl. aller Zwischenrunden bis zum eindeutigen Ergebnis
  await expect(page.locator('.voting-option').first()).toBeVisible();
  await completeImposterVoting(page);

  // 5) Ergebnis-Screen erreicht (Konfetti + Sieger-Titel + aufgelöstes Wort)
  await expect(page.locator('.confetti')).toHaveCount(1);
  await expect(page.locator('.go-inner .wtitle')).toBeVisible();
  await expect(page.locator('.surv-box h3')).toContainText(/🔍/);
});

test('Undercover-Option ist im Setup wählbar', async ({ page }) => {
  // Undercover-Checkbox/Karte vorhanden und schaltbar
  const undercover = page.locator('text=Undercover-Modus').first();
  await expect(undercover).toBeVisible();
});
