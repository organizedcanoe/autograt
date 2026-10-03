import { useState, type FormEvent } from 'react'
import { errorMessage } from '../utils/errors'
import Alert from './Alert'
import RatingSelect from './RatingSelect'

interface RatingFormProps {
  /** The day's current rating, or null if it hasn't been rated yet. */
  rating: number | null
  onSubmit: (rating: number) => Promise<void>
}

/** Rates a day for the first time or changes its rating. */
export default function RatingForm({ rating, onSubmit }: RatingFormProps) {
  const savedValue = rating === null ? '' : String(rating)
  const [value, setValue] = useState(savedValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(Number(value))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <RatingSelect label={rating === null ? 'How was your day?' : 'Change rating'} value={value} onChange={setValue} />
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" disabled={value === savedValue || submitting} aria-busy={submitting}>
        Save rating
      </button>
    </form>
  )
}
