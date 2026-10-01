import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import RegistrationSetting from './RegistrationSetting'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getAppSettings: vi.fn(), updateAppSettings: vi.fn() } }
})

describe('RegistrationSetting', () => {
  afterEach(() => {
    vi.mocked(api.getAppSettings).mockReset()
    vi.mocked(api.updateAppSettings).mockReset()
  })

  it('shows whether registration is open', async () => {
    vi.mocked(api.getAppSettings).mockResolvedValue({ registrationOpen: true })
    render(<RegistrationSetting />)

    expect(await screen.findByRole('switch', { name: 'Open registration' })).toBeChecked()
  })

  it('closes registration when switched off', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAppSettings).mockResolvedValue({ registrationOpen: true })
    vi.mocked(api.updateAppSettings).mockResolvedValue({ registrationOpen: false })
    render(<RegistrationSetting />)

    await user.click(await screen.findByRole('switch', { name: 'Open registration' }))

    expect(api.updateAppSettings).toHaveBeenCalledWith({ registrationOpen: false })
    expect(screen.getByRole('switch', { name: 'Open registration' })).not.toBeChecked()
  })

  it('shows an error and keeps the old value when saving fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAppSettings).mockResolvedValue({ registrationOpen: true })
    vi.mocked(api.updateAppSettings).mockRejectedValue(new Error('Request failed (500)'))
    render(<RegistrationSetting />)

    await user.click(await screen.findByRole('switch', { name: 'Open registration' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed (500)')
    expect(screen.getByRole('switch', { name: 'Open registration' })).toBeChecked()
  })
})
