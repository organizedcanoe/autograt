import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from './api/types'
import App from './App'

function signInAs(role: UserRole, mustChangePassword = false) {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  const session = { token: 'token', user: { id: 1, username: 'billy', role, mustChangePassword } }
  localStorage.setItem('autograt.session', JSON.stringify(session))
}

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
    const session = { token: 'token', user: { id: 1, username: 'billy', role: 'Admin', mustChangePassword: false } }
    localStorage.setItem('autograt.session', JSON.stringify(session))
    render(<App />)

    const banner = screen.getByRole('banner')
    const header = within(banner)
    expect(banner).not.toHaveTextContent('Hello')
    expect(header.queryByRole('combobox')).not.toBeInTheDocument()

    const menu = header.getByText('billy').closest('details')!
    await userEvent.click(header.getByText('billy'))
    expect(menu).toHaveAttribute('open')

    await userEvent.click(header.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(menu).not.toHaveAttribute('open')
  })

  it.each(['/settings', '/admin'])('hides the search bar on %s', (path) => {
    signInAs('Admin')
    window.history.replaceState(null, '', path)
    render(<App />)

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('shows the search bar on journal pages', () => {
    signInAs('Standard')
    window.history.replaceState(null, '', '/day/2026-09-01')
    render(<App />)

    expect(within(screen.getByRole('banner')).getByRole('searchbox')).toBeInTheDocument()
  })

  it("shows only the search page's own search bar on the search page", () => {
    signInAs('Standard')
    window.history.replaceState(null, '', '/search?q=dog')
    render(<App />)

    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
    expect(within(screen.getByRole('banner')).queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('links to the search page from the header and from the menu', async () => {
    signInAs('Standard')
    render(<App />)

    const header = within(screen.getByRole('banner'))
    const links = header.getAllByRole('link', { name: 'Search' })
    expect(links).toHaveLength(2)
    expect(links.every((link) => link.getAttribute('href') === '/search')).toBe(true)

    const menu = header.getByText('billy').closest('details')!
    await userEvent.click(header.getByText('billy'))
    await userEvent.click(within(menu).getByRole('link', { name: 'Search' }))
    expect(window.location.pathname).toBe('/search')
    expect(menu).not.toHaveAttribute('open')
  })

  it('opens the admin page from the menu for admins', async () => {
    signInAs('Admin')
    render(<App />)

    await userEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Admin' }))

    expect(window.location.pathname).toBe('/admin')
    expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument()
  })

  it('keeps standard users out of the admin page', () => {
    signInAs('Standard')
    window.history.replaceState(null, '', '/admin')
    render(<App />)

    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument()
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

  it.each(['/', '/settings', '/day/2026-09-01'])('asks a user whose password was reset to choose a new one on %s', (path) => {
    signInAs('Standard', true)
    window.history.replaceState(null, '', path)
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('logs out from the choose a new password page', async () => {
    signInAs('Standard', true)
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })
})
