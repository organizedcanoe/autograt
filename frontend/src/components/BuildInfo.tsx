import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { BuildVersion } from '../api/types'

const DEV_VERSION = '0.0.0-dev'
const DEV_COMMIT = 'local'
const COMMIT_URL = 'https://github.com/organizedcanoe/autograt/commit/'

/** The frontend's own build, baked in by the Docker build or from git; falls back like the backend does. */
function frontendBuild(): BuildVersion {
  return {
    version: import.meta.env.VITE_APP_VERSION || DEV_VERSION,
    commit: import.meta.env.VITE_APP_COMMIT || DEV_COMMIT,
    buildDate: import.meta.env.VITE_BUILD_DATE || null,
  }
}

function isSameBuild(a: BuildVersion, b: BuildVersion): boolean {
  return a.version === b.version && a.commit === b.commit
}

/** Only Docker builds (which have a build date) can be stale; local dev servers restart separately, so their git versions drift. */
function isStaleContainer(frontend: BuildVersion, backend: BuildVersion): boolean {
  return frontend.buildDate !== null && backend.buildDate !== null && !isSameBuild(frontend, backend)
}

/** Shows the running build, and warns when the backend container is on a different one. */
export default function BuildInfo() {
  const [frontend] = useState(frontendBuild)
  const [backend, setBackend] = useState<BuildVersion | null>(null)

  useEffect(() => {
    // The build info is a nicety, so a failed request just leaves out the comparison.
    api.getVersion().then(setBackend, () => {})
  }, [])

  return (
    <small>
      v{frontend.version} ·{' '}
      {frontend.commit === DEV_COMMIT ? (
        frontend.commit
      ) : (
        <a href={COMMIT_URL + frontend.commit}>{frontend.commit}</a>
      )}
      {frontend.buildDate && <> · {frontend.buildDate.slice(0, 10)}</>}
      {backend && isStaleContainer(frontend, backend) && (
        <>
          <br />
          <mark>
            Backend is on v{backend.version} ({backend.commit}), so one container is stale. Run{' '}
            <code>docker compose pull && docker compose up -d</code> to update.
          </mark>
        </>
      )}
    </small>
  )
}
