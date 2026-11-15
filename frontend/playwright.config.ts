import { defineConfig } from '@playwright/test';
const localLauncher = process.platform === 'win32'
  ? 'powershell.exe -NoProfile -File ../scripts/run-local.ps1 --timeout 120'
  : 'python3 ../scripts/run-local.py --timeout 120';
export default defineConfig({
  testDir: './e2e', timeout: 60000, workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 }, command: localLauncher, url: 'http://127.0.0.1:5173/api/v1/health', timeout: 150000, reuseExistingServer: process.env.LUNAR_E2E_REUSE_SERVER === '1' },
});
