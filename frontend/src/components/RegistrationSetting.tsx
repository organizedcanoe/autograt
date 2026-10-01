import { useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/errors'
import AsyncView from './AsyncView'

export default function RegistrationSetting() {
  const settings = useAsync(() => api.getAppSettings(), [])
  // The saved value once changed here; until then, the loaded one.
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(open: boolean) {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.updateAppSettings({ registrationOpen: open })
      setRegistrationOpen(saved.registrationOpen)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <hgroup>
        <h2>Registration</h2>
        <p>When registration is closed, the login page no longer offers new accounts.</p>
      </hgroup>
      <AsyncView state={settings}>
        {(loaded) => (
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={registrationOpen ?? loaded.registrationOpen}
              disabled={saving}
              onChange={(e) => void save(e.target.checked)}
            />
            Open registration
          </label>
        )}
      </AsyncView>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
