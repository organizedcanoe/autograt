import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { HeatmapDay } from '../api/types'
import { formatShortDate } from '../utils/dates'
import { ratingColor } from './heatmapColors'
import RatingTrendChart from './RatingTrendChart'

const DAYS: HeatmapDay[] = [
  { date: '2026-09-20', dayRating: 2, entryCount: 1 },
  { date: '2026-09-21', dayRating: null, entryCount: 0 },
  { date: '2026-09-22', dayRating: 8, entryCount: 2 },
  { date: '2026-09-23', dayRating: 10, entryCount: 3 },
]

function renderChart(days = DAYS) {
  const router = createMemoryRouter([
    { path: '/', element: <RatingTrendChart days={days} /> },
    { path: '/day/:date', element: <h1>Day page</h1> },
  ])
  render(<RouterProvider router={router} />)
  return router
}

describe('RatingTrendChart', () => {
  it('draws one dot per rated day, coloured by its rating, and leaves gaps for unrated days', () => {
    renderChart()

    const dots = screen.getAllByRole('link')
    expect(dots.map((dot) => dot.getAttribute('href'))).toEqual(['/day/2026-09-20', '/day/2026-09-22', '/day/2026-09-23'])
    expect(dots[1].querySelector('circle')).toHaveAttribute('fill', ratingColor(8))
    expect(dots[1]).toHaveAccessibleName(/: rating 8, 2 entries$/)
  })

  it('opens the day when a dot is clicked', async () => {
    const router = renderChart()

    await userEvent.click(screen.getAllByRole('link')[2])

    expect(router.state.location.pathname).toBe('/day/2026-09-23')
  })

  it('draws the 7-day rolling average as a line', () => {
    renderChart()

    const line = screen.getByTestId('rolling-average')
    // One point per day: the unrated day still has a 7-day average (2), so the line has no gap.
    expect(line.getAttribute('d')?.match(/[ML]/g)).toEqual(['M', 'L', 'L', 'L'])
  })

  it('breaks the line where a 7-day window has no rated days', () => {
    const days: HeatmapDay[] = Array.from({ length: 9 }, (_, index) => ({
      date: `2026-09-${String(index + 10).padStart(2, '0')}`,
      dayRating: index === 0 || index === 8 ? 5 : null,
      entryCount: 0,
    }))
    renderChart(days)

    const path = screen.getByTestId('rolling-average').getAttribute('d')
    // Days 0–6 have day 0 in their window; day 7 has none; day 8 starts a new segment.
    expect(path?.match(/[ML]/g)).toEqual(['M', 'L', 'L', 'L', 'L', 'L', 'L', 'M'])
  })

  it('summarises the chart for screen readers', () => {
    renderChart()

    expect(screen.getByRole('group', { name: 'Rating trend' })).toHaveAccessibleDescription(
      `${formatShortDate('2026-09-20')} to ${formatShortDate('2026-09-23')}: 3 rated days, average 6.7.`,
    )
  })

  it('labels the rating axis from 0 to 10 and the first and last dates', () => {
    renderChart()

    for (const label of ['0', '5', '10']) {
      expect(screen.getByText(label, { selector: 'text' })).toBeInTheDocument()
    }
    expect(screen.getByText(formatShortDate('2026-09-20'), { selector: 'text' })).toBeInTheDocument()
    expect(screen.getByText(formatShortDate('2026-09-23'), { selector: 'text' })).toBeInTheDocument()
  })
})
