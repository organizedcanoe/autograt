import { useState } from 'react'
import { errorMessage } from '../utils/errors'
import Alert from './Alert'
import RatingSelect from './RatingSelect'

interface RatingFormProps {
  /** The day's current rating, or null if it hasn't been rated yet. */
  rating: number | null
  onSubmit: (rating: number) => Promise<void>
}

/** Rates a day for the first time or changes its rating, saving as soon as a rating is picked. */
export default function RatingForm({ rating, onSubmit }: RatingFormProps) {
  const savedValue = rating === null ? '' : String(rating)
  const [value, setValue] = useState(savedValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(newValue: string) {
    setValue(newValue)
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(Number(newValue))
    } catch (e) {
      setValue(savedValue)
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <RatingSelect
        label={rating === null ? 'How was your day?' : 'Change rating'}
        value={value}
        onChange={(newValue) => void handleChange(newValue)}
        busy={submitting}
      />
      {error && <Alert kind="error">{error}</Alert>}
    </>
  )
}
