export type RatingBand = 'none' | 'bad' | 'neutral' | 'good'

export const NO_ENTRY_COLOR = '#c8ccd2'

// Within each band, the color deepens toward the extreme: 0 is the deepest red, 10 the deepest green.
const BAD_SHADES = ['#991b1b', '#b91c1c', '#dc2626', '#ef4444'] // 0–3
const NEUTRAL_SHADES = ['#d97706', '#f59e0b', '#fbbf24'] // 4–6
const GOOD_SHADES = ['#86efac', '#4ade80', '#22c55e', '#15803d'] // 7–10

export function ratingBand(rating: number | null): RatingBand {
  if (rating === null) return 'none'
  if (rating <= 3) return 'bad'
  if (rating <= 6) return 'neutral'
  return 'good'
}

export function ratingColor(rating: number | null): string {
  if (rating === null) return NO_ENTRY_COLOR
  if (rating <= 3) return BAD_SHADES[rating]
  if (rating <= 6) return NEUTRAL_SHADES[rating - 4]
  return GOOD_SHADES[rating - 7]
}
