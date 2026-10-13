import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import { expectNoAxeViolations } from '../test/axe'
import SettingsPage from './SettingsPage'

vi.mock('../theme/ThemeContext', () => ({ useTheme: vi.fn() }))
// Tested on its own; here it only needs to appear below Appearance.
vi.mock('../components/AccountSettings', () => ({ default: () => <section>Account settings</section> }))
vi.mock('../components/TimeZoneSettings', () => ({ default: () => <section>Time zone settings</section> }))
vi.mock('../components/ReminderSettings', () => ({ default: () => <section>Reminder settings</section> }))
vi.mock('../components/DataSettings', () => ({
  default: ({ onImported }: { onImported: () => void }) => (
    <button type="button" onClick={onImported}>
      Fake import
    </button>
  ),
}))

function renderPage(setTheme = vi.fn().mockResolvedValue(undefined), reloadTheme = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useTheme).mockReturnValue({ theme: { scheme: 'system', color: 'azure' }, setTheme, reloadTheme })
  render(<SettingsPage />)
  return setTheme
}

describe('SettingsPage', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('passes an axe check', async () => {
    renderPage()

    await expectNoAxeViolations(document.body)
  })

  it('saves a new theme choice', async () => {
    const setTheme = renderPage()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Color' }), 'jade')

    expect(setTheme).toHaveBeenCalledWith({ scheme: 'system', color: 'jade' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the time zone, then the reminder settings, after the appearance settings', () => {
    renderPage()

    const appearance = screen.getByRole('heading', { name: 'Appearance' })
    const timeZone = screen.getByText('Time zone settings')
    const reminders = screen.getByText('Reminder settings')
    expect(appearance.compareDocumentPosition(timeZone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(timeZone.compareDocumentPosition(reminders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reports a theme that could not be saved', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError(500, 'Server error')))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'dark')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your theme could not be saved: Server error')
  })

  it('reloads the theme after an import', async () => {
    const reloadTheme = vi.fn().mockResolvedValue(undefined)
    renderPage(undefined, reloadTheme)

    await userEvent.click(screen.getByRole('button', { name: 'Fake import' }))

    expect(reloadTheme).toHaveBeenCalledTimes(1)
  })
})
