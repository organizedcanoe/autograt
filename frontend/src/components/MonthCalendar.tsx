import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { HeatmapDay } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useGridNavigation, type GridItemProps } from '../hooks/useGridNavigation'
import { addMonths, formatMonth, monthDates, todayIso, weekdayNames, weekdayOf } from '../utils/dates'
import AsyncView from './AsyncView'
import './DayBlock.css'
import { describeDay } from './describeDay'
import { dayColors } from './heatmapColors'
import RatingLegend from './RatingLegend'

// Inline styles (CLAUDE.md exception): each day is colored by its rating, like the heatmap blocks.
const dayStyle: CSSProperties = {
  display: 'block',
  padding: 'calc(var(--pico-spacing) / 4)',
  borderRadius: '3px',
  textAlign: 'center',
  textDecoration: 'none',
}

const DAYS_PER_WEEK = 7

/** A month at a time, each day colored by its rating, starting on the current month. */
export default function MonthCalendar() {
  const thisMonth = todayIso().slice(0, 7)
  const [pickedMonth, setPickedMonth] = useState(thisMonth)
  const [shownMonth, setShownMonth] = useState(thisMonth)

  function show(month: string) {
    setPickedMonth(month)
    setShownMonth(month)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pickedMonth) show(pickedMonth)
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <fieldset role="group">
          <input
            type="month"
            aria-label="Month"
            max={thisMonth}
            value={pickedMonth}
            onChange={(event) => setPickedMonth(event.target.value)}
            required
          />
          <button type="submit">Show</button>
        </fieldset>
      </form>
      <MonthGrid key={shownMonth} month={shownMonth} />
      <RatingLegend />
      <nav>
        <ul>
          <li>
            <button type="button" className="secondary outline" onClick={() => show(addMonths(shownMonth, -1))}>
              ← Previous month
            </button>
          </li>
        </ul>
        <ul>
          <li>
            <button
              type="button"
              className="secondary outline"
              onClick={() => show(addMonths(shownMonth, 1))}
              disabled={shownMonth >= thisMonth}
            >
              Next month →
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}

function MonthGrid({ month }: { month: string }) {
  const dates = monthDates(month)
  const days = useAsync(() => api.getHeatmap(dates[0], dates[dates.length - 1]), [month])

  return <AsyncView state={days}>{(loaded) => <MonthTable month={month} days={loaded} />}</AsyncView>
}

/**
 * The month as a Sunday-to-Saturday table. The linked days are a single tab stop on the latest, and the arrow keys
 * move by day and by week.
 */
function MonthTable({ month, days }: { month: string; days: HeatmapDay[] }) {
  const today = todayIso()
  const itemProps = useGridNavigation(days.filter((day) => day.date <= today).length, DAYS_PER_WEEK)

  return (
    <table aria-label={formatMonth(month)}>
      <thead>
        <tr>
          {weekdayNames().map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {toWeeks(days).map((week) => (
          <tr key={week.find((day) => day !== null)!.date}>
            {week.map((day, index) => (
              <td key={day?.date ?? `blank-${index}`}>
                {day && <CalendarDay day={day} navigation={itemProps(days.indexOf(day))} />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A day up to today links to its day view and shows its rating under the date; a later day is plain text. */
function CalendarDay({ day, navigation }: { day: HeatmapDay; navigation: GridItemProps }) {
  const dayOfMonth = Number(day.date.slice(8))
  if (day.date > todayIso()) return <span style={dayStyle}>{dayOfMonth}</span>

  const description = describeDay(day)
  return (
    <Link
      to={`/day/${day.date}`}
      aria-label={description}
      title={description}
      data-day-block
      style={{ ...dayStyle, ...dayColors(day) }}
      {...navigation}
    >
      {dayOfMonth}
      {day.dayRating !== null && (
        <>
          <br />
          <small>{day.dayRating}</small>
        </>
      )}
    </Link>
  )
}

/** Splits a month's days into Sunday-to-Saturday weeks, padding the first and last with blanks. */
function toWeeks(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  const leadingBlanks = Array<null>(weekdayOf(days[0].date)).fill(null)
  const cells: (HeatmapDay | null)[] = [...leadingBlanks, ...days]
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null)

  const weeks: (HeatmapDay | null)[][] = []
  for (let start = 0; start < cells.length; start += DAYS_PER_WEEK) {
    weeks.push(cells.slice(start, start + DAYS_PER_WEEK))
  }
  return weeks
}
