import { useParams } from 'react-router'
import { api } from '../api/client'
import type { CreateEntryRequest, EntryCategory } from '../api/types'
import AsyncView from '../components/AsyncView'
import DailyEntryForm from '../components/DailyEntryForm'
import RatingForm from '../components/RatingForm'
import SubEntryCard from '../components/SubEntryCard'
import SubEntryForm from '../components/SubEntryForm'
import { useAsync } from '../hooks/useAsync'
import { formatLongDate, isIsoDate, isPastDate } from '../utils/dates'

export default function DayPage() {
  const { date } = useParams()
  if (!isIsoDate(date)) return <p>That isn't a valid date.</p>

  // Keyed so switching days starts from a clean state.
  return <DayView key={date} date={date} />
}

function DayView({ date }: { date: string }) {
  const day = useAsync(() => api.getDay(date), [date])
  // Past days are read-only apart from appending notes.
  const readOnly = isPastDate(date)

  async function createEntry(entry: CreateEntryRequest) {
    await api.createEntry(entry)
    day.reload()
  }

  async function updateRating(dayRating: number) {
    await api.updateRating(date, dayRating)
    day.reload()
  }

  async function addSubEntry(category: EntryCategory, content: string) {
    await api.addSubEntry(date, category, content)
    day.reload()
  }

  async function editSubEntry(subEntryId: number, category: EntryCategory, content: string) {
    await api.updateSubEntry(subEntryId, category, content)
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
              <p>{readOnly ? 'No entry was written for this day.' : 'No entry for this day yet.'}</p>
            </hgroup>
            {readOnly === false && <DailyEntryForm date={date} onSubmit={createEntry} />}
          </>
        ) : (
          <>
            <h1>
              {formatLongDate(date)}: {detail.dayRating}/10
            </h1>
            {readOnly ? (
              <p>Past days are read-only. You can still append notes.</p>
            ) : (
              <RatingForm key={detail.dayRating} rating={detail.dayRating} onSubmit={updateRating} />
            )}
            {detail.subEntries.length === 0 && <p>No entries yet.</p>}
            {detail.subEntries.map((subEntry) => (
              <SubEntryCard
                key={subEntry.id}
                subEntry={subEntry}
                onAppend={addAppend}
                onEdit={readOnly ? undefined : editSubEntry}
              />
            ))}
            {readOnly === false && (
              <section>
                <h2>Add an entry</h2>
                <SubEntryForm contentLabel="New entry" submitLabel="Add entry" onSubmit={addSubEntry} />
              </section>
            )}
          </>
        )
      }
    </AsyncView>
  )
}
