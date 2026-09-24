import { useState } from 'react'
import type { EntryCategory, SubEntry } from '../api/types'
import { formatTime } from '../utils/dates'
import AppendForm from './AppendForm'
import SubEntryForm from './SubEntryForm'

interface SubEntryCardProps {
  subEntry: SubEntry
  onAppend: (subEntryId: number, content: string) => Promise<void>
  /** Omitted when the sub-entry can't be edited, e.g. on a past day. */
  onEdit?: (subEntryId: number, category: EntryCategory, content: string) => Promise<void>
}

/** A sub-entry tagged with its category, its appended notes in order, and a form to append another. */
export default function SubEntryCard({ subEntry, onAppend, onEdit }: SubEntryCardProps) {
  const [editing, setEditing] = useState(false)

  async function saveEdit(category: EntryCategory, content: string) {
    await onEdit?.(subEntry.id, category, content)
    setEditing(false)
  }

  return (
    <article>
      <header>
        <strong>{subEntry.category}</strong> ·{' '}
        <small>
          <time dateTime={subEntry.createdAtUtc}>{formatTime(subEntry.createdAtUtc)}</time>
        </small>
        {onEdit && editing === false && (
          <>
            {' '}
            <button type="button" className="outline secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
          </>
        )}
      </header>
      {editing ? (
        <SubEntryForm
          initial={subEntry}
          contentLabel="Entry"
          submitLabel="Save"
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p>{subEntry.content}</p>
      )}
      {subEntry.appends.length > 0 && (
        <ul>
          {subEntry.appends.map((append) => (
            <li key={append.id}>
              <small>
                <time dateTime={append.createdAtUtc}>{formatTime(append.createdAtUtc)}</time>
              </small>{' '}
              — {append.content}
            </li>
          ))}
        </ul>
      )}
      <footer>
        <AppendForm subEntryId={subEntry.id} onSubmit={onAppend} />
      </footer>
    </article>
  )
}
