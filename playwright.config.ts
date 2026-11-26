import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:5173';

// Corre só localmente (sem CI remoto). Precisa do Supabase local a correr (`npm run db:start`).
export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    locale: 'pt-AO',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
