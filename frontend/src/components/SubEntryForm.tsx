import { useState, type FormEvent } from 'react'
import { ENTRY_CATEGORIES, type EntryCategory } from '../api/types'
import { errorMessage } from '../utils/errors'

interface SubEntryFormProps {
  /** The sub-entry being edited; omitted when adding a new one. */
  initial?: { category: EntryCategory; content: string }
  contentLabel: string
  submitLabel: string
  onSubmit: (category: EntryCategory, content: string) => Promise<void>
  /** Shows a cancel button when given. */
  onCancel?: () => void
}

/** Adds a new top-level entry to a day that already has one, or edits an existing entry. */
export default function SubEntryForm({ initial, contentLabel, submitLabel, onSubmit, onCancel }: SubEntryFormProps) {
  const [category, setCategory] = useState<EntryCategory>(initial?.category ?? 'Good')
  const [content, setContent] = useState(initial?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(category, content.trim())
      setContent(initial?.content ?? '')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as EntryCategory)}>
          {ENTRY_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        {contentLabel}
        <textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={content.trim() === '' || submitting} aria-busy={submitting}>
        {submitLabel}
      </button>{' '}
      {onCancel && (
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      )}
    </form>
  )
}
