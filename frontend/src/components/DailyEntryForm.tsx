import { useState, type FormEvent } from 'react'
import type { CreateEntryRequest, EntryCategory } from '../api/types'
import { errorMessage } from '../utils/errors'

interface EntryBox {
  label: string
  category: EntryCategory
  placeholder: string
}

// Two good boxes to one bad box nudges toward a positive ratio.
const ENTRY_BOXES: readonly EntryBox[] = [
  { label: 'Good thing 1', category: 'Good', placeholder: 'Something that went well…' },
  { label: 'Good thing 2', category: 'Good', placeholder: 'Something else you are grateful for…' },
  { label: 'Bad thing', category: 'Bad', placeholder: 'Something that could have gone better…' },
]

const RATINGS = Array.from({ length: 11 }, (_, rating) => rating)

function ratingLabel(rating: number): string {
  if (rating === 0) return '0 – awful'
  if (rating === 10) return '10 – amazing'
  return String(rating)
}

interface DailyEntryFormProps {
  date: string
  onSubmit: (entry: CreateEntryRequest) => Promise<void>
}

export default function DailyEntryForm({ date, onSubmit }: DailyEntryFormProps) {
  const [rating, setRating] = useState('')
  const [contents, setContents] = useState<string[]>(() => ENTRY_BOXES.map(() => ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateContent(index: number, value: string) {
    setContents((previous) => previous.map((content, i) => (i === index ? value : content)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        entryDate: date,
        dayRating: Number(rating),
        subEntries: ENTRY_BOXES.map((box, i) => ({ category: box.category, content: contents[i].trim() })).filter(
          (subEntry) => subEntry.content !== '',
        ),
      })
    } catch (e) {
      setError(errorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        How was your day?
        <select value={rating} onChange={(e) => setRating(e.target.value)} required>
          <option value="" disabled>
            Choose a rating from 0 to 10
          </option>
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {ratingLabel(value)}
            </option>
          ))}
        </select>
      </label>

      {ENTRY_BOXES.map((box, i) => (
        <label key={box.label}>
          {box.label}
          <textarea
            rows={2}
            placeholder={box.placeholder}
            value={contents[i]}
            onChange={(e) => updateContent(i, e.target.value)}
          />
        </label>
      ))}

      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={rating === '' || submitting} aria-busy={submitting}>
        Save day
      </button>
    </form>
  )
}
