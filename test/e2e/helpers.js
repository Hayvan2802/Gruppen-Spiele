import { expect } from '@playwright/test';

// Wartet bis der Splash-Screen verschwunden ist und die App vollständig bereit ist.
// Behandelt auch das WhatsNew-Modal, das mit 800ms Verzögerung erscheinen kann.
export async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveClass(/fade-out/, { timeout: 10000 });
  // WICHTIG: Das "Was ist neu"-Modal (erscheint bis ~800ms nach Start) ZUERST
  // schließen — solange es offen ist, sind die Spiel-Karten per v-if ausgeblendet.
  // (Vorher wurde erst auf die Karte gewartet → Race → flaky.)
  const modal = page.locator('.modal-bg');
  const appeared = await modal.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
  if (appeared) {
    await page.locator('.modal-bg .btn-start').click();
    await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
  // Jetzt ist das Vue-Rendering der Startseite fertig: Werwolf-Karte sichtbar.
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible({ timeout: 6000 });
}

// Öffnet ein Spiel über seine Karte auf der Startseite.
export async function openGame(page, name) {
  await page.locator('.game-select-card', { hasText: name }).click();
}
