import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadTheme } from '../theme/theme'
import ThemePicker from './ThemePicker'

describe('ThemePicker', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the current choice', () => {
    render(<ThemePicker />)

    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('system')
    expect(screen.getByRole('combobox', { name: 'Color' })).toHaveValue('azure')
  })

  it('switches the mode and color and remembers them', async () => {
    render(<ThemePicker />)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'dark')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Color' }), 'jade')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color', 'jade')
    expect(loadTheme()).toEqual({ scheme: 'dark', color: 'jade' })
  })
})
