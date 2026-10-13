import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { HeatmapDay } from '../api/types'
import { useGridNavigation } from '../hooks/useGridNavigation'
import './DayBlock.css'
import { describeDay } from './describeDay'
import { dayColors } from './heatmapColors'
import RatingLegend from './RatingLegend'

const DAYS_PER_ROW = 30

// Inline styles (CLAUDE.md exception): Pico has no grid-of-colored-blocks primitive.
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `repeat(${DAYS_PER_ROW}, 1fr)`,
  gap: '3px',
  marginBottom: 'calc(var(--pico-spacing) / 2)',
}

const blockStyle: CSSProperties = {
  display: 'block',
  height: '2.5rem',
  borderRadius: '3px',
}

/**
 * One colored block per day, oldest on the left; each opens that day's detail view. The grid is a single tab stop
 * on the latest day, and the arrow keys move between days.
 */
export default function Heatmap({ days }: { days: HeatmapDay[] }) {
  const itemProps = useGridNavigation(days.length, DAYS_PER_ROW)

  return (
    <>
      <div style={gridStyle}>
        {days.map((day, index) => {
          const description = describeDay(day)
          return (
            <Link
              key={day.date}
              to={`/day/${day.date}`}
              aria-label={description}
              title={description}
              data-day-block
              style={{ ...blockStyle, ...dayColors(day) }}
              {...itemProps(index)}
            />
          )
        })}
      </div>
      <RatingLegend />
    </>
  )
}
