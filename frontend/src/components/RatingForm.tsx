import { useState, type FormEvent } from 'react'
import { errorMessage } from '../utils/errors'
import RatingSelect from './RatingSelect'

interface RatingFormProps {
  rating: number
  onSubmit: (rating: number) => Promise<void>
}

/** Changes the rating of a day that already has an entry. */
export default function RatingForm({ rating, onSubmit }: RatingFormProps) {
  const [value, setValue] = useState(String(rating))
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
      <RatingSelect label="Change rating" value={value} onChange={setValue} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={value === String(rating) || submitting} aria-busy={submitting}>
        Save rating
      </button>
    </form>
  )
}
