import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import BuildInfo from './BuildInfo'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getVersion: vi.fn() } }
})

function stubFrontendBuild(version: string, commit: string, buildDate: string) {
  vi.stubEnv('VITE_APP_VERSION', version)
  vi.stubEnv('VITE_APP_COMMIT', commit)
  vi.stubEnv('VITE_BUILD_DATE', buildDate)
}

describe('BuildInfo', () => {
  afterEach(() => {
    vi.mocked(api.getVersion).mockReset()
    vi.unstubAllEnvs()
  })

  it('shows the version, linked commit and build date', async () => {
    stubFrontendBuild('0.1.42', 'a1b2c3d', '2026-09-28T12:00:00Z')
    vi.mocked(api.getVersion).mockResolvedValue({ version: '0.1.42', commit: 'a1b2c3d', buildDate: '2026-09-28T12:00:00Z' })
    render(<BuildInfo />)

    expect(screen.getByText(/v0\.1\.42/)).toBeInTheDocument()
    expect(screen.getByText(/2026-09-28/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'a1b2c3d' })).toHaveAttribute(
      'href',
      'https://github.com/oversizedcanoe/autograt/commit/a1b2c3d',
    )
    await vi.waitFor(() => expect(api.getVersion).toHaveBeenCalled())
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument()
  })

  it('falls back to the dev build without a commit link', () => {
    stubFrontendBuild('', '', '')
    vi.mocked(api.getVersion).mockResolvedValue({ version: '0.0.0-dev', commit: 'local', buildDate: null })
    render(<BuildInfo />)

    expect(screen.getByText(/v0\.0\.0-dev · local/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('warns when the backend is on a different build', async () => {
    stubFrontendBuild('0.1.42', 'a1b2c3d', '2026-09-28T12:00:00Z')
    vi.mocked(api.getVersion).mockResolvedValue({ version: '0.1.40', commit: 'e4f5a6b', buildDate: null })
    render(<BuildInfo />)

    expect(await screen.findByText(/backend is on v0\.1\.40 \(e4f5a6b\)/i)).toBeInTheDocument()
  })

  it('shows the frontend build when the version request fails', async () => {
    stubFrontendBuild('0.1.42', 'a1b2c3d', '')
    vi.mocked(api.getVersion).mockRejectedValue(new Error('offline'))
    render(<BuildInfo />)

    await vi.waitFor(() => expect(api.getVersion).toHaveBeenCalled())
    expect(screen.getByText(/v0\.1\.42/)).toBeInTheDocument()
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument()
  })
})
