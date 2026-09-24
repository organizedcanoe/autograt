import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { HeatmapDay } from '../api/types'
import { formatShortDate } from '../utils/dates'
import { ratingBand, ratingColor } from './heatmapColors'

// Inline styles are allowed only here (CLAUDE.md): Pico has no grid-of-colored-blocks primitive.
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(30, 1fr)',
  gap: '3px',
  marginBottom: 'var(--pico-spacing)',
}

const blockStyle: CSSProperties = {
  display: 'block',
  height: '2.5rem',
  borderRadius: '3px',
}

function describeDay(day: HeatmapDay): string {
  const date = formatShortDate(day.date)
  if (day.dayRating === null) return `${date}: no entry`
  const entries = day.entryCount === 1 ? '1 entry' : `${day.entryCount} entries`
  return `${date}: rating ${day.dayRating}, ${entries}`
}

/** One colored block per day, oldest on the left; each opens that day's detail view. */
export default function Heatmap({ days }: { days: HeatmapDay[] }) {
  return (
    <div style={gridStyle}>
      {days.map((day) => {
        const description = describeDay(day)
        return (
          <Link
            key={day.date}
            to={`/day/${day.date}`}
            aria-label={description}
            title={description}
            data-band={ratingBand(day.dayRating)}
            style={{ ...blockStyle, backgroundColor: ratingColor(day.dayRating) }}
          />
        )
      })}
    </div>
  )
}
