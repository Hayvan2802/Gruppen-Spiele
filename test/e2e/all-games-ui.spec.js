// all-games-ui.spec.js — Umfassender UI-Test ALLER vier Spiele:
//   • Singleplayer (Einzelgerät): Spiel startet und zeigt das Spielbrett
//   • Coop (Multiplayer): Host- UND Beitreten-Setup zeigen die richtigen Felder
//     (Benutzername vorbelegt, Raumcode-Feld, Aktions-Button) — ohne echte
//     Firebase-Verbindung (nur die UI bis zum Verbindungsaufbau)
//   • Konsistenz: jedes Spiel hat dasselbe Einstellungsmenü (Benutzername-Feld +
//     Theme-Buttons „🌙 Dunkel / ☀️ Hell / 🔄 System") und einen Zurück-Button
//
// Firebase ist in der CI/Sandbox nicht erreichbar → wir klicken bewusst NICHT auf
// „Raum erstellen/beitreten" (das würde eine Verbindung aufbauen), sondern prüfen
// nur, dass alle Coop-UI-Elemente vorhanden und korrekt vorbelegt sind.

import { test, expect } from '@playwright/test';
import { waitForApp, openGame } from './helpers.js';

const THEME_LABELS = ['🌙 Dunkel', '☀️ Hell', '🔄 System'];

// Benutzername VOR dem Laden setzen, damit die Coop-Namensfelder vorbelegt sind.
async function seedUserName(page, name) {
  await page.addInitScript((n) => localStorage.setItem('gs_username', JSON.stringify(n)), name);
}

// ── Die drei Haupt-App-Spiele (teilen dieselbe Coop-/Einstellungs-Struktur) ──────
const MAIN_GAMES = [
  { title: 'Imposter',     card: 'Imposter',     board: '.rev-card',      startNames: 3 },
  { title: 'Wer bin ich?', card: 'Wer bin ich?', board: '.wbi-card-wrap', startNames: 0 },
  { title: 'Codenames',    card: 'Codenames',    board: '.cn-grid',       startNames: 0 },
];

for (const g of MAIN_GAMES) {
  test.describe(`${g.title}`, () => {
    test.beforeEach(async ({ page }) => {
      await seedUserName(page, 'Tester');
      await waitForApp(page);
    });

    test(`${g.title}: Singleplayer startet und zeigt das Spiel`, async ({ page }) => {
      await openGame(page, g.card);
      await expect(page.locator('.back-corner')).toBeVisible();
      // Namen ausfüllen falls nötig (Imposter braucht >=3)
      for (let i = 0; i < g.startNames; i++) {
        await page.locator('.ninput').nth(i).fill(`P${i + 1}`);
      }
      await page.locator('.btn-start').first().click();
      await expect(page.locator(g.board)).toBeVisible({ timeout: 8000 });
    });

    test(`${g.title}: Coop-Setup (Host + Beitreten) mit vorbelegtem Namen`, async ({ page }) => {
      await openGame(page, g.card);
      // Multiplayer-Modus wählen (:visible hält den Locator auch bei parallel im DOM
      // vorhandenen, aber ausgeblendeten Spielansichten eindeutig).
      await page.locator('.mode-card:visible', { hasText: 'Multiplayer' }).click();

      // ── Host-Setup ──
      await page.locator('.btn-create-room:visible', { hasText: 'Raum erstellen' }).first().click();
      await expect(page.locator('.name-input-big:visible')).toHaveValue('Tester'); // vorbelegt
      await expect(page.locator('.code-input:visible')).toBeVisible();
      // Aktions-Button vorhanden, aber ohne 6-stelligen Code deaktiviert (kein Connect)
      await expect(page.locator('.btn-create-room:visible', { hasText: 'Raum erstellen' })).toBeDisabled();

      // Zurück zu idle, dann Beitreten-Setup
      await page.locator('.coop-box .btn-sec:visible').last().click();
      await page.locator('.btn-create-room:visible', { hasText: 'Beitreten' }).first().click();
      await expect(page.locator('.name-input-big:visible')).toHaveValue('Tester');
      await expect(page.locator('.code-input:visible')).toBeVisible();
    });

    test(`${g.title}: Einstellungsmenü konsistent (Benutzername + Theme)`, async ({ page }) => {
      await openGame(page, g.card);
      await page.locator('button.icon-btn[title="Einstellungen"]').first().click();
      const drawer = page.locator('.settings-drawer');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('input.ninput[placeholder="Dein Name"]')).toHaveValue('Tester');
      const themes = await drawer.locator('.theme-btn').allTextContents();
      expect(themes.map((t) => t.trim())).toEqual(THEME_LABELS);
    });
  });
}

