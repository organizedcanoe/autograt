import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { LoginResponse, User } from '../api/types'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, refresh: vi.fn() } }
})

const storedUser: User = { id: 1, username: 'billy', role: 'Admin', mustChangePassword: false }
const oneDayMs = 24 * 60 * 60 * 1000

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

function refreshed(token: string, user: User = storedUser): LoginResponse {
  return { token, expiresAtUtc: '2026-11-01T00:00:00Z', user }
}

function storedToken(): string {
  return JSON.parse(localStorage.getItem('autograt.session')!).token
}

function returnToApp() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('autograt.session', JSON.stringify({ token: 'token', user: storedUser }))
  })

  afterEach(() => {
    vi.mocked(api.refresh).mockReset()
    vi.restoreAllMocks()
  })

  it('refreshes the stored session on load, e.g. after an admin demoted them', async () => {
    vi.mocked(api.refresh).mockResolvedValue(refreshed('new-token', { ...storedUser, role: 'Standard' }))

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user?.role).toBe('Admin')
    await waitFor(() => expect(result.current.user?.role).toBe('Standard'))
    expect(JSON.parse(localStorage.getItem('autograt.session')!).user.role).toBe('Standard')
    expect(storedToken()).toBe('new-token')
  })

  it('keeps the stored session when the refresh fails', async () => {
    vi.mocked(api.refresh).mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(api.refresh).toHaveBeenCalled())
    expect(result.current.user).toEqual(storedUser)
    expect(storedToken()).toBe('token')
  })

  it('does not ask the server when signed out', () => {
    localStorage.clear()

    renderHook(() => useAuth(), { wrapper })

    expect(api.refresh).not.toHaveBeenCalled()
  })

  it('refreshes again when the app returns to the foreground a day later', async () => {
    vi.mocked(api.refresh).mockResolvedValueOnce(refreshed('token-2')).mockResolvedValueOnce(refreshed('token-3'))
    const now = Date.now()
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(storedToken()).toBe('token-2'))

    vi.spyOn(Date, 'now').mockReturnValue(now + oneDayMs + 60_000)
    returnToApp()

    await waitFor(() => expect(storedToken()).toBe('token-3'))
  })

  it('does not refresh again when the app returns to the foreground within a day', async () => {
    vi.mocked(api.refresh).mockResolvedValue(refreshed('token-2'))
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(storedToken()).toBe('token-2'))

    returnToApp()

    expect(api.refresh).toHaveBeenCalledTimes(1)
  })
})
