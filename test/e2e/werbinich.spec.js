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

test('Voller Ablauf: Karten verteilen → Diskussion → Auflösung', async ({ page }) => {
  await page.locator('.btn-start').first().click();
  await expect(page.locator('.wbi-card-wrap')).toBeVisible();

  // 1) Karten der Reihe nach verteilen: aufdecken → schließen → Weiter,
  //    bis der „Diskussion starten"-Button erscheint.
  for (let i = 0; i < 20; i++) {
    // aufdecken
    if (await page.locator('.wbi-card-back').isVisible().catch(() => false)) {
      await page.locator('.wbi-card').click();
      await expect(page.locator('.wbi-card-front')).toBeVisible();
    }
    // wieder schließen (Weiter erscheint erst bei geschlossener Karte)
    await page.locator('.wbi-card').click();
    await expect(page.locator('.wbi-card-back')).toBeVisible();
    // Weiter / Diskussion starten
    const btn = page.locator('.wbi-card-wrap .btn-start');
    await expect(btn).toBeVisible();
    const label = (await btn.textContent()) || '';
    await btn.click();
    if (/Diskussion/.test(label)) break;
  }

  // 2) Diskussions-Screen → Auflösung starten
  const resolveBtn = page.locator('.btn-start', { hasText: /Auflösung/ });
  await expect(resolveBtn).toBeVisible();
  await resolveBtn.click();

  // 3) Auflösungs-Screen: jede Zeile hat Ja/Nein-Buttons
  await expect(page.locator('.wbi-resolve-row').first()).toBeVisible();
  const rows = await page.locator('.wbi-resolve-row').count();
  expect(rows).toBeGreaterThanOrEqual(2);
  // Erste Zeile bewerten (✓ Ja) und Statusabzeichen prüfen
  await page.locator('.wbi-resolve-yes').first().click();
  await expect(page.locator('.wbi-resolve-row').first().locator('text=Erraten')).toBeVisible();
});
