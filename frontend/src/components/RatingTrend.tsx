import { useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { addDays, todayIso } from '../utils/dates'
import AsyncView from './AsyncView'
import RatingTrendChart from './RatingTrendChart'

// The heatmap endpoint covers at most 366 days.
const RANGES = [30, 90, 365]

/** The rating trend over a range the user picks, ending today. The last 30 days load on open. */
export default function RatingTrend() {
  const [days, setDays] = useState(RANGES[0])
  const today = todayIso()
  const from = addDays(today, -(days - 1))
  const trend = useAsync(() => api.getHeatmap(from, today), [from, today])

  return (
    <>
      <select aria-label="Range" value={days} onChange={(event) => setDays(Number(event.target.value))}>
        {RANGES.map((range) => (
          <option key={range} value={range}>
            Last {range} days
          </option>
        ))}
      </select>
      <AsyncView state={trend}>{(loaded) => <RatingTrendChart days={loaded} />}</AsyncView>
    </>
  )
}
