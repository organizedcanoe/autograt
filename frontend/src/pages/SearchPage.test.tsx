import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'
import SearchPage from './SearchPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, search: vi.fn(), getHeatmap: vi.fn() } }
})

const results: SearchResult[] = [
  {
    type: 'SubEntry',
    subEntryId: 1,
    appendId: null,
    category: 'Good',
    content: 'Walked the dog',
    entryDate: '2026-09-20',
    createdAtUtc: '2026-09-20T18:00:00Z',
  },
  {
    type: 'Append',
    subEntryId: 2,
    appendId: 7,
    category: 'Bad',
    content: 'Dog got wet',
    entryDate: '2026-09-21',
    createdAtUtc: '2026-09-21T19:00:00Z',
  },
]

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SearchPage', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('searches for the query in the URL and links each match to its day', async () => {
    vi.mocked(api.search).mockResolvedValue(results)

    renderAt('/search?q=dog')

    const matches = await screen.findAllByRole('article')
    expect(api.search).toHaveBeenCalledWith('dog')
    expect(matches).toHaveLength(2)
    expect(matches[0]).toHaveTextContent('Walked the dog')
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/day/2026-09-20',
      '/day/2026-09-21',
    ])
    expect(matches[1]).toHaveTextContent(/note/i)
  })

  it('says so when nothing matches', async () => {
    vi.mocked(api.search).mockResolvedValue([])

    renderAt('/search?q=zebra')

    expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
  })

  it('asks for a query instead of searching when it is empty', () => {
    renderAt('/search')

    expect(api.search).not.toHaveBeenCalled()
    expect(screen.getByText(/type something/i)).toBeInTheDocument()
  })

  it('has its own search bar showing the current query', async () => {
    vi.mocked(api.search).mockResolvedValue([])

    renderAt('/search?q=dog')

    expect(screen.getByRole('searchbox', { name: 'Search journal' })).toHaveValue('dog')
    await screen.findByText(/no matches/i)
  })

  it('offers the browse tools without loading anything from the server', () => {
    renderAt('/search')

    expect(screen.getByRole('heading', { name: 'Jump to a date' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Month calendar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heatmap' })).toBeInTheDocument()
    expect(api.search).not.toHaveBeenCalled()
    expect(api.getHeatmap).not.toHaveBeenCalled()
  })

  it('shows matches a page at a time so the browse tools stay close', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 25 }, (_, index) => ({ ...results[0], subEntryId: index + 1 }))
    vi.mocked(api.search).mockResolvedValue(many)

    renderAt('/search?q=e')

    expect(await screen.findAllByRole('article')).toHaveLength(10)
    expect(screen.getByText('25 matches')).toBeInTheDocument()
    const showMore = screen.getByRole('button', { name: 'Show more' })
    const jumpHeading = screen.getByRole('heading', { name: 'Jump to a date' })
    expect(showMore.compareDocumentPosition(jumpHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(showMore)
    expect(screen.getAllByRole('article')).toHaveLength(20)

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getAllByRole('article')).toHaveLength(25)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('names a single match in the singular', async () => {
    vi.mocked(api.search).mockResolvedValue([results[0]])

    renderAt('/search?q=walked')

    const article = await screen.findByRole('article')
    expect(within(article).getByText('Walked the dog')).toBeInTheDocument()
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })
})
