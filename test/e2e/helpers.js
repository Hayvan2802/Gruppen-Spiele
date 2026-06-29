import { expect } from '@playwright/test';

// Wartet bis der Splash-Screen verschwunden ist und die App bereit ist
export async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveClass(/fade-out/, { timeout: 10000 });
}
