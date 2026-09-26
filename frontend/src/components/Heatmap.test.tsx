import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { HeatmapDay } from '../api/types'
import Heatmap from './Heatmap'
import { NO_ENTRY_COLOR, ratingColor } from './heatmapColors'

function buildDays(ratings: Record<number, number>): HeatmapDay[] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    dayRating: ratings[index] ?? null,
    entryCount: ratings[index] === undefined ? 0 : 2,
  }))
}

function renderHeatmap(days: HeatmapDay[]) {
  render(
    <MemoryRouter>
      <Heatmap days={days} />
    </MemoryRouter>,
  )
  return screen.getAllByRole('link')
}

describe('Heatmap', () => {
  it('renders one block per day, each linking to its day view', () => {
    const blocks = renderHeatmap(buildDays({}))

    expect(blocks).toHaveLength(30)
    expect(blocks[0]).toHaveAttribute('href', '/day/2026-09-01')
    expect(blocks[29]).toHaveAttribute('href', '/day/2026-09-30')
  })

  it('colors each block according to its rating', () => {
    const blocks = renderHeatmap(buildDays({ 0: 2, 1: 5, 2: 9 }))

    expect(blocks[0]).toHaveStyle({ backgroundColor: ratingColor(2) })
    expect(blocks[1]).toHaveStyle({ backgroundColor: ratingColor(5) })
    expect(blocks[2]).toHaveStyle({ backgroundColor: ratingColor(9) })
  })

  it('shows days without an entry in the muted grey', () => {
    const blocks = renderHeatmap(buildDays({}))

    expect(blocks[3]).toHaveStyle({ backgroundColor: NO_ENTRY_COLOR })
  })

  it('describes each day for screen readers', () => {
    const blocks = renderHeatmap(buildDays({ 0: 8 }))

    expect(blocks[0]).toHaveAccessibleName(/rating 8, 2 entries/)
    expect(blocks[1]).toHaveAccessibleName(/no entry/)
  })

  it('describes a day with entries but no rating as unrated', () => {
    const days = buildDays({})
    days[0] = { ...days[0], entryCount: 1 }
    const blocks = renderHeatmap(days)

    expect(blocks[0]).toHaveAccessibleName(/unrated, 1 entry/)
    expect(blocks[0]).toHaveStyle({ backgroundColor: NO_ENTRY_COLOR })
  })
})
