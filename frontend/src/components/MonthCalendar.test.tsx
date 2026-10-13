import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { HeatmapDay } from '../api/types'
import { monthDates } from '../utils/dates'
import { NO_ENTRY_COLOR, ratingColor, ratingTextColor } from './heatmapColors'
import MonthCalendar from './MonthCalendar'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHeatmap: vi.fn() } }
})

/** Answers each request with every day of the month unrated, except a rating of 9 on the 15th. */
function stubHeatmap() {
  vi.mocked(api.getHeatmap).mockImplementation((from) =>
    Promise.resolve(
      monthDates(from.slice(0, 7)).map<HeatmapDay>((date) =>
        date.endsWith('-15') ? { date, dayRating: 9, entryCount: 2 } : { date, dayRating: null, entryCount: 0 },
      ),
    ),
  )
}

function renderCalendar() {
  render(
    <MemoryRouter>
      <MonthCalendar />
    </MemoryRouter>,
  )
}

async function showMonth(month: string) {
  const user = userEvent.setup()
  const input = screen.getByLabelText('Month')
  await user.clear(input)
  await user.type(input, month)
  await user.click(screen.getByRole('button', { name: 'Show' }))
  return user
}

describe('MonthCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    stubHeatmap()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('shows this month straight away', async () => {
    renderCalendar()

    expect(await screen.findByRole('table', { name: 'September 2026' })).toBeInTheDocument()
    expect(api.getHeatmap).toHaveBeenCalledWith('2026-09-01', '2026-09-30')
    expect(screen.getByLabelText('Month')).toHaveValue('2026-09')
    expect(screen.getByLabelText('Month')).toHaveAttribute('max', '2026-09')
  })

  it('loads the chosen month and links each day, colored by its rating', async () => {
    renderCalendar()

    await showMonth('2026-02')

    expect(api.getHeatmap).toHaveBeenCalledWith('2026-02-01', '2026-02-28')
    const calendar = await screen.findByRole('table', { name: 'February 2026' })
    const days = within(calendar).getAllByRole('link')
    expect(days).toHaveLength(28)
    expect(days[0]).toHaveAttribute('href', '/day/2026-02-01')
    expect(days[0]).toHaveTextContent('1')
    expect(days[0]).toHaveStyle({ backgroundColor: NO_ENTRY_COLOR })
    expect(days[14]).toHaveStyle({ backgroundColor: ratingColor(9) })
    expect(days[14]).toHaveAccessibleName(/rating 9, 2 entries/)
  })

  it('shows each rating as text as well as colour', async () => {
    renderCalendar()

    const calendar = await screen.findByRole('table', { name: 'September 2026' })
    const days = within(calendar).getAllByRole('link')
    expect(days[14]).toHaveTextContent(/^15\s*9$/)
    expect(days[14]).toHaveStyle({ color: ratingTextColor(9) })
    expect(days[13]).toHaveTextContent(/^14$/)
    expect(screen.getByRole('list', { name: 'Rating colours' })).toBeInTheDocument()
  })

  it('is a single tab stop on today and moves by day and week with the arrow keys', async () => {
    const user = userEvent.setup()
    renderCalendar()

    const calendar = await screen.findByRole('table', { name: 'September 2026' })
    const days = within(calendar).getAllByRole('link')
    expect(days.filter((day) => day.tabIndex === 0)).toEqual([days[22]])

    days[22].focus()
    await user.keyboard('{ArrowUp}')
    expect(days[15]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(days[14]).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(days[21]).toHaveFocus()
  })

  it('starts the month on its weekday', async () => {
    renderCalendar()

    // April 1, 2026 is a Wednesday, so Sunday to Tuesday of the first week are blank.
    await showMonth('2026-04')

    const calendar = await screen.findByRole('table', { name: 'April 2026' })
    const firstWeek = within(calendar).getAllByRole('row')[1]
    const cells = within(firstWeek).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('1')
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual(['', '', ''])
  })

  it('does not link days after today', async () => {
    renderCalendar()

    await showMonth('2026-09')

    const calendar = await screen.findByRole('table', { name: 'September 2026' })
    expect(within(calendar).getAllByRole('link')).toHaveLength(23)
    expect(within(calendar).getByText('24')).not.toHaveAttribute('href')
  })

  it('pages to the previous and next months, but not past this month', async () => {
    renderCalendar()
    const user = await showMonth('2026-08')
    await screen.findByRole('table', { name: 'August 2026' })

    await user.click(screen.getByRole('button', { name: '← Previous month' }))
    expect(await screen.findByRole('table', { name: 'July 2026' })).toBeInTheDocument()
    expect(api.getHeatmap).toHaveBeenLastCalledWith('2026-07-01', '2026-07-31')

    await user.click(screen.getByRole('button', { name: 'Next month →' }))
    await screen.findByRole('table', { name: 'August 2026' })
    await user.click(screen.getByRole('button', { name: 'Next month →' }))
    expect(await screen.findByRole('table', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month →' })).toBeDisabled()
  })
})
