import { useState, type FormEvent } from 'react'
import { ENTRY_CATEGORIES, type EntryCategory } from '../api/types'
import { errorMessage } from '../utils/errors'

interface AddSubEntryFormProps {
  onSubmit: (category: EntryCategory, content: string) => Promise<void>
}

/** Adds a new top-level entry to a day that already has one. */
export default function AddSubEntryForm({ onSubmit }: AddSubEntryFormProps) {
  const [category, setCategory] = useState<EntryCategory>('Good')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(category, content.trim())
      setContent('')
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
        New entry
        <textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={content.trim() === '' || submitting} aria-busy={submitting}>
        Add entry
      </button>
    </form>
  )
}
