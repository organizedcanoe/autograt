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

  it("opens the settings page from the user's menu instead of showing the theme controls in the header", async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Admin' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    render(<App />)

    const banner = screen.getByRole('banner')
    const header = within(banner)
    expect(banner).not.toHaveTextContent('Hello')
    expect(header.queryByRole('combobox')).not.toBeInTheDocument()
    expect(header.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()

    const menu = header.getByText('billy').closest('details')!
    await userEvent.click(header.getByText('billy'))
    expect(menu).toHaveAttribute('open')

    await userEvent.click(header.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(menu).not.toHaveAttribute('open')
  })

  it('hides the search bar on the settings page only', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Standard' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    window.history.replaceState(null, '', '/settings')
    const { unmount } = render(<App />)

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()

    unmount()
    window.history.replaceState(null, '', '/search?q=dog')
    render(<App />)

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('resets the URL to the root when logging out', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Standard' } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    window.history.replaceState(null, '', '/search?q=dog')
    render(<App />)

    await userEvent.click(screen.getByRole('link', { name: 'Log out' }))

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/')
  })
})
