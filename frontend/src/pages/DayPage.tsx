import { useParams } from 'react-router'
import { api } from '../api/client'
import type { CreateEntryRequest, EntryCategory } from '../api/types'
import AddSubEntryForm from '../components/AddSubEntryForm'
import AsyncView from '../components/AsyncView'
import DailyEntryForm from '../components/DailyEntryForm'
import SubEntryCard from '../components/SubEntryCard'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate, isIsoDate } from '../utils/dates'

export default function DayPage() {
  const { date } = useParams()
  if (!isIsoDate(date)) return <p>That isn't a valid date.</p>

  // Keyed so switching days starts from a clean state.
  return <DayView key={date} date={date} />
}

function DayView({ date }: { date: string }) {
  const day = useAsync(() => api.getDay(date), [date])

  async function createEntry(entry: CreateEntryRequest) {
    await api.createEntry(entry)
    day.reload()
  }

  async function addSubEntry(category: EntryCategory, content: string) {
    await api.addSubEntry(date, category, content)
    day.reload()
  }

  async function addAppend(subEntryId: number, content: string) {
    await api.addAppend(subEntryId, content)
    day.reload()
  }

  return (
    <AsyncView state={day}>
      {(detail) =>
        detail === null ? (
          <>
            <hgroup>
              <h1>{formatLongDate(date)}</h1>
              <p>No entry for this day yet.</p>
            </hgroup>
            <DailyEntryForm date={date} onSubmit={createEntry} />
          </>
        ) : (
          <>
            <hgroup>
              <h1>{formatLongDate(date)}</h1>
              <p>Day rating: {detail.dayRating}/10</p>
            </hgroup>
            {detail.subEntries.length === 0 && <p>No entries yet.</p>}
            {detail.subEntries.map((subEntry) => (
              <SubEntryCard key={subEntry.id} subEntry={subEntry} onAppend={addAppend} />
            ))}
            <section>
              <h2>Add an entry</h2>
              <AddSubEntryForm onSubmit={addSubEntry} />
            </section>
          </>
        )
      }
    </AsyncView>
  )
}
