import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'
import SearchPage from './SearchPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, search: vi.fn() } }
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
    vi.mocked(api.search).mockReset()
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
})
