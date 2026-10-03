import { describe, expect, it } from 'vitest'
import { findHighlights, parseSearchTerms } from './searchTerms'

describe('parseSearchTerms', () => {
  it('treats a quoted query as one exact, case-sensitive term without splitting on commas', () => {
    expect(parseSearchTerms('"dog, cat"')).toEqual({ terms: ['dog, cat'], caseSensitive: true })
  })

  it('splits a comma-separated query into trimmed terms, dropping empty ones', () => {
    expect(parseSearchTerms(' dog,  cat ,, ')).toEqual({ terms: ['dog', 'cat'], caseSensitive: false })
  })

  it('treats any other query as one case-insensitive term', () => {
    expect(parseSearchTerms('  walked the dog ')).toEqual({ terms: ['walked the dog'], caseSensitive: false })
  })

  it('has no terms for an empty query or empty quotes', () => {
    expect(parseSearchTerms('   ').terms).toEqual([])
    expect(parseSearchTerms('""').terms).toEqual([])
  })
})

describe('findHighlights', () => {
  it('finds every occurrence of a term, ignoring case', () => {
    expect(findHighlights('Dog walked the dog', 'dog')).toEqual([
      { start: 0, length: 3 },
      { start: 15, length: 3 },
    ])
  })

  it('finds every term of a comma-separated query, in order', () => {
    expect(findHighlights('Fed the cat and the dog', 'dog, cat')).toEqual([
      { start: 8, length: 3 },
      { start: 20, length: 3 },
    ])
  })

  it('merges overlapping and adjacent matches', () => {
    expect(findHighlights('a doghouse', 'dog, ghouse')).toEqual([{ start: 2, length: 8 }])
    expect(findHighlights('dogcat', 'dog, cat')).toEqual([{ start: 0, length: 6 }])
  })

  it('matches case when the query is quoted', () => {
    expect(findHighlights('dog Dog', '"Dog"')).toEqual([{ start: 4, length: 3 }])
  })

  it('treats regex characters literally', () => {
    expect(findHighlights('Done (finally). Yes.', '(finally).')).toEqual([{ start: 5, length: 10 }])
  })

  it('finds nothing for an empty query', () => {
    expect(findHighlights('Walked the dog', '')).toEqual([])
  })
})
