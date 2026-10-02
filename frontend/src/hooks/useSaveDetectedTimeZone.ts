import { useEffect } from 'react'
import { api } from '../api/client'
import { detectTimeZone, savedTimeZone } from '../utils/timeZones'

/**
 * Saves this device's time zone for a signed-in user who has none saved, so the server knows when their day
 * ends. A saved zone is never changed here; the settings page offers to switch when it differs from the device.
 */
export function useSaveDetectedTimeZone(userId: number | undefined) {
  useEffect(() => {
    if (userId === undefined) return
    // Only the latest run saves, so a re-run (e.g. StrictMode's) can't send a second, racing save.
    let current = true

    api
      .getSettings()
      .then(async (settings) => {
        if (current && savedTimeZone(settings) === null) await api.updateSetting('TimeZone', [detectTimeZone()])
      })
      // Best effort: until it is saved, the server allows any date that is today somewhere.
      .catch(() => {})

    return () => {
      current = false
    }
  }, [userId])
}
