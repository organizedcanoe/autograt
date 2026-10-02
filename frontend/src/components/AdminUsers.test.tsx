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
      demoteUser: vi.fn(),
      disableUser: vi.fn(),
      enableUser: vi.fn(),
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
  { id: 5, username: 'blocked', role: 'Disabled', mustChangePassword: false },
]

async function findRow(username: string) {
  return (await screen.findByRole('cell', { name: username })).closest('tr')!
}

async function findActions(username: string) {
  return within(await findRow(username)).getByRole('combobox', { name: `Actions for ${username}` })
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
    vi.mocked(api.demoteUser).mockReset()
    vi.mocked(api.disableUser).mockReset()
    vi.mocked(api.enableUser).mockReset()
    vi.mocked(api.resetUserPassword).mockReset()
    vi.restoreAllMocks()
  })

  it('shows each role with the action that applies to it', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    const adminRow = within(await findRow('admin'))
    expect(adminRow.getByRole('cell', { name: 'Admin' })).toBeInTheDocument()
    expect(adminRow.queryByRole('combobox')).not.toBeInTheDocument()

    const regularRow = within(await findRow('regular'))
    expect(regularRow.getByRole('cell', { name: 'User' })).toBeInTheDocument()
    expect(regularRow.getByRole('option', { name: 'Promote' })).toBeInTheDocument()
    expect(regularRow.getByRole('option', { name: 'Disable' })).toBeInTheDocument()
    expect(regularRow.getByRole('option', { name: 'Delete' })).toBeInTheDocument()

    const pendingRow = within(await findRow('newcomer'))
    expect(pendingRow.getByRole('cell', { name: 'Pending approval' })).toBeInTheDocument()
    expect(pendingRow.getByRole('option', { name: 'Approve' })).toBeInTheDocument()
    expect(pendingRow.getByRole('option', { name: 'Delete' })).toBeInTheDocument()
    expect(pendingRow.queryByRole('option', { name: 'Promote' })).not.toBeInTheDocument()
    expect(pendingRow.queryByRole('option', { name: 'Disable' })).not.toBeInTheDocument()

    const otherAdminRow = within(await findRow('other-admin'))
    expect(otherAdminRow.getByRole('option', { name: 'Demote' })).toBeInTheDocument()
    expect(otherAdminRow.queryByRole('option', { name: 'Delete' })).not.toBeInTheDocument()
    expect(otherAdminRow.queryByRole('option', { name: 'Disable' })).not.toBeInTheDocument()

    const disabledRow = within(await findRow('blocked'))
    expect(disabledRow.getByRole('cell', { name: 'Disabled' })).toBeInTheDocument()
    expect(disabledRow.getByRole('option', { name: 'Enable' })).toBeInTheDocument()
    expect(disabledRow.getByRole('option', { name: 'Delete' })).toBeInTheDocument()
    expect(disabledRow.queryByRole('option', { name: 'Promote' })).not.toBeInTheDocument()
  })

  it('demotes another admin and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.demoteUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('other-admin'), 'Demote')

    expect(api.demoteUser).toHaveBeenCalledWith(4)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('returns the actions dropdown to its placeholder after choosing', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    const actions = await findActions('regular')
    await user.selectOptions(actions, 'Disable')

    expect(actions).toHaveValue('')
  })

  it('disables a user once confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.disableUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('regular'), 'Disable')

    expect(window.confirm).toHaveBeenCalledWith(
      "Disable 'regular'? They will be signed out and can't log in until enabled again. Their journal is kept.",
    )
    expect(api.disableUser).toHaveBeenCalledWith(2)
  })

  it('does not disable when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('regular'), 'Disable')

    expect(api.disableUser).not.toHaveBeenCalled()
  })

  it('enables a disabled user', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.enableUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('blocked'), 'Enable')

    expect(api.enableUser).toHaveBeenCalledWith(5)
  })

  it('deletes an approved user and their journal once confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.deleteUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('regular'), 'Delete')

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete 'regular' and all their journal entries, ratings and settings? This cannot be undone.",
    )
    expect(api.deleteUser).toHaveBeenCalledWith(2)
  })

  it('shows a server error from an action', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.demoteUser).mockRejectedValue(new Error('Only admins can be demoted, and not the last one.'))
    render(<AdminUsers />)

    await user.selectOptions(await findActions('other-admin'), 'Demote')

    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can be demoted, and not the last one.')
  })

  it('approves a pending user and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.approveUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('newcomer'), 'Approve')

    expect(api.approveUser).toHaveBeenCalledWith(3)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('deletes a pending user once confirmed and reloads the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.deleteUser).mockResolvedValue(undefined)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('newcomer'), 'Delete')

    expect(window.confirm).toHaveBeenCalledWith("Delete pending user 'newcomer'? This cannot be undone.")
    expect(api.deleteUser).toHaveBeenCalledWith(3)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('newcomer'), 'Delete')

    expect(api.deleteUser).not.toHaveBeenCalled()
  })

  it('offers a password reset for approved users other than yourself', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    expect(within(await findRow('regular')).getByRole('option', { name: 'Reset password' })).toBeInTheDocument()
    expect(within(await findRow('other-admin')).getByRole('option', { name: 'Reset password' })).toBeInTheDocument()
    expect(within(await findRow('admin')).queryByRole('option', { name: 'Reset password' })).not.toBeInTheDocument()
    expect(within(await findRow('newcomer')).queryByRole('option', { name: 'Reset password' })).not.toBeInTheDocument()
  })

  it('resets a password once confirmed and shows the temporary password until closed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.resetUserPassword).mockResolvedValue({ temporaryPassword: 'Temp4321abcd' })
    render(<AdminUsers />)

    await user.selectOptions(await findActions('regular'), 'Reset password')

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

    await user.selectOptions(await findActions('regular'), 'Reset password')
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('Temp4321abcd')
  })

  it('does not reset when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminUsers />)

    await user.selectOptions(await findActions('regular'), 'Reset password')

    expect(api.resetUserPassword).not.toHaveBeenCalled()
  })
})
