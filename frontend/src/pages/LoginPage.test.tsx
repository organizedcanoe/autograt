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
      user: { id: 1, username: 'billy', role: 'Admin' },
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
    await user.type(screen.getByLabelText('Confirm password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(api.register).toHaveBeenCalledWith('billy', 'password')
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.')
  })

  it('does not log in a pending user after registering and explains that approval is needed', async () => {
    const user = userEvent.setup()
    vi.mocked(api.register).mockResolvedValue({ id: 2, username: 'billy', role: 'Pending' })
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.type(screen.getByLabelText('Confirm password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account created. An admin must approve it before you can log in.',
    )
    expect(api.login).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('logs in straight after registering when the account needs no approval', async () => {
    const user = userEvent.setup()
    vi.mocked(api.register).mockResolvedValue({ id: 1, username: 'billy', role: 'Admin' })
    vi.mocked(api.login).mockResolvedValue({
      token: 'token',
      expiresAtUtc: '2026-09-30T00:00:00Z',
      user: { id: 1, username: 'billy', role: 'Admin' },
    })
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.type(screen.getByLabelText('Confirm password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(api.login).toHaveBeenCalledWith('billy', 'password')
  })

  it('asks for password confirmation only when registering', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })

  it('does not register when the passwords do not match', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.type(screen.getByLabelText('Confirm password'), 'passwrod')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(api.register).not.toHaveBeenCalled()
  })

  it('shows an alert instead of submitting when a field is empty', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your username and password.')
    expect(api.login).not.toHaveBeenCalled()
  })

  it('does not register when the password is too short', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByLabelText('Username'), 'billy')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')
    expect(api.register).not.toHaveBeenCalled()
  })
})
