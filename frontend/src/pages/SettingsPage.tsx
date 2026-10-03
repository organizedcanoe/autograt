import { useState } from 'react'
import AccountSettings from '../components/AccountSettings'
import DataSettings from '../components/DataSettings'
import ReminderSettings from '../components/ReminderSettings'
import ThemePicker from '../components/ThemePicker'
import TimeZoneSettings from '../components/TimeZoneSettings'
import type { Theme } from '../theme/theme'
import { useTheme } from '../theme/ThemeContext'
import { errorMessage } from '../utils/errors'
import Alert from '../components/Alert'

export default function SettingsPage() {
  const { theme, setTheme, reloadTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)
  // Bumped after an import, so the time zone and reminder settings remount with the imported values.
  const [importCount, setImportCount] = useState(0)

  async function changeTheme(next: Theme) {
    setError(null)
    try {
      await setTheme(next)
    } catch (e) {
      setError(`Your theme could not be saved: ${errorMessage(e)}`)
    }
  }

  function afterImport() {
    setImportCount((count) => count + 1)
    reloadTheme().catch(() => {})
  }

  return (
    <>
      <h1>Settings</h1>
      <AccountSettings />
      <section>
        <h2>Appearance</h2>
        {error && <Alert kind="error">{error}</Alert>}
        <ThemePicker theme={theme} onChange={(next) => void changeTheme(next)} />
      </section>
      <TimeZoneSettings key={importCount} />
      <ReminderSettings key={importCount} />
      <DataSettings onImported={afterImport} />
    </>
  )
}
