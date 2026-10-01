import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'
import AsyncView from '../components/AsyncView'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate } from '../utils/dates'

/** Matches shown at a time, so a broad search stays a manageable list. */
const PAGE_SIZE = 10

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()

  if (!query) {
    return (
      <>
        <h1>Search</h1>
        <p>
          Type something in the search box. Separate words with commas to match any of them, or wrap text in
          "quotes" for an exact match.
        </p>
      </>
    )
  }

  return <SearchResults key={query} query={query} />
}

function SearchResults({ query }: { query: string }) {
  const results = useAsync(() => api.search(query), [query])
  const [shownCount, setShownCount] = useState(PAGE_SIZE)

  return (
    <>
      <h1>Results for “{query}”</h1>
      <AsyncView state={results}>
        {(matches) =>
          matches.length === 0 ? (
            <p>No matches.</p>
          ) : (
            <>
              <p>{matches.length === 1 ? '1 match' : `${matches.length} matches`}</p>
              {matches.slice(0, shownCount).map((match) => (
                <SearchResultCard key={`${match.type}-${match.appendId ?? match.subEntryId}`} match={match} />
              ))}
              {shownCount < matches.length && (
                <button type="button" className="secondary" onClick={() => setShownCount(shownCount + PAGE_SIZE)}>
                  Show more
                </button>
              )}
            </>
          )
        }
      </AsyncView>
    </>
  )
}

function SearchResultCard({ match }: { match: SearchResult }) {
  const kind = match.type === 'Append' ? `Note on a ${match.category} entry` : `${match.category} entry`

  return (
    <article>
      <header>
        <Link to={`/day/${match.entryDate}`}>{formatLongDate(match.entryDate)}</Link> · <small>{kind}</small>
      </header>
      <p>{match.content}</p>
    </article>
  )
}
