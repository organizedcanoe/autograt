import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { forgetThisDevice } from '../push/pushSubscription'
import { errorMessage } from '../utils/errors'
import ChangePasswordForm from './ChangePasswordForm'
import './AccountSettings.css'

/** The signed-in user's username and password, and deleting their account. */
export default function AccountSettings() {
  return (
    <section>
      <h2>Account</h2>
      <UsernameForm />
      <h3>Change password</h3>
      <ChangePasswordForm />
      <DeleteAccount />
    </section>
  )
}

function UsernameForm() {
  const { user, startSession } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    setError(null)
    if (!username.trim()) {
      setError('Enter a username.')
      return
    }

    setSaving(true)
    try {
      const session = await api.changeUsername(username.trim())
      startSession(session)
      setUsername(session.user.username)
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Username
        <input autoComplete="username" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Username saved.</p>}
      <button type="submit" disabled={saving} aria-busy={saving}>
        Save username
      </button>
    </form>
  )
}

function DeleteAccount() {
  const { logout } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setConfirming(false)
    setPassword('')
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeleting(true)
    setError(null)
    try {
      await api.deleteAccount(password)
    } catch (e) {
      setError(errorMessage(e))
      setDeleting(false)
      return
    }
    // The server already dropped this device's subscription with the account; stop the browser receiving pushes too.
    // Best effort: a failure here must not keep a deleted user signed in.
    await forgetThisDevice().catch(() => {})
    logout()
  }

  return (
    <>
      <h3>Delete account</h3>
      <p>Permanently delete your account with all your entries, ratings and settings.</p>
      <button type="button" data-danger onClick={() => setConfirming(true)}>
        Delete account…
      </button>
      {confirming && (
        <dialog open>
          <article>
            <h3>Delete your account?</h3>
            <p>
              All your entries, ratings and settings will be deleted permanently. This cannot be undone. To keep a
              copy, export your journal in the <strong>Your data</strong> section first.
            </p>
            <form id="delete-account" onSubmit={(e) => void handleSubmit(e)}>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <p role="alert">{error}</p>}
            </form>
            <footer data-confirm-actions>
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button type="submit" form="delete-account" data-danger disabled={!password || deleting} aria-busy={deleting}>
                Delete forever
              </button>
            </footer>
          </article>
        </dialog>
      )}
    </>
  )
}
