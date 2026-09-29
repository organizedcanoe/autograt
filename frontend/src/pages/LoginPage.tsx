import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/errors'
import Wordmark from '../components/Wordmark'
import './LoginPage.css'

type Mode = 'login' | 'register'

const minPasswordLength = 8

// The form uses noValidate so every problem shows in the same alert card instead of browser popups.
function validationError(mode: Mode, username: string, password: string, confirmPassword: string): string | null {
  if (!username.trim() || !password) return 'Enter your username and password.'
  if (mode === 'login') return null
  if (password.length < minPasswordLength) return `Password must be at least ${minPasswordLength} characters.`
  if (password !== confirmPassword) return 'Passwords do not match.'
  return null
}

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const isRegister = mode === 'register'

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    clearPasswords()
    setError(null)
    setNotice(null)
  }

  function clearPasswords() {
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = validationError(mode, username, password, confirmPassword)
    if (invalid) {
      setError(invalid)
      setNotice(null)
      return
    }
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      // Once logged in, the app switches to the signed-in routes and this page unmounts.
      if (!isRegister) {
        await login(username, password)
        return
      }
      const user = await register(username, password)
      if (user.role === 'Pending') {
        setMode('login')
        clearPasswords()
        setNotice('Account created. An admin must approve it before you can log in.')
        setSubmitting(false)
      }
    } catch (e) {
      setError(errorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <main>
      <hgroup>
        <h1>
          <Wordmark />
        </h1>
        <p>A daily gratitude journal</p>
      </hgroup>
      <article>
        <h2>{isRegister ? 'Create an account' : 'Welcome back'}</h2>
        <form noValidate onSubmit={handleSubmit}>
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
              minLength={isRegister ? minPasswordLength : undefined}
              aria-describedby={isRegister ? 'password-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {isRegister && <small id="password-hint">At least {minPasswordLength} characters.</small>}
          {isRegister && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          )}
          {notice && (
            <p role="status" data-alert="warning">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" data-alert="error">
              {error}
            </p>
          )}
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
