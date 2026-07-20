import { defineConfig, devices } from '@playwright/test';

// Die App wird auf zwei echten Handy-Engines getestet:
//  - Android (Pixel 7)      → Chromium/Blink
//  - iPhone  (iPhone 14)    → WebKit (echte Safari-Engine)
// Damit werden Layout, Maße, Touch UND Safari-spezifisches Rendering abgedeckt.
// Beide Engines müssen installiert sein (`npx playwright install chromium webkit`);
// die CI installiert beide (siehe .github/workflows/test.yml).
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Android (Pixel 7)',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone (Safari/WebKit)',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
