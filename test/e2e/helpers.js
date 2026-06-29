import { expect } from '@playwright/test';

// Wartet bis der Splash-Screen verschwunden ist und die App vollständig bereit ist.
// Behandelt auch das WhatsNew-Modal, das mit 800ms Verzögerung erscheinen kann.
export async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveClass(/fade-out/, { timeout: 10000 });
  // Warten bis Vue-Rendering abgeschlossen: Werwolf-Karte sichtbar
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible({ timeout: 5000 });
  // WhatsNew-Modal erscheint 800ms nach App-Start — abwarten und schließen falls vorhanden
  const modal = page.locator('.modal-bg');
  const appeared = await modal.waitFor({ state: 'visible', timeout: 1200 }).then(() => true).catch(() => false);
  if (appeared) {
    await page.locator('.modal-bg .btn-start').click();
    await modal.waitFor({ state: 'hidden', timeout: 2000 });
  }
}
