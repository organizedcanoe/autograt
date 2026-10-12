/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Build info passed in by the Docker build, or read from git by vite.config.ts in local dev.
interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_COMMIT?: string
  readonly VITE_BUILD_DATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
