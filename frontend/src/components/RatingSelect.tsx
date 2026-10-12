const RATINGS = Array.from({ length: 11 }, (_, rating) => rating)

function ratingLabel(rating: number): string {
  if (rating === 0) return '0 – awful'
  if (rating === 10) return '10 – amazing'
  return String(rating)
}

interface RatingSelectProps {
  label: string
  /** The chosen rating as a string, or '' when none is chosen yet. */
  value: string
  onChange: (value: string) => void
  /** Disables the picker while its rating is being saved. */
  busy?: boolean
}

/** A required 0–10 day rating picker. */
export default function RatingSelect({ label, value, onChange, busy = false }: RatingSelectProps) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={busy} aria-busy={busy} required>
        <option value="" disabled>
          Choose a rating from 0 to 10
        </option>
        {RATINGS.map((rating) => (
          <option key={rating} value={rating}>
            {ratingLabel(rating)}
          </option>
        ))}
      </select>
    </label>
  )
}
