import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import LoginPage from './LoginPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, login: vi.fn(), register: vi.fn() } }
})

function renderLoginPage() {
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.mocked(api.login).mockReset()
    vi.mocked(api.register).mockReset()
  })

  it('logs in with the entered credentials', async () => {
    const user = userEvent.setup()
    vi.mocked(api.login).mockResolvedValue({
      token: 'token',
      expiresAtUtc: '2026-09-30T00:00:00Z',
      user: { id: 1, username: 'billy', isAdmin: true },
    })
    renderLoginPage()

    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(api.login).toHaveBeenCalledWith('billy', 'password')
  })

  it('shows the error when logging in fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.login).mockRejectedValue(new ApiError(401, 'Invalid username or password.'))
    renderLoginPage()

    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
  })

  it('registers from the register form and shows conflicts', async () => {
    const user = userEvent.setup()
    vi.mocked(api.register).mockRejectedValue(new ApiError(409, 'That username is already taken.'))
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(api.register).toHaveBeenCalledWith('billy', 'password')
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.')
  })
})
