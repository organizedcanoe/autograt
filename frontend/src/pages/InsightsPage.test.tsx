import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { Insights } from '../api/types'
import { categoryTint } from '../components/categoryColors'
import { expectNoAxeViolations } from '../test/axe'
import { formatMediumDate } from '../utils/dates'
import InsightsPage from './InsightsPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getInsights: vi.fn(), getHeatmap: vi.fn() } }
})

const INSIGHTS: Insights = {
  today: '2026-09-23',
  ratings: {
    allTime: { average: 6.8333, ratedDays: 120 },
    last7Days: { average: 7.4, ratedDays: 1 },
    last30Days: { average: null, ratedDays: 0 },
  },
  categories: { good: 6, bad: 3, neutral: 1 },
  streaks: { current: 4, longest: { days: 21, from: '2026-06-01', to: '2026-06-21' } },
}

function renderInsights() {
  render(
    <MemoryRouter>
      <InsightsPage />
    </MemoryRouter>,
  )
}

/** The section under the level-2 heading with this name. */
function section(name: string) {
  return within(screen.getByRole('heading', { level: 2, name }).closest('section')!)
}

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.mocked(api.getInsights).mockResolvedValue(INSIGHTS)
    vi.mocked(api.getHeatmap).mockResolvedValue([])
  })

  afterEach(() => {
    // Clear rather than reset: the trend can still load after a test ends, before the page unmounts.
    vi.clearAllMocks()
  })

  it('shows ratings, streaks, entries and the rating trend in that order', async () => {
    renderInsights()

    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Ratings' })
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(sections).toEqual(['Ratings', 'Streaks', 'Entries', 'Rating trend'])
  })

  it('passes an axe check', async () => {
    vi.mocked(api.getHeatmap).mockResolvedValue([
      { date: '2026-09-22', dayRating: 4, entryCount: 1 },
      { date: '2026-09-23', dayRating: 8, entryCount: 2 },
    ])
    renderInsights()
    await screen.findByRole('group', { name: 'Rating trend' })

    await expectNoAxeViolations(document.body)
  })

  it('shows each average to one decimal place with its rated-day count, and a dash without rated days', async () => {
    renderInsights()

    const ratings = await screen.findByRole('heading', { level: 2, name: 'Ratings' })
    const cards = within(ratings.closest('section')!).getAllByRole('article')
    expect(cards.map((card) => card.textContent)).toEqual([
      'All time6.8120 rated days',
      'Last 7 days7.41 rated day',
      'Last 30 days—0 rated days',
    ])
  })

  it('shows the current and longest streak with its dates', async () => {
    renderInsights()

    await screen.findByRole('heading', { level: 2, name: 'Streaks' })
    const streaks = section('Streaks')
    expect(streaks.getByRole('article', { name: 'Current streak' })).toHaveTextContent('4 days')
    const longest = streaks.getByRole('article', { name: 'Longest streak' })
    expect(longest).toHaveTextContent('21 days')
    expect(longest).toHaveTextContent(`${formatMediumDate('2026-06-01')} – ${formatMediumDate('2026-06-21')}`)
  })

  it('shows the entries in each category with their share, tinted in its category colour', async () => {
    renderInsights()

    await screen.findByRole('heading', { level: 2, name: 'Entries' })
    const entries = section('Entries')
    expect(entries.getByRole('article', { name: 'Good' })).toHaveTextContent('660%')
    expect(entries.getByRole('article', { name: 'Bad' })).toHaveTextContent('330%')
    expect(entries.getByRole('article', { name: 'Neutral' })).toHaveTextContent('110%')
    for (const category of ['Good', 'Bad', 'Neutral'] as const) {
      expect(entries.getByRole('article', { name: category })).toHaveStyle({ backgroundColor: categoryTint(category) })
    }
  })

  it('loads the rating trend', async () => {
    renderInsights()

    await screen.findByRole('heading', { level: 2, name: 'Rating trend' })
    expect(api.getHeatmap).toHaveBeenCalled()
  })

  it('shows a message instead of the stats before anything is journaled', async () => {
    vi.mocked(api.getInsights).mockResolvedValue({
      ...INSIGHTS,
      ratings: {
        allTime: { average: null, ratedDays: 0 },
        last7Days: { average: null, ratedDays: 0 },
        last30Days: { average: null, ratedDays: 0 },
      },
      categories: { good: 0, bad: 0, neutral: 0 },
      streaks: { current: 0, longest: null },
    })
    renderInsights()

    expect(await screen.findByText("No entries yet. Insights appear once you've journaled.")).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(api.getHeatmap).not.toHaveBeenCalled()
  })

  it('shows an error when loading fails', async () => {
    vi.mocked(api.getInsights).mockRejectedValue(new Error('Server is down'))
    renderInsights()

    expect(await screen.findByRole('alert')).toHaveTextContent('Server is down')
  })
})
