import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { SettingName, UserSetting } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { getPushSupport, type PushSupport } from '../push/pushSupport'
import { getThisDeviceSubscription, subscribeThisDevice, unsubscribeThisDevice } from '../push/pushSubscription'
import { errorMessage } from '../utils/errors'
import AsyncView from './AsyncView'

/** Matches the backend's limit on ReminderTime values. */
const MAX_TIMES = 4

const BLOCKED = 'Notifications are blocked. Allow them in your browser settings.'

const NOTICES: Record<Exclude<PushSupport, 'supported'>, string> = {
  unsupported: "This browser doesn't support notifications.",
  'needs-install': 'To get reminders on iPhone/iPad, tap Share → Add to Home Screen, then open Autograt from there.',
  denied: BLOCKED,
}

interface Reminders {
  enabled: boolean
  times: string[]
}

function remindersFromSettings(settings: UserSetting[]): Reminders {
  const valuesOf = (setting: SettingName) => settings.find((s) => s.setting === setting)?.values ?? []
  return {
    enabled: valuesOf('RemindersEnabled')[0] === 'on',
    times: valuesOf('ReminderTime'),
  }
}

/** The Reminders section of the settings page. */
export default function ReminderSettings() {
  const state = useAsync(() => api.getSettings().then(remindersFromSettings), [])

  return (
    <section>
      <h2>Reminders</h2>
      <AsyncView state={state}>{(saved) => <ReminderForm saved={saved} />}</AsyncView>
    </section>
  )
}

function ReminderForm({ saved }: { saved: Reminders }) {
  const [support] = useState(getPushSupport)
  const [enabled, setEnabled] = useState(saved.enabled)
  const [times, setTimes] = useState(saved.times)
  // Null until known; reminders are delivered only to devices that subscribed.
  const [deviceSubscribed, setDeviceSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const savedTimes = useRef(saved.times)

  useEffect(() => {
    if (support !== 'supported') return
    let current = true

    getThisDeviceSubscription()
      .then(async (subscription) => {
        if (!current) return
        setDeviceSubscribed(subscription !== null)
        // Saving it again repairs a subscription the server lost, e.g. one the push service replaced.
        if (subscription && saved.enabled) await subscribeThisDevice()
      })
      .catch(() => {})

    return () => {
      current = false
    }
  }, [support, saved.enabled])

  /** Runs a change, reporting any failure as "<failure>: <reason>". */
  async function attempt(failure: string, change: () => Promise<void>) {
    setError(null)
    setStatus(null)
    try {
      await change()
    } catch (e) {
      setError(`${failure}: ${errorMessage(e)}`)
    }
  }

  async function saveSetting(setting: SettingName, values: string[]) {
    await api.updateSetting(setting, values)
  }

  async function turnOn() {
    setBusy(true)
    await attempt('Reminders could not be turned on', async () => {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError(permission === 'denied' ? BLOCKED : 'Allow notifications to turn on reminders.')
        return
      }
      await subscribeThisDevice()
      setDeviceSubscribed(true)
      if (!enabled) {
        await saveSetting('RemindersEnabled', ['on'])
        setEnabled(true)
      }
    })
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    await attempt('Reminders could not be turned off', async () => {
      await unsubscribeThisDevice()
      setDeviceSubscribed(false)
      await saveSetting('RemindersEnabled', ['off'])
      setEnabled(false)
    })
    setBusy(false)
  }

  function saveTimes(next: string[]) {
    // Blank rows are ones still being filled in.
    const values = [...new Set(next.filter((time) => time !== ''))]
    if (values.length === 0 || values.join() === savedTimes.current.join()) return
    void attempt('Your reminder times could not be saved', async () => {
      await saveSetting('ReminderTime', values)
      savedTimes.current = values
    })
  }

  function removeTime(index: number) {
    const next = times.filter((_, i) => i !== index)
    setTimes(next)
    saveTimes(next)
  }

  function sendTest() {
    void attempt('The test notification could not be sent', async () => {
      await api.sendTestPush()
      setStatus('Test notification sent.')
    })
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}

      <p>Reminder times follow your time zone, set above.</p>

      {support === 'supported' ? (
        <>
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              disabled={busy}
              aria-busy={busy}
              onChange={(e) => void (e.target.checked ? turnOn() : turnOff())}
            />
            Enable reminders
          </label>
          {enabled && deviceSubscribed === false && (
            <p>
              Reminders are on, but not for this device.{' '}
              <button type="button" className="outline" disabled={busy} onClick={() => void turnOn()}>
                Enable on this device
              </button>
            </p>
          )}
        </>
      ) : (
        <p>{NOTICES[support]}</p>
      )}

      <fieldset>
        <legend>Reminder times</legend>
        {times.map((time, index) => (
          <fieldset role="group" key={index}>
            <input
              type="time"
              aria-label={`Reminder time ${index + 1}`}
              value={time}
              onChange={(e) => setTimes(times.map((t, i) => (i === index ? e.target.value : t)))}
              onBlur={() => saveTimes(times)}
            />
            <button
              type="button"
              className="secondary outline"
              aria-label={`Remove reminder time ${index + 1}`}
              disabled={times.length === 1}
              onClick={() => removeTime(index)}
            >
              Remove
            </button>
          </fieldset>
        ))}
        <button type="button" className="outline" disabled={times.length >= MAX_TIMES} onClick={() => setTimes([...times, ''])}>
          Add time
        </button>
      </fieldset>

      {support === 'supported' && enabled && (
        <button type="button" className="secondary" onClick={sendTest}>
          Send test notification
        </button>
      )}
      {status && <p role="status">{status}</p>}
    </>
  )
}
