import { describe, expect, it } from 'vitest'
import { NO_ENTRY_COLOR, ratingColor, ratingTextColor } from './heatmapColors'

const RATINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function hueOf(color: string): number {
  const match = /^hsl\((\d+(?:\.\d+)?),/.exec(color)
  if (match === null) throw new Error(`Not an hsl() color: ${color}`)
  return Number(match[1])
}

/** [r, g, b] in 0–1 for a CSS `hsl(h, s%, l%)` or `#rrggbb` color. */
function toRgb(color: string): number[] {
  const hsl = /^hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)$/.exec(color)
  if (hsl === null) return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
  const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100]
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [channel(0), channel(8), channel(4)]
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(color: string): number {
  const [r, g, b] = toRgb(color).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
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

describe('ratingTextColor', () => {
  it.each(RATINGS)('is readable on the colour for rating %i', (rating) => {
    expect(contrast(ratingTextColor(rating), ratingColor(rating))).toBeGreaterThanOrEqual(4.5)
  })
})
