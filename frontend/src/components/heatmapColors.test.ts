import { describe, expect, it } from 'vitest'
import { NO_ENTRY_COLOR, ratingBand, ratingColor } from './heatmapColors'

describe('ratingBand', () => {
  it.each([
    [null, 'none'],
    [0, 'bad'],
    [3, 'bad'],
    [4, 'neutral'],
    [6, 'neutral'],
    [7, 'good'],
    [10, 'good'],
  ] as const)('maps rating %s to %s', (rating, band) => {
    expect(ratingBand(rating)).toBe(band)
  })
})

describe('ratingColor', () => {
  it('uses the muted grey for days without an entry', () => {
    expect(ratingColor(null)).toBe(NO_ENTRY_COLOR)
  })

  it('gives every rating in a band a distinct shade', () => {
    const shades = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ratingColor)

    expect(new Set(shades).size).toBe(11)
    expect(shades).not.toContain(NO_ENTRY_COLOR)
  })
})
