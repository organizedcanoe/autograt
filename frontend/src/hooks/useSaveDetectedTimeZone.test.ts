import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { detectTimeZone } from '../utils/timeZones'
import { useSaveDetectedTimeZone } from './useSaveDetectedTimeZone'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getSettings: vi.fn(), updateSetting: vi.fn() } }
})

vi.mock('../utils/timeZones', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/timeZones')>()
  return { ...original, detectTimeZone: vi.fn() }
})

function savedTimeZone(values: string[]) {
  vi.mocked(api.getSettings).mockResolvedValue([{ setting: 'TimeZone', values }])
}

describe('useSaveDetectedTimeZone', () => {
  beforeEach(() => {
    vi.mocked(detectTimeZone).mockReturnValue('America/Toronto')
    vi.mocked(api.updateSetting).mockImplementation((setting, values) => Promise.resolve({ setting, values }))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("saves this device's zone when the user has none saved", async () => {
    savedTimeZone([])

    renderHook(() => useSaveDetectedTimeZone(1))

    await waitFor(() => expect(api.updateSetting).toHaveBeenCalledWith('TimeZone', ['America/Toronto']))
  })

  it('saves only once when the effect runs twice, as in StrictMode', async () => {
    savedTimeZone([])

    renderHook(() => useSaveDetectedTimeZone(1), { reactStrictMode: true })

    await waitFor(() => expect(api.updateSetting).toHaveBeenCalled())
    expect(api.getSettings).toHaveBeenCalledTimes(2)
    expect(api.updateSetting).toHaveBeenCalledTimes(1)
  })

  it('keeps a saved zone, even one that differs from this device', async () => {
    savedTimeZone(['Asia/Tokyo'])

    renderHook(() => useSaveDetectedTimeZone(1))

    await waitFor(() => expect(api.getSettings).toHaveBeenCalled())
    expect(api.updateSetting).not.toHaveBeenCalled()
  })

  it('does nothing while signed out', () => {
    renderHook(() => useSaveDetectedTimeZone(undefined))

    expect(api.getSettings).not.toHaveBeenCalled()
  })
})
