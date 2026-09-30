import { defineConfig, devices } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const API_PORT = 5077
const WEB_PORT = 5177

// The backend is built into a temp folder so it never collides with a dev server locking backend/bin.
// Its database lives there too and is deleted before each run, so the journey's user registers first and
// becomes the admin instead of waiting for approval; the other specs log in as that admin.
const backendDirectory = join(tmpdir(), 'autograt-e2e-backend')
const databasePath = join(backendDirectory, 'autograt-e2e.db')
const backendProject = resolve(import.meta.dirname, '../backend/Autograt.Api')
mkdirSync(backendDirectory, { recursive: true })
// Test workers load this config too, while the backend holds the database open; only the main process cleans up.
if (process.env.TEST_WORKER_INDEX === undefined) {
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) rmSync(file, { force: true })
}

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
  // The journey registers the first user, who becomes the admin, so it runs before the specs that log in as that admin.
  projects: [
    { name: 'journey', testMatch: 'journey.spec.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      testIgnore: 'journey.spec.ts',
      dependencies: ['journey'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `dotnet build "${backendProject}" -o . --nologo -v q && dotnet Autograt.Api.dll`,
      cwd: backendDirectory,
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        ASPNETCORE_URLS: `http://localhost:${API_PORT}`,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__Default: `Data Source=${databasePath}`,
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
