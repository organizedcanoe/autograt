import { useState, type FormEvent } from 'react'
import { ENTRY_CATEGORIES, type EntryCategory } from '../api/types'
import { errorMessage } from '../utils/errors'
import { categoryTint } from './categoryColors'

type TextForCategory = string | ((category: EntryCategory) => string)

function resolve(text: TextForCategory, category: EntryCategory): string {
  return typeof text === 'string' ? text : text(category)
}

interface SubEntryFormProps {
  /** The sub-entry being edited; omitted when adding a new one. */
  initial?: { category: EntryCategory; content: string }
  /** Hides the category picker so the entry keeps its initial category. */
  lockCategory?: boolean
  /** Text for the content box, or a function of the chosen category. */
  contentLabel: TextForCategory
  placeholder?: TextForCategory
  submitLabel: string
  onSubmit: (category: EntryCategory, content: string) => Promise<void>
  /** Shows a cancel button when given. */
  onCancel?: () => void
}

/** Adds a new top-level entry to a day, or edits an existing entry. */
export default function SubEntryForm({
  initial,
  lockCategory = false,
  contentLabel,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: SubEntryFormProps) {
  const initialCategory = initial?.category ?? 'Good'
  const [category, setCategory] = useState<EntryCategory>(initialCategory)
  const [content, setContent] = useState(initial?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(category, content.trim())
      setCategory(initialCategory)
      setContent(initial?.content ?? '')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {lockCategory === false && (
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
      )}
      <label>
        {resolve(contentLabel, category)}
        <textarea
          rows={2}
          placeholder={placeholder && resolve(placeholder, category)}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ backgroundColor: categoryTint(category) }}
        />
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
