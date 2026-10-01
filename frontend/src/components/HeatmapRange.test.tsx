import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import HeatmapRange from './HeatmapRange'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHeatmap: vi.fn() } }
})

function renderRange() {
  render(
    <MemoryRouter>
      <HeatmapRange />
    </MemoryRouter>,
  )
}

describe('HeatmapRange', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    vi.mocked(api.getHeatmap).mockResolvedValue([{ date: '2026-09-23', dayRating: 6, entryCount: 1 }])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('loads nothing until a range is chosen', () => {
    renderRange()

    expect(api.getHeatmap).not.toHaveBeenCalled()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it.each([
    ['Last 30 days', '2026-08-25'],
    ['Last 60 days', '2026-07-26'],
    ['Last 90 days', '2026-06-26'],
    ['Last 365 days', '2025-09-24'],
    ['Year to date', '2026-01-01'],
  ])('loads %s ending today', async (label, from) => {
    const user = userEvent.setup()
    renderRange()

    await user.selectOptions(screen.getByLabelText('Range'), label)
    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(api.getHeatmap).toHaveBeenCalledWith(from, '2026-09-23')
    expect(await screen.findByRole('link')).toHaveAttribute('href', '/day/2026-09-23')
  })
})
