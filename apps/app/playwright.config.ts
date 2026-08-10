import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // В CI — 2 ретрая: тест, упавший 1 раз и прошедший на ретрае,
  // и есть «флап». Локально — 0 для быстрого фидбека.
  // trace: 'on-first-retry' ниже захватит трейс первого падения.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 5'] } },
  ],
  // single-html.spec.ts поднимает свой static server (нужен отдельный порт
  // и обслуживание poker-assistant.html, а не dist/). Для остальных — авто-сервер.
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
