import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { addDays, todayIso } from '../utils/dates'
import AsyncView from './AsyncView'
import Heatmap from './Heatmap'

interface RangeOption {
  label: string
  /** The first day of the range, which always ends today. */
  from: (today: string) => string
}

const lastDays = (days: number): RangeOption => ({
  label: `Last ${days} days`,
  from: (today) => addDays(today, -(days - 1)),
})

const RANGES: RangeOption[] = [
  lastDays(30),
  lastDays(60),
  lastDays(90),
  lastDays(365),
  { label: 'Year to date', from: (today) => `${today.slice(0, 4)}-01-01` },
]

interface DateRange {
  from: string
  to: string
}

/** A heatmap over a range the user picks. Nothing is loaded until they choose one. */
export default function HeatmapRange() {
  const [range, setRange] = useState<DateRange | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const option = RANGES[Number(new FormData(event.currentTarget).get('range'))]
    const today = todayIso()
    setRange({ from: option.from(today), to: today })
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <fieldset role="group">
          <select name="range" aria-label="Range" defaultValue="0">
            {RANGES.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit">Show</button>
        </fieldset>
      </form>
      {range && <RangeHeatmap key={`${range.from}..${range.to}`} {...range} />}
    </>
  )
}

function RangeHeatmap({ from, to }: DateRange) {
  const days = useAsync(() => api.getHeatmap(from, to), [from, to])
  return <AsyncView state={days}>{(loaded) => <Heatmap days={loaded} />}</AsyncView>
}
