import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('outlines unrated days with entries, so they differ from empty days by more than colour', () => {
    const days = buildDays({})
    days[0] = { ...days[0], entryCount: 1 }
    const blocks = renderHeatmap(days)

    expect(blocks[0]).toHaveStyle({ borderStyle: 'dashed' })
    expect(blocks[1]).not.toHaveStyle({ borderStyle: 'dashed' })
  })

  it('has a legend naming each colour', () => {
    renderHeatmap(buildDays({}))

    const legend = within(screen.getByRole('list', { name: 'Rating colours' }))
    expect(legend.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      ...Array.from({ length: 11 }, (_, rating) => String(rating)),
      'Unrated',
      'No entry',
    ])
  })

  it('is a single tab stop on the latest day', () => {
    const blocks = renderHeatmap(buildDays({}))

    expect(blocks.filter((block) => block.tabIndex === 0)).toEqual([blocks[29]])
  })

  it('moves between days with the arrow keys', async () => {
    const user = userEvent.setup()
    const blocks = renderHeatmap(buildDays({}))

    await user.tab()
    expect(blocks[29]).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(blocks[27]).toHaveFocus()
    expect(blocks[27]).toHaveAttribute('tabindex', '0')
    expect(blocks[29]).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowRight}')
    expect(blocks[28]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(blocks[0]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(blocks[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(blocks[29]).toHaveFocus()
  })

  it('moves a row of 30 days with the up and down arrows', async () => {
    const user = userEvent.setup()
    const days = Array.from({ length: 60 }, (_, index) => ({
      date: `2026-${index < 30 ? '08' : '09'}-${String((index % 30) + 1).padStart(2, '0')}`,
      dayRating: null,
      entryCount: 0,
    }))
    const blocks = renderHeatmap(days)

    await user.tab()
    await user.keyboard('{ArrowUp}')
    expect(blocks[29]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(blocks[29]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(blocks[59]).toHaveFocus()
  })
})
