import { defineConfig, devices } from '@playwright/test';

const puerto = Number(process.env.PUERTO_E2E ?? 3100);

export default defineConfig({
  testDir: './e2e',
  // El panel autenticado tiene su propia configuración y entorno (playwright.panel.config.ts).
  testIgnore: ['panel/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
    // En el contenedor de desarrollo el Chromium preinstalado se indica por variable.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm start --port ${puerto}`,
    url: `http://localhost:${puerto}/es`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
