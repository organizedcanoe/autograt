import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'
import AsyncView from '../components/AsyncView'
import HeatmapRange from '../components/HeatmapRange'
import JumpToDate from '../components/JumpToDate'
import MonthCalendar from '../components/MonthCalendar'
import SearchBar from '../components/SearchBar'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate } from '../utils/dates'

/** Matches shown at a time, so a broad search doesn't push the browse tools far down the page. */
const PAGE_SIZE = 10

/** Searching and browsing the journal. Only searches and the user's own choices load anything. */
export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()

  return (
    <>
      <h1>Search</h1>
      {/* Both are keyed by the query, so the box shows the current search and the results start from page one. */}
      <SearchBar key={`bar-${query}`} initialQuery={query} />
      {query ? (
        <SearchResults key={`results-${query}`} query={query} />
      ) : (
        <p>
          Type something in the search box. Separate words with commas to match any of them, or wrap text in "quotes"
          for an exact match.
        </p>
      )}

      <section>
        <h2>Jump to a date</h2>
        <JumpToDate />
      </section>

      <section>
        <h2>Month calendar</h2>
        <MonthCalendar />
      </section>

      <section>
        <h2>Heatmap</h2>
        <HeatmapRange />
      </section>
    </>
  )
}

function SearchResults({ query }: { query: string }) {
  const results = useAsync(() => api.search(query), [query])
  const [shownCount, setShownCount] = useState(PAGE_SIZE)

  return (
    <section>
      <h2>Results for “{query}”</h2>
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
    </section>
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
