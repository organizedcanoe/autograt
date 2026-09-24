import { Link } from 'react-router'
import { api } from '../api/client'
import type { CreateEntryRequest } from '../api/types'
import AsyncView from '../components/AsyncView'
import DailyEntryForm from '../components/DailyEntryForm'
import Heatmap from '../components/Heatmap'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate, todayIso } from '../utils/dates'

export default function HomePage() {
  const today = todayIso()
  const heatmap = useAsync(() => api.getHeatmap(today), [today])
  const todayEntry = useAsync(() => api.getDay(today), [today])

  async function createEntry(entry: CreateEntryRequest) {
    await api.createEntry(entry)
    heatmap.reload()
    todayEntry.reload()
  }

  return (
    <>
      <section>
        <h2>Last 30 days</h2>
        <AsyncView state={heatmap}>{(days) => <Heatmap days={days} />}</AsyncView>
      </section>

      <section>
        <h2>{formatLongDate(today)}</h2>
        <AsyncView state={todayEntry}>
          {(day) =>
            day === null ? (
              <DailyEntryForm date={today} onSubmit={createEntry} />
            ) : (
              <p>
                You rated today {day.dayRating}/10. <Link to={`/day/${today}`}>Open today</Link> to edit entries or
                append notes.
              </p>
            )
          }
        </AsyncView>
      </section>
    </>
  )
}
