/**
 * The mean of the rated values in the `window` positions ending at each position (fewer at the start).
 * Unrated values are skipped rather than counted as 0; a window with no rated values gives null.
 */
export function rollingAverage(ratings: (number | null)[], window = 7): (number | null)[] {
  return ratings.map((_, index) => {
    const rated = ratings.slice(Math.max(0, index - window + 1), index + 1).filter((r): r is number => r !== null)
    return rated.length === 0 ? null : rated.reduce((sum, r) => sum + r, 0) / rated.length
  })
}
