import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, DEFAULT_THEME, loadTheme, saveTheme } from './theme'

const root = document.documentElement

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    root.removeAttribute('data-theme')
    root.removeAttribute('data-color')
  })

  it('defaults to following the system with the azure accent', () => {
    expect(loadTheme()).toEqual({ scheme: 'system', color: 'azure' })
    expect(DEFAULT_THEME).toEqual({ scheme: 'system', color: 'azure' })
  })

  it('remembers a saved choice', () => {
    saveTheme({ scheme: 'dark', color: 'jade' })

    expect(loadTheme()).toEqual({ scheme: 'dark', color: 'jade' })
  })

  it('falls back to the default for unknown or corrupt saved values', () => {
    localStorage.setItem('autograt.theme', JSON.stringify({ scheme: 'neon', color: 'plaid' }))
    expect(loadTheme()).toEqual(DEFAULT_THEME)

    localStorage.setItem('autograt.theme', '{not json')
    expect(loadTheme()).toEqual(DEFAULT_THEME)
  })

  it('forces light or dark through data-theme', () => {
    applyTheme({ scheme: 'dark', color: 'violet' })

    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root).toHaveAttribute('data-color', 'violet')
  })

  it('removes data-theme for system so Pico follows the OS', () => {
    applyTheme({ scheme: 'light', color: 'azure' })
    applyTheme({ scheme: 'system', color: 'azure' })

    expect(root).not.toHaveAttribute('data-theme')
  })
})
