import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import { detectTimeZone } from '../utils/timeZones'
import TimeZoneSettings from './TimeZoneSettings'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getSettings: vi.fn(), updateSetting: vi.fn() } }
})

vi.mock('../utils/timeZones', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/timeZones')>()
  return { ...original, detectTimeZone: vi.fn() }
})

/** Renders the section with the saved zone, or none when it is null. */
function renderWith(timeZone: string | null) {
  vi.mocked(api.getSettings).mockResolvedValue([
    { setting: 'BrightnessTheme', values: ['system'] },
    { setting: 'TimeZone', values: timeZone === null ? [] : [timeZone] },
  ])
  render(<TimeZoneSettings />)
}

const zoneSelect = () => screen.findByRole('combobox', { name: 'Time zone' })

describe('TimeZoneSettings', () => {
  beforeEach(() => {
    vi.mocked(detectTimeZone).mockReturnValue('America/Toronto')
    vi.mocked(api.updateSetting).mockImplementation((setting, values) => Promise.resolve({ setting, values }))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('explains that the zone decides when today ends and when reminders are sent', async () => {
    renderWith('America/Toronto')

    await zoneSelect()
    expect(screen.getByText(/when each day starts and ends/)).toBeInTheDocument()
  })

  it('shows the saved zone and offers the detected one with a warning', async () => {
    renderWith('UTC')

    expect(await zoneSelect()).toHaveValue('UTC')
    expect(screen.getByText(/this device is in America\/Toronto/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Use America/Toronto (detected)' }))

    expect(api.updateSetting).toHaveBeenCalledWith('TimeZone', ['America/Toronto'])
    expect(await zoneSelect()).toHaveValue('America/Toronto')
    expect(screen.queryByRole('button', { name: /detected/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/this device is in/)).not.toBeInTheDocument()
  })

  it('shows neither the button nor the warning when the zones match', async () => {
    vi.mocked(detectTimeZone).mockReturnValue('UTC')
    renderWith('UTC')

    await zoneSelect()
    expect(screen.queryByRole('button', { name: /detected/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/this device is in/)).not.toBeInTheDocument()
  })

  it('shows an unsaved zone as not set and offers the detected one', async () => {
    renderWith(null)

    expect(await zoneSelect()).toHaveDisplayValue('Not set')
    expect(screen.getByText(/your time zone is not set/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Use America/Toronto (detected)' }))

    expect(api.updateSetting).toHaveBeenCalledWith('TimeZone', ['America/Toronto'])
  })

  it('saves a zone chosen from the list', async () => {
    renderWith('UTC')

    await userEvent.selectOptions(await zoneSelect(), 'Europe/London')

    expect(api.updateSetting).toHaveBeenCalledWith('TimeZone', ['Europe/London'])
  })

  it('reports a zone that could not be saved', async () => {
    vi.mocked(api.updateSetting).mockRejectedValue(new ApiError(400, 'Bad zone'))
    renderWith('UTC')

    await userEvent.selectOptions(await zoneSelect(), 'Europe/London')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your time zone could not be saved: Bad zone')
  })
})
