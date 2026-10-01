import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import type { LoginResponse, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { forgetThisDevice } from '../push/pushSubscription'
import AccountSettings from './AccountSettings'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, changeUsername: vi.fn(), deleteAccount: vi.fn() } }
})
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../push/pushSubscription', () => ({ forgetThisDevice: vi.fn() }))
// Tested on its own.
vi.mock('./ChangePasswordForm', () => ({ default: () => <p>Change password form</p> }))

const billy: User = { id: 1, username: 'billy', role: 'Standard', mustChangePassword: false }

function renderSettings() {
  const auth = { user: billy, login: vi.fn(), register: vi.fn(), logout: vi.fn(), startSession: vi.fn() }
  vi.mocked(useAuth).mockReturnValue(auth)
  render(<AccountSettings />)
  return auth
}

describe('AccountSettings', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('saves a new username and replaces the session', async () => {
    const session: LoginResponse = { token: 't', expiresAtUtc: '2026-10-07T00:00:00Z', user: { ...billy, username: 'william' } }
    vi.mocked(api.changeUsername).mockResolvedValue(session)
    const { startSession } = renderSettings()

    const input = screen.getByLabelText('Username')
    expect(input).toHaveValue('billy')
    await userEvent.clear(input)
    await userEvent.type(input, 'william')
    await userEvent.click(screen.getByRole('button', { name: 'Update username' }))

    expect(api.changeUsername).toHaveBeenCalledWith('william')
    expect(startSession).toHaveBeenCalledWith(session)
    expect(screen.getByRole('status')).toHaveTextContent('Username saved.')
  })

  it('shows a username the server rejects', async () => {
    vi.mocked(api.changeUsername).mockRejectedValue(new ApiError(409, 'That username is already taken.'))
    renderSettings()

    await userEvent.clear(screen.getByLabelText('Username'))
    await userEvent.type(screen.getByLabelText('Username'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Update username' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.')
  })

  it('cannot update the username until it changes', async () => {
    renderSettings()

    const button = screen.getByRole('button', { name: 'Update username' })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Username'), 'x')
    expect(button).toBeEnabled()
    await userEvent.type(screen.getByLabelText('Username'), '{Backspace}')
    expect(button).toBeDisabled()
  })

  it('does not save an empty username', async () => {
    renderSettings()

    await userEvent.clear(screen.getByLabelText('Username'))
    await userEvent.click(screen.getByRole('button', { name: 'Update username' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a username.')
    expect(api.changeUsername).not.toHaveBeenCalled()
  })

  it('can cancel deleting the account', async () => {
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.deleteAccount).not.toHaveBeenCalled()
  })

  it('needs the password before deleting', async () => {
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }))

    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeDisabled()
  })

  it('deletes the account with the password, forgets this device and logs out', async () => {
    vi.mocked(api.deleteAccount).mockResolvedValue(undefined)
    vi.mocked(forgetThisDevice).mockResolvedValue(undefined)
    const { logout } = renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }))
    await userEvent.type(screen.getByLabelText('Password'), 'my-password')
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever' }))

    expect(api.deleteAccount).toHaveBeenCalledWith('my-password')
    expect(forgetThisDevice).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
  })

  it('logs out after deleting even if forgetting this device never finishes', async () => {
    vi.mocked(api.deleteAccount).mockResolvedValue(undefined)
    vi.mocked(forgetThisDevice).mockReturnValue(new Promise(() => {}))
    const { logout } = renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }))
    await userEvent.type(screen.getByLabelText('Password'), 'my-password')
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever' }))

    expect(logout).toHaveBeenCalled()
  })

  it('shows a wrong password in the dialog and stays signed in', async () => {
    vi.mocked(api.deleteAccount).mockRejectedValue(new ApiError(400, 'Current password is incorrect.'))
    const { logout } = renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }))
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Delete forever' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })
})
