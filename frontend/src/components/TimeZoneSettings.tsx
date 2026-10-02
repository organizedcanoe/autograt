import { useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { detectTimeZone, savedTimeZone, timeZoneOptions } from '../utils/timeZones'
import { errorMessage } from '../utils/errors'
import AsyncView from './AsyncView'

/** The Time zone section of the settings page. */
export default function TimeZoneSettings() {
  const state = useAsync(() => api.getSettings().then(savedTimeZone), [])

  return (
    <section>
      <h2>Time zone</h2>
      <AsyncView state={state}>{(saved) => <TimeZoneForm saved={saved} />}</AsyncView>
    </section>
  )
}

function TimeZoneForm({ saved }: { saved: string | null }) {
  const [detectedZone] = useState(detectTimeZone)
  const [timeZone, setTimeZone] = useState(saved)
  const [error, setError] = useState<string | null>(null)

  async function changeTimeZone(zone: string) {
    setError(null)
    setTimeZone(zone)
    try {
      await api.updateSetting('TimeZone', [zone])
    } catch (e) {
      setError(`Your time zone could not be saved: ${errorMessage(e)}`)
    }
  }

  const zoneMismatch = detectedZone !== timeZone

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <p>Your time zone decides when each day starts and ends, and when reminders are sent.</p>

      <label htmlFor="time-zone">Time zone</label>
      <fieldset role="group">
        <select id="time-zone" value={timeZone ?? ''} onChange={(e) => void changeTimeZone(e.target.value)}>
          {timeZone === null && (
            <option value="" disabled>
              Not set
            </option>
          )}
          {timeZoneOptions(timeZone).map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        {zoneMismatch && (
          <button type="button" className="secondary" onClick={() => void changeTimeZone(detectedZone)}>
            Use {detectedZone} (detected)
          </button>
        )}
      </fieldset>
      {zoneMismatch && (
        <p>
          <mark>Warning:</mark>{' '}
          {timeZone === null ? 'your time zone is not set' : `your time zone is set to ${timeZone}`}, but this device
          is in {detectedZone}. Today's entries can only be changed until the day ends in your time zone.
        </p>
      )}
    </>
  )
}
