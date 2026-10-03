import { useState, type FormEvent } from 'react'
import { errorMessage } from '../utils/errors'
import Alert from './Alert'

interface AppendFormProps {
  subEntryId: number
  onSubmit: (subEntryId: number, content: string) => Promise<void>
}

/** Adds an immutable note under one sub-entry. */
export default function AppendForm({ subEntryId, onSubmit }: AppendFormProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(subEntryId, content.trim())
      setContent('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset role="group">
        <input
          aria-label="Add a note"
          placeholder="Add a note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit" disabled={content.trim() === '' || submitting} aria-busy={submitting}>
          Append
        </button>
      </fieldset>
      {error && <Alert kind="error">{error}</Alert>}
    </form>
  )
}
