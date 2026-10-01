import type { HeatmapDay } from '../api/types'
import { formatShortDate } from '../utils/dates'

/** e.g. "Wed, Sep 23: rating 8, 2 entries", for screen readers and tooltips. */
export function describeDay(day: HeatmapDay): string {
  const date = formatShortDate(day.date)
  if (day.dayRating === null && day.entryCount === 0) return `${date}: no entry`
  const entries = day.entryCount === 1 ? '1 entry' : `${day.entryCount} entries`
  const rating = day.dayRating === null ? 'unrated' : `rating ${day.dayRating}`
  return `${date}: ${rating}, ${entries}`
}
