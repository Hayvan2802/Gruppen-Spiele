import { test, expect } from '@playwright/test';
import { waitForApp, switchToMultiplayer } from './helpers.js';

// Multiplayer-Lobby-UI aller Spiele (reine Oberflächen-Prüfung — ohne echte
// Firebase-Verbindung, die im CI/Sandbox nicht erreichbar ist). Geprüft wird,
// dass Modus-Wechsel, Host-Formular und Beitreten-Formular korrekt rendern.

test.beforeEach(async ({ page }) => {
  await waitForApp(page);
});

for (const game of ['Imposter', 'Wer bin ich?', 'Codenames']) {
  test(`${game}: Multiplayer-Host-Formular rendert`, async ({ page }) => {
    await page.locator('.game-select-card', { hasText: game }).click();
    await switchToMultiplayer(page);

    // Coop-Box mit „Raum erstellen"/„Beitreten"
    const create = page.locator('button', { hasText: /Raum erstellen/ }).first();
    await expect(create).toBeVisible();
    await create.click();

    // Host-Setup: Namensfeld + 6-stelliger Raumcode
    const name = page.locator('.name-input-big').first();
    const code = page.locator('.code-input').first();
    await expect(name).toBeVisible();
    await expect(code).toBeVisible();

    // Ausgefüllt → „Raum erstellen" aktiv (Klick löst nur Firebase aus, wird
    // hier nicht ausgeführt — geprüft wird nur der aktivierte Zustand).
    await name.fill('TestHost');
    await code.fill('123456');
    const createBtn = page.locator('button', { hasText: /Raum erstellen/ }).last();
    await expect(createBtn).toBeEnabled();
  });

  test(`${game}: Multiplayer-Beitreten-Formular rendert`, async ({ page }) => {
    await page.locator('.game-select-card', { hasText: game }).click();
    await switchToMultiplayer(page);

    const join = page.locator('button', { hasText: /Beitreten/ }).first();
    await expect(join).toBeVisible();
    await join.click();

    // Beitreten-Setup: Namensfeld + Codefeld vorhanden
    await expect(page.locator('.name-input-big').first()).toBeVisible();
    await expect(page.locator('.code-input').first()).toBeVisible();
  });
}

test('Werwolf: Multiplayer-Lobby rendert (Host/Beitreten)', async ({ page }) => {
  await page.locator('.game-select-card', { hasText: 'Werwolf' }).click();
  await expect(page.locator('.wwapp')).toBeVisible({ timeout: 10000 });

  // Werwolf-Modus-Karte „Multiplayer" wählen
  await page.locator('.wwapp').getByText('Multiplayer').first().click();

  // Host- und Beitreten-Buttons vorhanden
  await expect(page.locator('.wwapp button', { hasText: /Host/ }).first()).toBeVisible();
  await expect(page.locator('.wwapp button', { hasText: /Beitreten/ }).first()).toBeVisible();

  // Host öffnet das Namens-/Code-Formular (Namensfeld + 6-stelliger Code)
  await page.locator('.wwapp button', { hasText: /Host/ }).first().click();
  await expect(page.locator('.wwapp .name-input-big').first()).toBeVisible();
  await expect(page.locator('.wwapp .code-input').first()).toBeVisible();
});
