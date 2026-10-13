import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { expectNoAxeViolations } from '../test/axe'
import { monthDates } from '../utils/dates'
import HistoryPage from './HistoryPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHeatmap: vi.fn() } }
})

function renderHistory() {
  render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  )
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    vi.mocked(api.getHeatmap).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('shows the month calendar, then jump to a date, then the heatmap', () => {
    renderHistory()

    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(sections).toEqual(['Month calendar', 'Jump to a date', 'Heatmap'])
  })

  it('passes an axe check', async () => {
    vi.mocked(api.getHeatmap).mockImplementation((from) =>
      Promise.resolve(monthDates(from.slice(0, 7)).map((date) => ({ date, dayRating: 6, entryCount: 1 }))),
    )
    renderHistory()
    await screen.findByRole('table', { name: 'September 2026' })

    await expectNoAxeViolations(document.body)
  })

  it('loads only the current month on open', () => {
    renderHistory()

    expect(api.getHeatmap).toHaveBeenCalledTimes(1)
    expect(api.getHeatmap).toHaveBeenCalledWith('2026-09-01', '2026-09-30')
  })
})
