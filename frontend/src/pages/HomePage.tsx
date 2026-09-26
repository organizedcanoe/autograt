import { api } from '../api/client'
import AsyncView from '../components/AsyncView'
import Heatmap from '../components/Heatmap'
import TodayJournal from '../components/TodayJournal'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate, todayIso } from '../utils/dates'

export default function HomePage() {
  const today = todayIso()
  const heatmap = useAsync(() => api.getHeatmap(today), [today])
  const todayEntry = useAsync(() => api.getDay(today), [today])

  function reload() {
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
        <AsyncView state={todayEntry}>{(day) => <TodayJournal date={today} day={day} onChange={reload} />}</AsyncView>
      </section>
    </>
  )
}
