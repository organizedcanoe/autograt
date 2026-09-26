import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { DayDetail } from '../api/types'
import { formatLongDate } from '../utils/dates'
import DayPage from './DayPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: { ...original.api, getDay: vi.fn(), updateRating: vi.fn(), updateSubEntry: vi.fn(), addSubEntry: vi.fn() },
  }
})

const TODAY = '2026-09-23'
const YESTERDAY = '2026-09-22'

function dayDetail(entryDate: string): DayDetail {
  return {
    entryDate,
    dayRating: 7,
    subEntries: [
      { id: 1, category: 'Good', content: 'Walked the dog', createdAtUtc: `${entryDate}T18:00:00Z`, appends: [] },
    ],
  }
}

function renderDay(date: string) {
  render(
    <MemoryRouter initialEntries={[`/day/${date}`]}>
      <Routes>
        <Route path="/day/:date" element={<DayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DayPage', () => {
  beforeEach(() => {
    // Only Date is faked so promises and user events still run normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('shows the day rating after the date in the heading', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(YESTERDAY))
    renderDay(YESTERDAY)

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(`${formatLongDate(YESTERDAY)}: 7/10`)
  })

  it("lets today's rating and entries be edited", async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(TODAY))
    renderDay(TODAY)

    expect(await screen.findByRole('button', { name: 'Save rating' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Append' })).toBeInTheDocument()
  })

  it("saves a new rating for today's entry", async () => {
    const user = userEvent.setup()
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(TODAY))
    vi.mocked(api.updateRating).mockResolvedValue({ ...dayDetail(TODAY), dayRating: 3 })
    renderDay(TODAY)

    await user.selectOptions(await screen.findByLabelText('Change rating'), '3')
    await user.click(screen.getByRole('button', { name: 'Save rating' }))

    expect(api.updateRating).toHaveBeenCalledWith(TODAY, 3)
  })

  it('makes a past day read-only apart from appending notes', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(YESTERDAY))
    renderDay(YESTERDAY)

    expect(await screen.findByText('Past days are read-only. You can still append notes.')).toBeInTheDocument()
    expect(screen.getByText('Walked the dog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Append' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save rating' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add entry' })).not.toBeInTheDocument()
  })

  it('marks a day with entries but no rating as unrated', async () => {
    vi.mocked(api.getDay).mockResolvedValue({ ...dayDetail(TODAY), dayRating: null })
    renderDay(TODAY)

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(`${formatLongDate(TODAY)}: unrated`)
    expect(screen.getByLabelText('How was your day?')).toHaveValue('')
  })

  it('does not offer to write entries for a past day without one', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(YESTERDAY)

    expect(await screen.findByText('No entry was written for this day.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save rating' })).not.toBeInTheDocument()
  })

  it('nudges with good and bad boxes for today when there is no entry', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    expect(await screen.findByLabelText('How was your day?')).toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Bad thing')).toBeInTheDocument()
  })

  it('saves a single entry for today without a rating', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    await user.selectOptions((await screen.findAllByLabelText('Category'))[2], 'Neutral')
    await user.type(screen.getByLabelText('Bad thing'), 'Quiet evening')
    await user.click(screen.getAllByRole('button', { name: 'Add entry' })[2])

    expect(api.addSubEntry).toHaveBeenCalledWith(TODAY, 'Neutral', 'Quiet evening')
    expect(api.updateRating).not.toHaveBeenCalled()
  })
})
