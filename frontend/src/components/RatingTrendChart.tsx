import { useId, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import type { HeatmapDay } from '../api/types'
import { formatShortDate } from '../utils/dates'
import { rollingAverage } from '../utils/rollingAverage'
import { describeDay } from './describeDay'
import { ratingColor } from './heatmapColors'

// Drawn in viewBox units; the SVG scales to the width of the page.
const WIDTH = 600
const HEIGHT = 220
const PLOT = { left: 28, right: WIDTH - 12, top: 10, bottom: HEIGHT - 26 }
const MAX_RATING = 10
const RATING_TICKS = [0, 5, 10]

// Inline SVG styles (CLAUDE.md exception): Pico has no chart primitives; the colors follow its theme variables.
const gridLineStyle = { stroke: 'var(--pico-muted-border-color)' }
const labelStyle = { fill: 'var(--pico-muted-color)', fontSize: 11 }
const averageLineStyle = { fill: 'none', stroke: 'var(--pico-primary)', strokeWidth: 2 }

/**
 * Each rated day as a dot colored like the heatmap (unrated days are gaps), with a line for the 7-day rolling
 * average. Clicking a dot opens that day.
 */
export default function RatingTrendChart({ days }: { days: HeatmapDay[] }) {
  const navigate = useNavigate()
  const summaryId = useId()
  if (days.length === 0) return null

  const step = days.length > 1 ? (PLOT.right - PLOT.left) / (days.length - 1) : 0
  const x = (index: number) => PLOT.left + index * step
  const y = (rating: number) => PLOT.bottom - ((PLOT.bottom - PLOT.top) * rating) / MAX_RATING
  const dotRadius = Math.min(4, Math.max(1.5, step / 2))
  const dateLabels = [0, Math.floor((days.length - 1) / 2), days.length - 1]

  function openDay(event: MouseEvent, date: string) {
    event.preventDefault()
    navigate(`/day/${date}`)
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="group"
      aria-label="Rating trend"
      aria-describedby={summaryId}
    >
      <desc id={summaryId}>{summarise(days)}</desc>
      {RATING_TICKS.map((rating) => (
        <g key={rating}>
          <line x1={PLOT.left} x2={PLOT.right} y1={y(rating)} y2={y(rating)} style={gridLineStyle} />
          <text x={PLOT.left - 6} y={y(rating)} textAnchor="end" dominantBaseline="middle" style={labelStyle}>
            {rating}
          </text>
        </g>
      ))}

      {[...new Set(dateLabels)].map((index) => (
        <text key={index} x={x(index)} y={HEIGHT - 6} textAnchor={anchorFor(index, days.length)} style={labelStyle}>
          {formatShortDate(days[index].date)}
        </text>
      ))}

      <path data-testid="rolling-average" d={linePath(rollingAverage(days.map((day) => day.dayRating)), x, y)} style={averageLineStyle} />

      {days.map((day, index) => {
        if (day.dayRating === null) return null
        const description = describeDay(day)
        return (
          <a key={day.date} href={`/day/${day.date}`} aria-label={description} onClick={(event) => openDay(event, day.date)}>
            <title>{description}</title>
            <circle cx={x(index)} cy={y(day.dayRating)} r={dotRadius} fill={ratingColor(day.dayRating)} />
          </a>
        )
      })}
    </svg>
  )
}

/** e.g. "Sep 1 to Sep 30: 21 rated days, average 6.4." */
function summarise(days: HeatmapDay[]): string {
  const ratedDays = days.filter((day) => day.dayRating !== null)
  const range = `${formatShortDate(days[0].date)} to ${formatShortDate(days[days.length - 1].date)}`
  if (ratedDays.length === 0) return `${range}: no rated days.`
  const average = ratedDays.reduce((sum, day) => sum + day.dayRating!, 0) / ratedDays.length
  const count = ratedDays.length === 1 ? '1 rated day' : `${ratedDays.length} rated days`
  return `${range}: ${count}, average ${average.toFixed(1)}.`
}

/** An SVG path through the non-null values, starting a new segment after each gap. */
function linePath(values: (number | null)[], x: (index: number) => number, y: (value: number) => number): string {
  let path = ''
  let inSegment = false
  values.forEach((value, index) => {
    if (value === null) {
      inSegment = false
      return
    }
    path += `${inSegment ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)} `
    inSegment = true
  })
  return path.trim()
}

/** Keeps the first and last date labels inside the chart. */
function anchorFor(index: number, count: number): 'start' | 'middle' | 'end' {
  if (index === 0) return 'start'
  return index === count - 1 ? 'end' : 'middle'
}
