/// <reference types="vite/client" />

// Build info passed in by the Docker build; empty or missing in local dev.
interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_COMMIT?: string
  readonly VITE_BUILD_DATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
