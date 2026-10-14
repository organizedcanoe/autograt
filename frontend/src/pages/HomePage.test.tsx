import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { expectNoAxeViolations } from '../test/axe'
import { formatLongDate } from '../utils/dates'
import HomePage from './HomePage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHeatmap: vi.fn(), getDay: vi.fn() } }
})

function renderHome() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    vi.mocked(api.getHeatmap).mockResolvedValue([{ date: '2026-09-23', dayRating: 7, entryCount: 1 }])
    vi.mocked(api.getDay).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it("heads the page with today's date, then the last 30 days", () => {
    renderHome()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(formatLongDate('2026-09-23'))
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Last 30 days'])
  })

  it('passes an axe check', async () => {
    renderHome()
    await screen.findAllByRole('link', { name: /rating 7/ })

    await expectNoAxeViolations(document.body)
  })
})
