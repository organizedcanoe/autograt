import { useState } from 'react'
import type { EntryCategory, SubEntry } from '../api/types'
import { formatDateTime, formatTime } from '../utils/dates'
import { errorMessage } from '../utils/errors'
import Alert from './Alert'
import AppendForm from './AppendForm'
import { categorySectionTint, categoryTint } from './categoryColors'
import SubEntryForm from './SubEntryForm'

interface SubEntryCardProps {
  subEntry: SubEntry
  onAppend: (subEntryId: number, content: string) => Promise<void>
  /** Omitted when the sub-entry can't be edited, e.g. on a past day. */
  onEdit?: (subEntryId: number, category: EntryCategory, content: string) => Promise<void>
  /** Omitted when the sub-entry can't be deleted, e.g. on a past day. */
  onDelete?: (subEntryId: number) => Promise<void>
  /** Omitted when the appends can't be deleted, e.g. on a past day. */
  onDeleteAppend?: (appendId: number) => Promise<void>
}

/** A sub-entry tagged with its category, its appended notes in order, and a form to append another. */
export default function SubEntryCard({ subEntry, onAppend, onEdit, onDelete, onDeleteAppend }: SubEntryCardProps) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveEdit(category: EntryCategory, content: string) {
    await onEdit?.(subEntry.id, category, content)
    setEditing(false)
  }

  async function confirmDelete(question: string, deleteItem: () => Promise<void>) {
    if (!window.confirm(question)) return
    setError(null)
    try {
      await deleteItem()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // Inline styles (CLAUDE.md exception): the category tint, with a fainter one on the header and footer since Pico
  // paints them over the card's background.
  const tint = { backgroundColor: categoryTint(subEntry.category) }
  const sectionTint = { backgroundColor: categorySectionTint(subEntry.category) }

  return (
    <article style={tint}>
      <header data-row-actions style={sectionTint}>
        <span>
          <strong>{subEntry.category}</strong> ·{' '}
          <small>
            <time dateTime={subEntry.createdAtUtc}>{formatTime(subEntry.createdAtUtc)}</time>
          </small>
        </span>
        {editing === false && (onEdit || onDelete) && (
          <span data-row-actions>
            {onEdit && (
              <button type="button" className="outline secondary" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="outline secondary"
                onClick={() =>
                  confirmDelete('Delete this entry and its notes? This cannot be undone.', () => onDelete(subEntry.id))
                }
              >
                Delete
              </button>
            )}
          </span>
        )}
      </header>
      {error && <Alert kind="error">{error}</Alert>}
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
              {append.content}
              <br />
              <small>
                <time dateTime={append.createdAtUtc}>{formatDateTime(append.createdAtUtc)}</time>
              </small>
              {onDeleteAppend && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="outline secondary"
                    onClick={() =>
                      confirmDelete('Delete this note? This cannot be undone.', () => onDeleteAppend(append.id))
                    }
                  >
                    Delete note
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <footer style={sectionTint}>
        <AppendForm subEntryId={subEntry.id} onSubmit={onAppend} />
      </footer>
    </article>
  )
}
