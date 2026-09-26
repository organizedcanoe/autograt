import { useParams } from 'react-router'
import { api } from '../api/client'
import AsyncView from '../components/AsyncView'
import SubEntryCard from '../components/SubEntryCard'
import TodayJournal from '../components/TodayJournal'
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

  async function addAppend(subEntryId: number, content: string) {
    await api.addAppend(subEntryId, content)
    day.reload()
  }

  return (
    <AsyncView state={day}>
      {(detail) => {
        if (readOnly && detail === null) {
          return (
            <hgroup>
              <h1>{formatLongDate(date)}</h1>
              <p>No entry was written for this day.</p>
            </hgroup>
          )
        }

        const rating = detail?.dayRating ?? null
        return (
          <>
            <h1>
              {formatLongDate(date)}: {rating === null ? 'unrated' : `${rating}/10`}
            </h1>
            {readOnly ? (
              <>
                <p>Past days are read-only. You can still append notes.</p>
                {detail?.subEntries.length === 0 && <p>No entries were written.</p>}
                {detail?.subEntries.map((subEntry) => (
                  <SubEntryCard key={subEntry.id} subEntry={subEntry} onAppend={addAppend} />
                ))}
              </>
            ) : (
              <TodayJournal date={date} day={detail} onChange={day.reload} />
            )}
          </>
        )
      }}
    </AsyncView>
  )
}
