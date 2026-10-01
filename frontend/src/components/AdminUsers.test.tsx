import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import AdminUsers from './AdminUsers'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      listUsers: vi.fn(),
      approveUser: vi.fn(),
      promoteUser: vi.fn(),
      deleteUser: vi.fn(),
      resetUserPassword: vi.fn(),
    },
  }
})
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }))

const users: User[] = [
  { id: 1, username: 'admin', role: 'Admin', mustChangePassword: false },
  { id: 2, username: 'regular', role: 'Standard', mustChangePassword: false },
  { id: 3, username: 'newcomer', role: 'Pending', mustChangePassword: false },
  { id: 4, username: 'other-admin', role: 'Admin', mustChangePassword: false },
]

async function findRow(username: string) {
  return (await screen.findByRole('cell', { name: username })).closest('tr')!
}

describe('AdminUsers', () => {
  beforeEach(() => {
    // Signed in as the first user.
    vi.mocked(useAuth).mockReturnValue({ user: users[0], login: vi.fn(), register: vi.fn(), logout: vi.fn(), startSession: vi.fn() })
  })

  afterEach(() => {
    vi.mocked(api.listUsers).mockReset()
    vi.mocked(api.approveUser).mockReset()
    vi.mocked(api.promoteUser).mockReset()
    vi.mocked(api.deleteUser).mockReset()
    vi.mocked(api.resetUserPassword).mockReset()
    vi.restoreAllMocks()
  })

  it('shows each role with the action that applies to it', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    const adminRow = within(await findRow('admin'))
    expect(adminRow.getByRole('cell', { name: 'Admin' })).toBeInTheDocument()
    expect(adminRow.queryByRole('button')).not.toBeInTheDocument()

    const regularRow = within(await findRow('regular'))
    expect(regularRow.getByRole('cell', { name: 'User' })).toBeInTheDocument()
    expect(regularRow.getByRole('button', { name: 'Promote' })).toBeInTheDocument()

    const pendingRow = within(await findRow('newcomer'))
    expect(pendingRow.getByRole('cell', { name: 'Pending approval' })).toBeInTheDocument()
    expect(pendingRow.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(pendingRow.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(regularRow.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(pendingRow.queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument()
  })

  it('approves a pending user and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.approveUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.click(within(await findRow('newcomer')).getByRole('button', { name: 'Approve' }))

    expect(api.approveUser).toHaveBeenCalledWith(3)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('deletes a pending user once confirmed and reloads the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.deleteUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.click(within(await findRow('newcomer')).getByRole('button', { name: 'Delete' }))

    expect(window.confirm).toHaveBeenCalledWith("Delete pending user 'newcomer'? This cannot be undone.")
    expect(api.deleteUser).toHaveBeenCalledWith(3)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    await user.click(within(await findRow('newcomer')).getByRole('button', { name: 'Delete' }))

    expect(api.deleteUser).not.toHaveBeenCalled()
  })

  it('offers a password reset for approved users other than yourself', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    expect(within(await findRow('regular')).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
    expect(within(await findRow('other-admin')).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
    expect(within(await findRow('admin')).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
    expect(within(await findRow('newcomer')).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
  })

  it('resets a password once confirmed and shows the temporary password until closed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.resetUserPassword).mockResolvedValue({ temporaryPassword: 'Temp4321abcd' })
    render(<AdminUsers />)

    await user.click(within(await findRow('regular')).getByRole('button', { name: 'Reset password' }))

    expect(window.confirm).toHaveBeenCalledWith(
      "Reset the password for 'regular'? They will be signed out everywhere and must choose a new password when they next log in.",
    )
    expect(api.resetUserPassword).toHaveBeenCalledWith(2)
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('Temp4321abcd')).toBeInTheDocument()
    expect(dialog.getByText(/won't be shown again/)).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('copies the temporary password', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.resetUserPassword).mockResolvedValue({ temporaryPassword: 'Temp4321abcd' })
    render(<AdminUsers />)

    await user.click(within(await findRow('regular')).getByRole('button', { name: 'Reset password' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('Temp4321abcd')
  })

  it('does not reset when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    await user.click(within(await findRow('regular')).getByRole('button', { name: 'Reset password' }))

    expect(api.resetUserPassword).not.toHaveBeenCalled()
  })
})
