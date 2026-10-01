import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { todayIso } from '../utils/dates'

/** Opens the day view for any date up to today. */
export default function JumpToDate() {
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const date = String(new FormData(event.currentTarget).get('date') ?? '')
    if (date) navigate(`/day/${date}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset role="group">
        <input type="date" name="date" aria-label="Date" max={todayIso()} required />
        <button type="submit">Go</button>
      </fieldset>
    </form>
  )
}
