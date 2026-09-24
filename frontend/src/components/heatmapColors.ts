export const NO_ENTRY_COLOR = '#c8ccd2'

const RED_HUE = 0
const GREEN_HUE = 120
const MAX_RATING = 10

/** One smooth scale from red (0) through amber to green (10), an equal hue step per rating point. */
export function ratingColor(rating: number | null): string {
  if (rating === null) return NO_ENTRY_COLOR
  const hue = RED_HUE + ((GREEN_HUE - RED_HUE) * rating) / MAX_RATING
  return `hsl(${hue}, 75%, 45%)`
}
