import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:5173';

// Corre só localmente (sem CI remoto). Precisa do Supabase local a correr (`npm run db:start`).
export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  // Os fluxos completos (criar contas, enviar fotos, esperar pelos avisos antes do axe) passam
  // dos 30 s por omissão quando a máquina está ocupada.
  timeout: 60_000,
  // Um ficheiro de cada vez: o admin-features.spec muda os destaques do Início, e os outros
  // ficheiros (catalog.spec) nunca o devem ver a meio.
  workers: 1,
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
