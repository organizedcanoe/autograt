/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { configDefaults } from 'vitest/config'

/** Runs a git command, or returns undefined when git or the repo isn't there (e.g. in the Docker build). */
function git(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined
  } catch {
    return undefined
  }
}

/** Fills in a build info variable from git, unless the Docker build passed it in. */
function setFromGit(name: string, value: () => string | undefined) {
  if (process.env[name]) return
  const fromGit = value()
  if (fromGit) process.env[name] = fromGit
}

// Local builds show their git version, e.g. "1.2.3-4-gabc1234-dirty"; tests keep the dev fallback.
if (!process.env.VITEST) {
  setFromGit('VITE_APP_VERSION', () => git('describe --tags --match "v[0-9]*" --dirty')?.replace(/^v/, ''))
  setFromGit('VITE_APP_COMMIT', () => git('rev-parse --short=7 HEAD'))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Off in Vitest, where a service worker has nothing to do; tests use a stub of its virtual module.
    !process.env.VITEST &&
      VitePWA({
        // Our own service worker (src/sw.ts), so later phases can add push handlers; Workbox fills in the precache list.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Autograt',
          short_name: 'Autograt',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // Pico's default azure primary and light background.
          theme_color: '#0172ad',
          background_color: '#ffffff',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
  ],
  server: {
    proxy: {
      // The E2E tests point this at their own backend instance.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:5000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)),
    },
  },
})
