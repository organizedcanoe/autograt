import { defineConfig, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const API_PORT = 5077
const WEB_PORT = 5177

// The backend is built into a temp folder so it never collides with a dev server locking backend/bin.
// Its database lives there too; each test registers a unique user, so a reused database is harmless.
const backendDirectory = join(tmpdir(), 'autograt-e2e-backend')
const backendProject = resolve(import.meta.dirname, '../backend/Autograt.Api')
mkdirSync(backendDirectory, { recursive: true })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `dotnet build "${backendProject}" -o . --nologo -v q && dotnet Autograt.Api.dll`,
      cwd: backendDirectory,
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        ASPNETCORE_URLS: `http://localhost:${API_PORT}`,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__Default: `Data Source=${join(backendDirectory, 'autograt-e2e.db')}`,
        Jwt__Key: 'e2e-signing-key-that-is-at-least-32-bytes-long',
      },
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
})
