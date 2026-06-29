import { expect } from '@playwright/test';

// Wartet bis der Splash-Screen verschwunden ist und alle Spielkarten stabil gerendert sind
export async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveClass(/fade-out/, { timeout: 10000 });
  // Warten bis Vue-Rendering abgeschlossen: letzte Karte (Werwolf) muss stabil sichtbar sein
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible({ timeout: 5000 });
}
