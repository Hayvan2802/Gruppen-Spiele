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
      // Multiplayer-Modus wählen (:visible, da das vorgewärmte Werwolf im Shadow-DOM
      // ebenfalls .mode-card besitzt — Playwright durchdringt Shadow-DOM).
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

// ── Werwolf (eigene App im Shadow-DOM) ───────────────────────────────────────────
test.describe('Werwolf', () => {
  test.beforeEach(async ({ page }) => {
    await seedUserName(page, 'Tester');
    await waitForApp(page);
    await openGame(page, 'Werwolf');
    await expect(page.locator('#ww-host')).toBeVisible({ timeout: 10000 });
    // Warten bis die Sub-App im Shadow gemountet ist
    await expect.poll(async () => page.evaluate(() =>
      !!document.querySelector('#ww-host')?.shadowRoot?.querySelector('.ww-root')
    ), { timeout: 10000 }).toBe(true);
  });

  test('Werwolf: Home lädt im Shadow-DOM', async ({ page }) => {
    const ok = await page.evaluate(() =>
      !!document.querySelector('#ww-host').shadowRoot.querySelector('.screen'));
    expect(ok).toBe(true);
  });

  test('Werwolf: Coop-Setup (Host + Beitreten) vorhanden', async ({ page }) => {
    const modeCards = await page.evaluate(() =>
      document.querySelector('#ww-host').shadowRoot.querySelectorAll('.mode-card').length);
    expect(modeCards).toBeGreaterThanOrEqual(2);
    // Multiplayer wählen — dann Vue rendern lassen, dann Host/Join lesen
    await page.evaluate(() => {
      const sr = document.querySelector('#ww-host').shadowRoot;
      const coop = [...sr.querySelectorAll('.mode-card')].find(c => /Multiplayer/.test(c.textContent));
      coop && coop.click();
    });
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const sr = document.querySelector('#ww-host').shadowRoot;
      const btns = [...sr.querySelectorAll('button')].map(b => b.textContent);
      return { hasHost: btns.some(t => /👑|Host/.test(t)), hasJoin: btns.some(t => /🚪|Beitreten/.test(t)) };
    });
    expect(res.hasHost).toBe(true);
    expect(res.hasJoin).toBe(true);
  });

  test('Werwolf: Einstellungsmenü konsistent (Benutzername + Theme)', async ({ page }) => {
    // Statistik-Button darf NICHT (mehr) existieren; Einstellungen öffnen
    const hasStats = await page.evaluate(() => {
      const sr = document.querySelector('#ww-host').shadowRoot;
      const topbar = [...sr.querySelectorAll('.top-bar button, .top-bar a')].map(b => b.textContent);
      const gear = [...sr.querySelectorAll('button.icon-btn')].find(b => b.textContent.includes('⚙'));
      if (gear) gear.click();
      return topbar.some(t => t.includes('📊'));
    });
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const sr = document.querySelector('#ww-host').shadowRoot;
      const d = sr.querySelector('.settings-drawer');
      const userField = d && d.querySelector('input.ninput[placeholder="Dein Name"]');
      const themes = d ? [...d.querySelectorAll('.theme-btn')].map(x => x.textContent.trim()) : [];
      return { drawerOpen: !!d, userVal: userField && userField.value, themes };
    });
    expect(hasStats).toBe(false);
    expect(res.drawerOpen).toBe(true);
    expect(res.userVal).toBe('Tester');
    expect(res.themes).toEqual(THEME_LABELS);
  });
});

// ── Dark/Light: Theme der Haupt-App gilt auch fürs eingebettete Werwolf ───────────
test('Theme-Wechsel (Hell/Dunkel) gilt konsistent auch für Werwolf', async ({ page }) => {
  await waitForApp(page);
  // Werwolf einmal öffnen (mounten), dann zurück zur Startseite
  await openGame(page, 'Werwolf');
  await expect.poll(async () => page.evaluate(() =>
    !!document.querySelector('#ww-host')?.shadowRoot?.querySelector('.ww-root')
  ), { timeout: 10000 }).toBe(true);
  await page.locator('.back-corner').click();

  const wwLight = () => page.evaluate(() =>
    document.querySelector('#ww-host').shadowRoot.querySelector('.ww-root').classList.contains('light'));

  // Auf Hell schalten → body UND Werwolf-Root hell
  await page.locator('button.icon-btn[title="Einstellungen"]').first().click();
  await page.locator('.settings-drawer .theme-btn', { hasText: 'Hell' }).click();
  await expect(page.locator('body')).toHaveClass(/light/);
  await expect.poll(wwLight, { timeout: 3000 }).toBe(true);

  // Auf Dunkel zurück → beide dunkel
  await page.locator('.settings-drawer .theme-btn', { hasText: 'Dunkel' }).click();
  await expect(page.locator('body')).not.toHaveClass(/light/);
  await expect.poll(wwLight, { timeout: 3000 }).toBe(false);
});
