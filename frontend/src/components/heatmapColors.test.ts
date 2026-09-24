import { describe, expect, it } from 'vitest'
import { NO_ENTRY_COLOR, ratingColor } from './heatmapColors'

const RATINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function hueOf(color: string): number {
  const match = /^hsl\((\d+(?:\.\d+)?),/.exec(color)
  if (match === null) throw new Error(`Not an hsl() color: ${color}`)
  return Number(match[1])
}

describe('ratingColor', () => {
  it('uses the muted grey for days without an entry', () => {
    expect(ratingColor(null)).toBe(NO_ENTRY_COLOR)
  })

  it('gives every rating a distinct color', () => {
    const colors = RATINGS.map(ratingColor)

    expect(new Set(colors).size).toBe(RATINGS.length)
    expect(colors).not.toContain(NO_ENTRY_COLOR)
  })

  it('runs from red at 0 to green at 10', () => {
    expect(hueOf(ratingColor(0))).toBe(0)
    expect(hueOf(ratingColor(10))).toBe(120)
  })

  it('gets steadily greener as the rating rises', () => {
    const hues = RATINGS.map((rating) => hueOf(ratingColor(rating)))

    hues.slice(1).forEach((hue, i) => expect(hue).toBeGreaterThan(hues[i]))
  })
})
