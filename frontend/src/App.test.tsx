import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login screen when signed out', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Autograt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('resets the URL to the root when logging out', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', isAdmin: false } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    window.history.replaceState(null, '', '/search?q=dog')
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/')
  })
})
