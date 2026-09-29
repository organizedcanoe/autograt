import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import UpdateBanner from './UpdateBanner'

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }))

const updateServiceWorker = vi.fn()
const setNeedRefresh = vi.fn()

function mockNeedRefresh(needRefresh: boolean) {
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  })
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows nothing while the app is up to date', () => {
    mockNeedRefresh(false)
    render(<UpdateBanner />)

    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument()
  })

  it('reloads into the new version when one is available', async () => {
    mockNeedRefresh(true)
    render(<UpdateBanner />)

    expect(screen.getByText(/new version is available/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('can be dismissed until the next update', async () => {
    mockNeedRefresh(true)
    render(<UpdateBanner />)

    await userEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
