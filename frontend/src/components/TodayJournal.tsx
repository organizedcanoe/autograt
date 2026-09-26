import { api } from '../api/client'
import type { DayDetail, EntryCategory } from '../api/types'
import EntryDrafts from './EntryDrafts'
import RatingForm from './RatingForm'
import SubEntryCard from './SubEntryCard'

interface TodayJournalProps {
  date: string
  /** The day so far, or null before anything has been saved for it. */
  day: DayDetail | null
  /** Called after each save so the caller can reload the day. */
  onChange: () => void
}

/** Today's editable journal: the rating, the saved entries, and boxes for adding entries one at a time. */
export default function TodayJournal({ date, day, onChange }: TodayJournalProps) {
  const rating = day?.dayRating ?? null
  const subEntries = day?.subEntries ?? []

  async function updateRating(dayRating: number) {
    await api.updateRating(date, dayRating)
    onChange()
  }

  async function addSubEntry(category: EntryCategory, content: string) {
    await api.addSubEntry(date, category, content)
    onChange()
  }

  async function editSubEntry(subEntryId: number, category: EntryCategory, content: string) {
    await api.updateSubEntry(subEntryId, category, content)
    onChange()
  }

  async function addAppend(subEntryId: number, content: string) {
    await api.addAppend(subEntryId, content)
    onChange()
  }

  return (
    <>
      <RatingForm key={rating ?? 'unrated'} rating={rating} onSubmit={updateRating} />
      {subEntries.map((subEntry) => (
        <SubEntryCard key={subEntry.id} subEntry={subEntry} onAppend={addAppend} onEdit={editSubEntry} />
      ))}
      <EntryDrafts nudge={subEntries.length === 0} onAdd={addSubEntry} />
    </>
  )
}
