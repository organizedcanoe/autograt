import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AdminUsers from '../components/AdminUsers'
import ThemePicker from '../components/ThemePicker'
import type { Theme } from '../theme/theme'
import { useTheme } from '../theme/ThemeContext'
import { errorMessage } from '../utils/errors'

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)

  async function changeTheme(next: Theme) {
    setError(null)
    try {
      await setTheme(next)
    } catch (e) {
      setError(`Your theme could not be saved: ${errorMessage(e)}`)
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <section>
        <h2>Appearance</h2>
        {error && <p role="alert">{error}</p>}
        <ThemePicker theme={theme} onChange={(next) => void changeTheme(next)} />
      </section>
      {user?.role === 'Admin' && (
        <section>
          <h2>Admin</h2>
          <AdminUsers />
        </section>
      )}
    </>
  )
}
