import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Wordmark from './Wordmark'

describe('Wordmark', () => {
  it('shows the app name', () => {
    render(<Wordmark />)

    expect(screen.getByText('Autograt')).toBeInTheDocument()
  })
})