// ── Werwolf (normale Vue-Komponente derselben App, kein Shadow-DOM) ──────────────
test.describe('Werwolf', () => {
  test.beforeEach(async ({ page }) => {
    await seedUserName(page, 'Tester');
    await waitForApp(page);
    await openGame(page, 'Werwolf');
    await expect(page.locator('.wwapp .screen')).toBeVisible({ timeout: 10000 });
  });

  test('Werwolf: Home lädt inline (kein Shadow-DOM)', async ({ page }) => {
    await expect(page.locator('.wwapp .logo-moon')).toBeVisible();
    // Kein Shadow-Host mehr im DOM
    expect(await page.locator('#ww-host').count()).toBe(0);
  });

  test('Werwolf: Coop-Setup (Host + Beitreten) vorhanden', async ({ page }) => {
    await expect(page.locator('.wwapp .mode-card')).toHaveCount(2);
    // Multiplayer-Modus (zweite Karte) wählen
    await page.locator('.wwapp .mode-card').nth(1).click();
    // Host- und Beitreten-Buttons erscheinen
    await expect(page.locator('.wwapp').getByRole('button', { name: /Host|👑/ }).first()).toBeVisible();
    await expect(page.locator('.wwapp').getByRole('button', { name: /Beitreten|🚪/ }).first()).toBeVisible();
  });

  test('Werwolf: ⚙️ öffnet das GEMEINSAME Einstellungsmenü der Haupt-App', async ({ page }) => {
    // Kein Statistik-Button (📊) in der Werwolf-Topbar
    await expect(page.locator('.wwapp .top-bar', { hasText: '📊' })).toHaveCount(0);
    // Werwolf-Zahnrad öffnet NICHT ein eigenes, sondern das Haupt-App-Menü
    await page.locator('.wwapp .top-bar button.icon-btn').click();
    const drawer = page.locator('.settings-drawer'); // gemeinsames Menü (außerhalb .wwapp)
    await expect(drawer).toBeVisible();
    // Werwolf hat kein eigenes Settings-Menü mehr geöffnet
    await expect(page.locator('.wwapp .settings-drawer')).toHaveCount(0);
    await expect(drawer.locator('input.ninput[placeholder="Dein Name"]')).toHaveValue('Tester');
    const themes = await drawer.locator('.theme-btn').allTextContents();
    expect(themes.map((t) => t.trim())).toEqual(THEME_LABELS);
  });
});

// ── Dark/Light: Theme der Haupt-App gilt auch fürs eingebettete Werwolf ───────────
// Werwolf folgt dem Theme reaktiv über das :theme-Prop → Klasse .wwapp.light.
test('Theme-Wechsel (Hell/Dunkel) gilt konsistent auch für Werwolf', async ({ page }) => {
  await waitForApp(page);

  // Auf Hell schalten (Haupt-App-Einstellungen) → body hell
  await page.locator('button.icon-btn[title="Einstellungen"]').first().click();
  await page.locator('.settings-drawer .theme-btn', { hasText: 'Hell' }).click();
  await expect(page.locator('body')).toHaveClass(/light/);
  await page.locator('.settings-drawer .drawer-head .icon-btn').click(); // ✕ schließen
  await expect(page.locator('.settings-drawer')).toBeHidden();

  // Werwolf öffnen → Wurzel .wwapp trägt ebenfalls .light
  await openGame(page, 'Werwolf');
  await expect(page.locator('.wwapp.light')).toBeVisible({ timeout: 10000 });

  // Zurück, auf Dunkel schalten
  await page.locator('.back-corner').click();
  await page.locator('button.icon-btn[title="Einstellungen"]').first().click();
  await page.locator('.settings-drawer .theme-btn', { hasText: 'Dunkel' }).click();
  await expect(page.locator('body')).not.toHaveClass(/light/);
  await page.locator('.settings-drawer .drawer-head .icon-btn').click(); // ✕ schließen
  await expect(page.locator('.settings-drawer')).toBeHidden();

  // Werwolf erneut öffnen → .wwapp NICHT mehr hell
  await openGame(page, 'Werwolf');
  await expect(page.locator('.wwapp')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.wwapp.light')).toHaveCount(0);
});
