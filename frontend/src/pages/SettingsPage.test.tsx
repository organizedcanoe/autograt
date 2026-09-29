import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import SettingsPage from './SettingsPage'

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../theme/ThemeContext', () => ({ useTheme: vi.fn() }))
vi.mock('../components/AdminUsers', () => ({ default: () => <p>Admin user list</p> }))

function renderAs(role: User['role'], setTheme = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 1, username: 'billy', role },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  })
  vi.mocked(useTheme).mockReturnValue({ theme: { scheme: 'system', color: 'azure' }, setTheme })
  render(<SettingsPage />)
  return setTheme
}

describe('SettingsPage', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('saves a new theme choice', async () => {
    const setTheme = renderAs('Standard')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Color' }), 'jade')

    expect(setTheme).toHaveBeenCalledWith({ scheme: 'system', color: 'jade' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a theme that could not be saved', async () => {
    renderAs('Standard', vi.fn().mockRejectedValue(new ApiError(500, 'Server error')))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'dark')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your theme could not be saved: Server error')
  })

  it('hides the admin section from standard users', () => {
    renderAs('Standard')

    expect(screen.queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByText('Admin user list')).not.toBeInTheDocument()
  })

  it('shows the admin section to admins', () => {
    renderAs('Admin')

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByText('Admin user list')).toBeInTheDocument()
  })
})
