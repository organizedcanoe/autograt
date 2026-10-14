import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { HeatmapDay } from '../api/types'
import { describeDay } from './describeDay'
import { ratingColor } from './heatmapColors'

// Inline styles (CLAUDE.md exception): Pico has no grid-of-colored-blocks primitive.
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
            style={{ ...blockStyle, backgroundColor: ratingColor(day.dayRating) }}
          />
        )
      })}
    </div>
  )
}
