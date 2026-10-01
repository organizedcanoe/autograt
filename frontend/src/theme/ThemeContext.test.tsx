import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { loadTheme } from './theme'
import { ThemeProvider, useTheme } from './ThemeContext'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getSettings: vi.fn(), updateSetting: vi.fn() } }
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  )
}

function signIn() {
  const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Standard', mustChangePassword: false } }
  localStorage.setItem('autograt.session', JSON.stringify(session))
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.mocked(api.getSettings).mockReset()
    vi.mocked(api.updateSetting).mockReset()
  })

  it('starts from the cached theme when signed out, without asking the server', () => {
    localStorage.setItem('autograt.theme', JSON.stringify({ scheme: 'light', color: 'pumpkin' }))

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toEqual({ scheme: 'light', color: 'pumpkin' })
    expect(api.getSettings).not.toHaveBeenCalled()
  })

  it("applies and caches the signed-in user's saved theme", async () => {
    signIn()
    vi.mocked(api.getSettings).mockResolvedValue([
      { setting: 'BrightnessTheme', values: ['dark'] },
      { setting: 'ColourTheme', values: ['violet'] },
    ])

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.theme).toEqual({ scheme: 'dark', color: 'violet' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(loadTheme()).toEqual({ scheme: 'dark', color: 'violet' })
  })

  it('applies, caches and saves only the parts of the theme that changed', async () => {
    signIn()
    vi.mocked(api.getSettings).mockResolvedValue([])
    vi.mocked(api.updateSetting).mockResolvedValue({ setting: 'ColourTheme', values: ['slate'] })
    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled())

    await act(() => result.current.setTheme({ scheme: 'system', color: 'slate' }))

    expect(result.current.theme).toEqual({ scheme: 'system', color: 'slate' })
    expect(document.documentElement).toHaveAttribute('data-color', 'slate')
    expect(loadTheme()).toEqual({ scheme: 'system', color: 'slate' })
    expect(api.updateSetting).toHaveBeenCalledTimes(1)
    expect(api.updateSetting).toHaveBeenCalledWith('ColourTheme', ['slate'])
  })

  it('reloads the saved theme on request, e.g. after an import changed it', async () => {
    signIn()
    vi.mocked(api.getSettings).mockResolvedValue([])
    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled())
    vi.mocked(api.getSettings).mockResolvedValue([{ setting: 'ColourTheme', values: ['jade'] }])

    await act(() => result.current.reloadTheme())

    expect(result.current.theme).toEqual({ scheme: 'system', color: 'jade' })
    expect(loadTheme()).toEqual({ scheme: 'system', color: 'jade' })
  })
})
