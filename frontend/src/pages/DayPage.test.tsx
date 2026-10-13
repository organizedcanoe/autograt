import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { DayDetail } from '../api/types'
import { expectNoAxeViolations } from '../test/axe'
import { formatLongDate } from '../utils/dates'
import DayPage from './DayPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      getDay: vi.fn(),
      updateRating: vi.fn(),
      updateSubEntry: vi.fn(),
      addSubEntry: vi.fn(),
      deleteSubEntry: vi.fn(),
      deleteAppend: vi.fn(),
    },
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
    vi.restoreAllMocks()
  })

  it('shows the day rating after the date in the heading', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(YESTERDAY))
    renderDay(YESTERDAY)

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(`${formatLongDate(YESTERDAY)}: 7/10`)
  })

  it('shows the date in the heading while the day loads', () => {
    vi.mocked(api.getDay).mockReturnValue(new Promise(() => {}))
    renderDay(YESTERDAY)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(formatLongDate(YESTERDAY))
  })

  it('has a heading for an invalid date', () => {
    renderDay('not-a-date')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Day not found')
  })

  it.each([TODAY, YESTERDAY])('passes an axe check on %s', async (date) => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(date))
    renderDay(date)
    await screen.findByText('Walked the dog')

    await expectNoAxeViolations(document.body)
  })

  it("lets today's rating and entries be edited", async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(TODAY))
    renderDay(TODAY)

    expect(await screen.findByLabelText('Change rating')).toBeEnabled()
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

    expect(api.updateRating).toHaveBeenCalledWith(TODAY, 3)
  })

  it('makes a past day read-only apart from appending notes', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(YESTERDAY))
    renderDay(YESTERDAY)

    expect(await screen.findByText('Walked the dog')).toBeInTheDocument()
    expect(screen.queryByText(/read-only/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Append' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add entry' })).not.toBeInTheDocument()
  })

  it("deletes today's entry and its note, then reloads the day", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const append = { id: 4, subEntryId: 1, content: 'Long walk', createdAtUtc: `${TODAY}T19:00:00Z` }
    const detail = dayDetail(TODAY)
    vi.mocked(api.getDay).mockResolvedValue({ ...detail, subEntries: [{ ...detail.subEntries[0], appends: [append] }] })
    renderDay(TODAY)

    await user.click(await screen.findByRole('button', { name: 'Delete note' }))
    expect(api.deleteAppend).toHaveBeenCalledWith(4)

    vi.mocked(api.getDay).mockResolvedValue({ ...detail, subEntries: [] })
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(api.deleteSubEntry).toHaveBeenCalledWith(1)
    // The emptied nudge slot offers its box again.
    expect(await screen.findByLabelText('Good thing 1')).toBeInTheDocument()
  })

  it('marks a day with entries but no rating as unrated', async () => {
    vi.mocked(api.getDay).mockResolvedValue({ ...dayDetail(TODAY), dayRating: null })
    renderDay(TODAY)

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(`${formatLongDate(TODAY)}: unrated`)
    expect(screen.getByLabelText('How was your day?')).toHaveValue('')
  })

  it('says when a rated past day has no entries, without offering notes', async () => {
    vi.mocked(api.getDay).mockResolvedValue({ entryDate: YESTERDAY, dayRating: 6, subEntries: [] })
    renderDay(YESTERDAY)

    expect(await screen.findByText('No entries were written.')).toBeInTheDocument()
    expect(screen.queryByText(/append/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('does not offer to write entries for a past day without one', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(YESTERDAY)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(`${formatLongDate(YESTERDAY)}: unrated`)
    expect(screen.getByText('No entries were written.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('nudges with good and bad boxes for today when there is no entry', async () => {
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    expect(await screen.findByLabelText('How was your day?')).toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Bad thing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Custom Entry' })).toBeInTheDocument()
  })

  it('saves a nudge box on its own without a rating', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    await user.type(await screen.findByLabelText('Bad thing'), 'Missed the bus')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2])

    expect(api.addSubEntry).toHaveBeenCalledWith(TODAY, 'Bad', 'Missed the bus')
    expect(api.updateRating).not.toHaveBeenCalled()
  })

  it('shows a saved nudge entry in place of its box and custom entries after the nudge boxes', async () => {
    const at = `${TODAY}T18:00:00Z`
    vi.mocked(api.getDay).mockResolvedValue({
      entryDate: TODAY,
      dayRating: null,
      subEntries: [
        { id: 1, category: 'Neutral', content: 'Quiet evening', createdAtUtc: at, appends: [] },
        { id: 2, category: 'Good', content: 'Walked the dog', createdAtUtc: at, appends: [] },
      ],
    })
    renderDay(TODAY)

    const good = await screen.findByText('Walked the dog')
    const custom = screen.getByText('Quiet evening')
    const bad = screen.getByLabelText('Bad thing')
    expect(screen.queryByLabelText('Good thing 1')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 2')).toBeInTheDocument()
    // Document order: Good thing 1's entry, Good thing 2, Bad thing, then the custom entry.
    expect(good.compareDocumentPosition(bad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bad.compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('adds a custom entry in any category, labelled by that category', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getDay).mockResolvedValue(null)
    renderDay(TODAY)

    await user.selectOptions(await screen.findByLabelText('Category'), 'Neutral')
    await user.type(screen.getByLabelText('Neutral thing'), 'Quiet evening')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(api.addSubEntry).toHaveBeenCalledWith(TODAY, 'Neutral', 'Quiet evening')
    expect(screen.getByLabelText('Category')).toHaveValue('Good')
  })

  it('links to the previous and next days', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail('2026-09-01'))
    renderDay('2026-09-01')

    expect(await screen.findByRole('link', { name: '← Previous day' })).toHaveAttribute('href', '/day/2026-08-31')
    expect(screen.getByRole('link', { name: 'Next day →' })).toHaveAttribute('href', '/day/2026-09-02')
  })

  it('has no next day link on today', async () => {
    vi.mocked(api.getDay).mockResolvedValue(dayDetail(TODAY))
    renderDay(TODAY)

    expect(await screen.findByRole('link', { name: '← Previous day' })).toHaveAttribute('href', `/day/${YESTERDAY}`)
    expect(screen.queryByRole('link', { name: 'Next day →' })).not.toBeInTheDocument()
  })

  it('loads the previous day when its link is followed', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getDay).mockImplementation((date) => Promise.resolve(dayDetail(date)))
    renderDay(TODAY)

    await user.click(await screen.findByRole('link', { name: '← Previous day' }))

    expect(api.getDay).toHaveBeenLastCalledWith(YESTERDAY)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(formatLongDate(YESTERDAY))
  })
})
