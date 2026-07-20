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

test('Start ist ohne Rollen-Konfiguration deaktiviert', async ({ page }) => {
  // Standardmäßig sind keine Rollen gewählt → Start disabled + Warnhinweis
  await expect(page.locator('.wwapp .btn-start')).toBeDisabled();
  await expect(page.locator('.wwapp .swarn')).toBeVisible();
});

test('Voller Ablauf: Rollen wählen → Start → Reveal → Spielscreen', async ({ page }) => {
  // 1) Rollen konfigurieren: 1 Wolf + 7 Dorfbewohner = 8 Spieler
  await page.locator('.wwapp .rcard', { hasText: 'Werwolf' }).first().click();
  const dorf = page.locator('.wwapp .rcard', { hasText: 'Dorfbewohner' }).first();
  await dorf.click(); // → 1
  for (let k = 0; k < 6; k++) {
    await dorf.locator('.mbtn').nth(1).click(); // „+" bis 7
  }

  // Start jetzt aktiv
  const start = page.locator('.wwapp .btn-start');
  await expect(start).toBeEnabled();
  await start.click();

  // 2) Rollen-Reveal: alle Karten aufdecken
  await expect(page.locator('.wwapp .rev-card')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    if (await page.locator('.wwapp .rev-card .card-back').isVisible().catch(() => false)) {
      await page.locator('.wwapp .rev-card .card-back').click();
    }
    const next = page.locator('.wwapp .btn-nxt');
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    } else {
      break;
    }
  }

  // 3) Spielscreen Nacht 1 erreicht
  await expect(page.locator('.wwapp .game-inner')).toBeVisible();
  await expect(page.locator('.wwapp .phase-badge')).toContainText(/Nacht/);
  // „Nachtphase beginnen"-Button vorhanden
  await expect(page.locator('.wwapp .nseq .bpri')).toBeVisible();
});
