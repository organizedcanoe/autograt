import HeatmapRange from '../components/HeatmapRange'
import JumpToDate from '../components/JumpToDate'
import MonthCalendar from '../components/MonthCalendar'

/** Browsing past days. Only the current month loads on open; everything else waits for the user. */
export default function HistoryPage() {
  return (
    <>
      <h1>History</h1>

      <section>
        <h2>Month calendar</h2>
        <MonthCalendar />
      </section>

      <section>
        <h2>Jump to a date</h2>
        <JumpToDate />
      </section>

      <section>
        <h2>Heatmap</h2>
        <HeatmapRange />
      </section>
    </>
  )
}
