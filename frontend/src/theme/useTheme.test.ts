import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadTheme } from './theme'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts from the saved theme', () => {
    localStorage.setItem('autograt.theme', JSON.stringify({ scheme: 'light', color: 'pumpkin' }))

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toEqual({ scheme: 'light', color: 'pumpkin' })
  })

  it('applies and remembers changes', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme({ scheme: 'dark', color: 'slate' }))

    expect(result.current.theme).toEqual({ scheme: 'dark', color: 'slate' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color', 'slate')
    expect(loadTheme()).toEqual({ scheme: 'dark', color: 'slate' })
  })
})
