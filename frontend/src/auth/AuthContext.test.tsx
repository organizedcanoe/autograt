import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { User } from '../api/types'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, me: vi.fn() } }
})

const storedUser: User = { id: 1, username: 'billy', role: 'Admin', mustChangePassword: false }

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.mocked(api.me).mockReset()
  })

  it('refreshes the stored user from the server, e.g. after an admin demoted them', async () => {
    localStorage.setItem('autograt.session', JSON.stringify({ token: 'token', user: storedUser }))
    vi.mocked(api.me).mockResolvedValue({ ...storedUser, role: 'Standard' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user?.role).toBe('Admin')
    await waitFor(() => expect(result.current.user?.role).toBe('Standard'))
    expect(JSON.parse(localStorage.getItem('autograt.session')!).user.role).toBe('Standard')
  })

  it('keeps the stored user when the refresh fails', async () => {
    localStorage.setItem('autograt.session', JSON.stringify({ token: 'token', user: storedUser }))
    vi.mocked(api.me).mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(api.me).toHaveBeenCalled())
    expect(result.current.user).toEqual(storedUser)
  })

  it('does not ask the server when signed out', () => {
    renderHook(() => useAuth(), { wrapper })

    expect(api.me).not.toHaveBeenCalled()
  })
})
