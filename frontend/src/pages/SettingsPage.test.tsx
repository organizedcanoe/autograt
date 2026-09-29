import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import SettingsPage from './SettingsPage'

vi.mock('../theme/ThemeContext', () => ({ useTheme: vi.fn() }))

function renderPage(setTheme = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useTheme).mockReturnValue({ theme: { scheme: 'system', color: 'azure' }, setTheme })
  render(<SettingsPage />)
  return setTheme
}

describe('SettingsPage', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('saves a new theme choice', async () => {
    const setTheme = renderPage()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Color' }), 'jade')

    expect(setTheme).toHaveBeenCalledWith({ scheme: 'system', color: 'jade' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a theme that could not be saved', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError(500, 'Server error')))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'dark')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your theme could not be saved: Server error')
  })
})
