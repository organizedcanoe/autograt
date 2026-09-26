import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { User } from '../api/types'
import AdminPage from './AdminPage'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: { ...original.api, listUsers: vi.fn(), approveUser: vi.fn(), promoteUser: vi.fn() },
  }
})

const users: User[] = [
  { id: 1, username: 'admin', role: 'Admin' },
  { id: 2, username: 'regular', role: 'Standard' },
  { id: 3, username: 'newcomer', role: 'Pending' },
]

async function findRow(username: string) {
  return (await screen.findByRole('cell', { name: username })).closest('tr')!
}

describe('AdminPage', () => {
  afterEach(() => {
    vi.mocked(api.listUsers).mockReset()
    vi.mocked(api.approveUser).mockReset()
    vi.mocked(api.promoteUser).mockReset()
  })

  it('shows each role with the action that applies to it', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(users)
    render(<AdminPage />)

    const adminRow = within(await findRow('admin'))
    expect(adminRow.getByRole('cell', { name: 'Admin' })).toBeInTheDocument()
    expect(adminRow.queryByRole('button')).not.toBeInTheDocument()

    const regularRow = within(await findRow('regular'))
    expect(regularRow.getByRole('cell', { name: 'User' })).toBeInTheDocument()
    expect(regularRow.getByRole('button', { name: 'Promote' })).toBeInTheDocument()

    const pendingRow = within(await findRow('newcomer'))
    expect(pendingRow.getByRole('cell', { name: 'Pending approval' })).toBeInTheDocument()
    expect(pendingRow.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(pendingRow.queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument()
  })

  it('approves a pending user and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(api.listUsers).mockResolvedValue(users)
    vi.mocked(api.approveUser).mockResolvedValue(undefined)
    render(<AdminPage />)

    await user.click(within(await findRow('newcomer')).getByRole('button', { name: 'Approve' }))

    expect(api.approveUser).toHaveBeenCalledWith(3)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })
})
