import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/errors'

const minPasswordLength = 8

interface Props {
  /** Label for the current password field, e.g. "Temporary password" after an admin reset. */
  currentPasswordLabel?: string
}

function validationError(current: string, next: string, confirm: string): string | null {
  if (!current || !next) return 'Enter your current and new password.'
  if (next.length < minPasswordLength) return `New password must be at least ${minPasswordLength} characters.`
  if (next !== confirm) return 'Passwords do not match.'
  return null
}

/** Changes the signed-in user's password. This session stays signed in; every other session is signed out. */
export default function ChangePasswordForm({ currentPasswordLabel = 'Current password' }: Props) {
  const { startSession } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    const invalid = validationError(current, next, confirm)
    setError(invalid)
    if (invalid) return

    setSaving(true)
    try {
      startSession(await api.changePassword(current, next))
      setCurrent('')
      setNext('')
      setConfirm('')
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // noValidate, so every problem shows in the same alert instead of browser popups.
  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)}>
      <label>
        {currentPasswordLabel}
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          aria-describedby="new-password-hint"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <small id="new-password-hint">At least {minPasswordLength} characters.</small>
      <label>
        Confirm new password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Password changed. Other devices have been signed out.</p>}
      <button type="submit" disabled={saving} aria-busy={saving}>
        Change password
      </button>
    </form>
  )
}
