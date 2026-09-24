import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/errors'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRegister = mode === 'register'

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // On success the app switches to the signed-in routes and this page unmounts.
      await (isRegister ? register(username, password) : login(username, password))
    } catch (e) {
      setError(errorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <main>
      <hgroup>
        <h1>Autograt</h1>
        <p>A daily gratitude journal</p>
      </hgroup>
      <article>
        <h2>{isRegister ? 'Create an account' : 'Welcome back'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              required
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={isRegister ? 8 : undefined}
              aria-describedby={isRegister ? 'password-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {isRegister && <small id="password-hint">At least 8 characters.</small>}
          {error && <p role="alert">{error}</p>}
          <button type="submit" aria-busy={submitting} disabled={submitting}>
            {isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>
        <footer>
          <button type="button" onClick={switchMode}>
            {isRegister ? 'Have an account? Log in' : 'Need an account? Register'}
          </button>
        </footer>
      </article>
    </main>
  )
}
