import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { DayDetail } from '../api/types'
import DayPage from './DayPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: { ...original.api, getDay: vi.fn(), updateRating: vi.fn(), updateSubEntry: vi.fn() },
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

  it('shows the day rating as a heading', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(YESTERDAY))
    renderDay(YESTERDAY)

    expect(await screen.findByRole('heading', { level: 2, name: 'Rating: 7/10' })).toBeInTheDocument()
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

  it('does not offer to create an entry for a past day without one', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(YESTERDAY)

    expect(await screen.findByText('No entry was written for this day.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save day' })).not.toBeInTheDocument()
  })

  it('offers to create an entry for today when there is none', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    expect(await screen.findByRole('button', { name: 'Save day' })).toBeInTheDocument()
  })
})
