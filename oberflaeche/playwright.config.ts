// Ende-zu-Ende gegen die laufende Oberfläche.
//
// `docs/ARBEITSWEISE.md`, Stufe 2, macht axe zur Bedingung für jede Änderung
// an der Oberfläche — nicht zur Absichtserklärung. Diese Läufe brauchen n8n
// nicht: Der Webhook wird im Browser abgefangen und mit einem Prüfstück
// beantwortet. Damit prüfen sie die Oberfläche, nicht den Stack; dafür gibt
// es scripts/rauchtest.sh.

import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;
const ADRESSE = `http://localhost:${PORT}`;
const ZWEI_MINUTEN = 120_000;
const DREI_MINUTEN = 180_000;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: ZWEI_MINUTEN,
  use: {
    baseURL: ADRESSE,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm start -- --port ${PORT}`,
    url: ADRESSE,
    reuseExistingServer: !process.env['CI'],
    timeout: DREI_MINUTEN,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
