import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import RatingTrend from './RatingTrend'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHeatmap: vi.fn() } }
})

function renderTrend() {
  render(
    <MemoryRouter>
      <RatingTrend />
    </MemoryRouter>,
  )
}

describe('RatingTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    vi.mocked(api.getHeatmap).mockResolvedValue([{ date: '2026-09-23', dayRating: 6, entryCount: 1 }])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('loads the last 30 days on open', async () => {
    renderTrend()

    expect(screen.getByLabelText('Range')).toHaveDisplayValue('Last 30 days')
    expect(api.getHeatmap).toHaveBeenCalledExactlyOnceWith('2026-08-25', '2026-09-23')
    expect(await screen.findByRole('link')).toHaveAttribute('href', '/day/2026-09-23')
  })

  it.each([
    ['Last 90 days', '2026-06-26'],
    ['Last 365 days', '2025-09-24'],
  ])('reloads for %s ending today', async (label, from) => {
    const user = userEvent.setup()
    renderTrend()

    await user.selectOptions(screen.getByLabelText('Range'), label)

    expect(api.getHeatmap).toHaveBeenLastCalledWith(from, '2026-09-23')
  })

  it('shows an error when loading fails', async () => {
    vi.mocked(api.getHeatmap).mockRejectedValue(new Error('Server is down'))
    renderTrend()

    expect(await screen.findByRole('alert')).toHaveTextContent('Server is down')
  })
})
