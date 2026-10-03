export interface SearchTerms {
  terms: string[]
  caseSensitive: boolean
}

export interface Highlight {
  start: number
  length: number
}

/**
 * Splits a search query into terms using the server's rules (keep in sync with
 * backend/Autograt.Api/Services/SearchQueryParser.cs): `"quoted"` is one exact, case-sensitive term;
 * `a, b` matches any term; anything else is one term. Unquoted terms ignore case.
 */
export function parseSearchTerms(raw: string): SearchTerms {
  const query = raw.trim()

  if (query.length >= 2 && query.startsWith('"') && query.endsWith('"')) {
    const exact = query.slice(1, -1)
    return { terms: exact ? [exact] : [], caseSensitive: true }
  }

  if (query.includes(',')) {
    const terms = query
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0)
    return { terms, caseSensitive: false }
  }

  return { terms: query ? [query] : [], caseSensitive: false }
}

/** Finds every occurrence of the query's terms in the content, merging overlapping and adjacent matches. */
export function findHighlights(content: string, query: string): Highlight[] {
  const { terms, caseSensitive } = parseSearchTerms(query)
  const haystack = caseSensitive ? content : content.toLowerCase()

  const ranges: { start: number; end: number }[] = []
  for (const term of terms) {
    const needle = caseSensitive ? term : term.toLowerCase()
    for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
      ranges.push({ start: index, end: index + needle.length })
    }
  }
  ranges.sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  return merged.map(({ start, end }) => ({ start, length: end - start }))
}
