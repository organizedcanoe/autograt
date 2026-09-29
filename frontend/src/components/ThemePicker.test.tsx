import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ThemePicker from './ThemePicker'

describe('ThemePicker', () => {
  it('shows the current choice', () => {
    render(<ThemePicker theme={{ scheme: 'dark', color: 'jade' }} onChange={() => {}} />)

    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('dark')
    expect(screen.getByRole('combobox', { name: 'Color' })).toHaveValue('jade')
  })

  it('reports a new mode or color, keeping the other part of the theme', async () => {
    const onChange = vi.fn()
    render(<ThemePicker theme={{ scheme: 'system', color: 'azure' }} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'dark')
    expect(onChange).toHaveBeenLastCalledWith({ scheme: 'dark', color: 'azure' })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Color' }), 'jade')
    expect(onChange).toHaveBeenLastCalledWith({ scheme: 'system', color: 'jade' })
  })
})
