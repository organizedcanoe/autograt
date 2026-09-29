import { render, screen, within } from '@testing-library/react'
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

  it('greets the signed-in user in the header', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Standard' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    render(<App />)

    expect(screen.getByRole('banner')).toHaveTextContent('Hello, billy')
  })

  it('links to the settings page instead of showing the theme controls in the header', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Admin' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    render(<App />)

    const header = within(screen.getByRole('banner'))
    expect(header.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(header.queryByRole('combobox')).not.toBeInTheDocument()
    expect(header.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('resets the URL to the root when logging out', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Standard' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    window.history.replaceState(null, '', '/search?q=dog')
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/')
  })
})
