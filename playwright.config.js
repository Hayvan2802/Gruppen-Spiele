import { defineConfig, devices } from '@playwright/test';

// Die App wird auf zwei Handy-Formfaktoren getestet: einem Android- und einem
// iPhone-Geräteprofil (Viewport, User-Agent, Device-Pixel-Ratio, Touch). Beide
// laufen auf der Chromium-Engine — das ist die einzige im CI installierte Engine
// (WebKit/Safari-Download ist dort nicht freigegeben). Für das iPhone-Profil wird
// deshalb `defaultBrowserType` bewusst auf 'chromium' überschrieben (das iPhone-
// Descriptor würde sonst WebKit verlangen). Getestet werden damit Layout, Maße
// und Touch-Verhalten auf beiden Formfaktoren.
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
      name: 'iPhone (14)',
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
