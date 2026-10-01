import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import type { LoginResponse } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import ChangePasswordForm from './ChangePasswordForm'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, changePassword: vi.fn() } }
})
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))

const session: LoginResponse = {
  token: 'new-token',
  expiresAtUtc: '2026-10-07T00:00:00Z',
  user: { id: 1, username: 'billy', role: 'Standard', mustChangePassword: false },
}

function renderForm() {
  const startSession = vi.fn()
  vi.mocked(useAuth).mockReturnValue({ user: session.user, login: vi.fn(), register: vi.fn(), logout: vi.fn(), startSession })
  render(<ChangePasswordForm />)
  return startSession
}

async function fillIn(current: string, next: string, confirm: string) {
  if (current) await userEvent.type(screen.getByLabelText('Current password'), current)
  if (next) await userEvent.type(screen.getByLabelText('New password'), next)
  if (confirm) await userEvent.type(screen.getByLabelText('Confirm new password'), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('ChangePasswordForm', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('changes the password, keeps this session signed in and says other devices were signed out', async () => {
    vi.mocked(api.changePassword).mockResolvedValue(session)
    const startSession = renderForm()

    await fillIn('old-password', 'new-password', 'new-password')

    expect(api.changePassword).toHaveBeenCalledWith('old-password', 'new-password')
    expect(startSession).toHaveBeenCalledWith(session)
    expect(screen.getByRole('status')).toHaveTextContent('Password changed. Other devices have been signed out.')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it.each([
    ['', 'new-password', 'new-password', 'Enter your current and new password.'],
    ['old-password', 'short', 'short', 'New password must be at least 8 characters.'],
    ['old-password', 'new-password', 'different-password', 'Passwords do not match.'],
  ])('rejects invalid input without calling the server', async (current, next, confirm, message) => {
    renderForm()

    await fillIn(current, next, confirm)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('shows a wrong current password from the server', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new ApiError(400, 'Current password is incorrect.'))
    const startSession = renderForm()

    await fillIn('wrong-password', 'new-password', 'new-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.')
    expect(startSession).not.toHaveBeenCalled()
  })
})
