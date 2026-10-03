import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'
import AsyncView from '../components/AsyncView'
import { categoryTint } from '../components/categoryColors'
import SearchBar from '../components/SearchBar'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate } from '../utils/dates'
import { findHighlights } from '../utils/searchTerms'

/** Matches shown at a time, so a broad search stays a manageable list. */
const PAGE_SIZE = 10

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()

  return (
    <>
      {/* Both are keyed by the query, so the box shows the current search and the results start from page one. */}
      <SearchBar key={`bar-${query}`} initialQuery={query} />
      {query ? (
        <SearchResults key={`results-${query}`} query={query} />
      ) : (
        <>
          <h1>Search</h1>
          <p>
            Type something in the search box. Separate words with commas to match any of them, or wrap text in
            "quotes" for an exact match.
          </p>
        </>
      )}
    </>
  )
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
                <SearchResultCard key={`${match.type}-${match.appendId ?? match.subEntryId}`} match={match} query={query} />
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

function SearchResultCard({ match, query }: { match: SearchResult; query: string }) {
  const kind = match.type === 'Append' ? `Note on a ${match.category} entry` : `${match.category} entry`

  return (
    <article style={{ backgroundColor: categoryTint(match.category) }}>
      <header>
        <Link to={`/day/${match.entryDate}`}>{formatLongDate(match.entryDate)}</Link> · <small>{kind}</small>
      </header>
      <p>
        <HighlightedText content={match.content} query={query} />
      </p>
    </article>
  )
}

/** The content with each match of the query wrapped in `<mark>`. */
function HighlightedText({ content, query }: { content: string; query: string }) {
  const parts: ReactNode[] = []
  let position = 0
  for (const { start, length } of findHighlights(content, query)) {
    parts.push(
      content.slice(position, start),
      // Pico pads <mark>, which pushes highlighted words apart from the surrounding text.
      <mark key={start} style={{ padding: 0 }}>
        {content.slice(start, start + length)}
      </mark>,
    )
    position = start + length
  }
  parts.push(content.slice(position))

  return <>{parts}</>
}
