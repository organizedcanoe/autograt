import { api } from '../api/client'
import type { DayDetail, EntryCategory, SubEntry } from '../api/types'
import { assignNudgeSlots, NUDGE_SLOTS } from './nudgeSlots'
import RatingForm from './RatingForm'
import SubEntryCard from './SubEntryCard'
import SubEntryForm from './SubEntryForm'

const CUSTOM_PLACEHOLDERS: Record<EntryCategory, string> = {
  Good: 'Something else that went well…',
  Neutral: 'Something worth remembering…',
  Bad: 'Something else that could have gone better…',
}

interface TodayJournalProps {
  date: string
  /** The day so far, or null before anything has been saved for it. */
  day: DayDetail | null
  /** Called after each save or delete so the caller can reload the day. */
  onChange: () => void
}

/**
 * Today's editable journal: the rating, the fixed good/good/bad nudge boxes (each replaced in place by its
 * entry once saved), any custom entries, and a form for adding custom entries of any category.
 */
export default function TodayJournal({ date, day, onChange }: TodayJournalProps) {
  const rating = day?.dayRating ?? null
  const { slotted, custom } = assignNudgeSlots(day?.subEntries ?? [])

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

  async function deleteSubEntry(subEntryId: number) {
    await api.deleteSubEntry(subEntryId)
    onChange()
  }

  async function addAppend(subEntryId: number, content: string) {
    await api.addAppend(subEntryId, content)
    onChange()
  }

  async function deleteAppend(appendId: number) {
    await api.deleteAppend(appendId)
    onChange()
  }

  function renderSubEntry(subEntry: SubEntry, key: string | number) {
    return (
      <SubEntryCard
        key={key}
        subEntry={subEntry}
        onAppend={addAppend}
        onEdit={editSubEntry}
        onDelete={deleteSubEntry}
        onDeleteAppend={deleteAppend}
      />
    )
  }

  return (
    <>
      <RatingForm key={rating ?? 'unrated'} rating={rating} onSubmit={updateRating} />

      {NUDGE_SLOTS.map((slot, index) => {
        const subEntry = slotted[index]
        return subEntry ? (
          renderSubEntry(subEntry, slot.label)
        ) : (
          <SubEntryForm
            key={slot.label}
            initial={{ category: slot.category, content: '' }}
            lockCategory
            contentLabel={slot.label}
            placeholder={slot.placeholder}
            submitLabel="Save"
            onSubmit={addSubEntry}
          />
        )
      })}

      {custom.map((subEntry) => renderSubEntry(subEntry, subEntry.id))}

      <hr />
      <h2>Custom Entry</h2>
      <SubEntryForm
        contentLabel={(category) => `${category} thing`}
        placeholder={(category) => CUSTOM_PLACEHOLDERS[category]}
        submitLabel="Add entry"
        onSubmit={addSubEntry}
      />
    </>
  )
}
