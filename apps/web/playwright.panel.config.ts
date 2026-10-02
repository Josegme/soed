import { defineConfig, devices } from '@playwright/test';

/** E2E del panel autenticado (scripts/e2e-panel.sh levanta base, API y build). */
const puerto = Number(process.env.PUERTO_E2E_PANEL ?? 3200);

export default defineConfig({
  testDir: './e2e/panel',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-panel' }]] : 'list',
  outputDir: 'test-results-panel',
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@movil/ },
  ],
  webServer: {
    command: `pnpm exec next start --port ${puerto}`,
    url: `http://localhost:${puerto}/es`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
