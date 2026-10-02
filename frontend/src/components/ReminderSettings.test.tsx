import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import type { UserSetting } from '../api/types'
import { restorePushBrowser, stubIos, stubPushBrowser, TEST_ENDPOINT } from '../test/pushBrowserStub'
import ReminderSettings from './ReminderSettings'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      getSettings: vi.fn(),
      updateSetting: vi.fn(),
      getPushPublicKey: vi.fn(),
      savePushSubscription: vi.fn(),
      deletePushSubscription: vi.fn(),
      sendTestPush: vi.fn(),
    },
  }
})

interface SavedReminders {
  enabled?: boolean
  times?: string[]
}

function renderWith({ enabled = false, times = ['12:00', '20:00'] }: SavedReminders = {}) {
  const settings: UserSetting[] = [
    { setting: 'BrightnessTheme', values: ['system'] },
    { setting: 'RemindersEnabled', values: [enabled ? 'on' : 'off'] },
    { setting: 'ReminderTime', values: times },
  ]
  vi.mocked(api.getSettings).mockResolvedValue(settings)
  render(<ReminderSettings />)
}

const reminderSwitch = () => screen.findByRole('switch', { name: 'Enable reminders' })

describe('ReminderSettings', () => {
  beforeEach(() => {
    vi.mocked(api.updateSetting).mockImplementation((setting, values) => Promise.resolve({ setting, values }))
    vi.mocked(api.getPushPublicKey).mockResolvedValue({ publicKey: 'AQID' })
  })

  afterEach(() => {
    restorePushBrowser()
    vi.resetAllMocks()
  })

  describe('unsupported browsers', () => {
    it('explains when the browser has no notifications', async () => {
      renderWith()

      expect(await screen.findByText("This browser doesn't support notifications.")).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    it('asks iOS users to add the app to the Home Screen', async () => {
      stubIos({ standalone: false })
      renderWith()

      expect(await screen.findByText(/tap Share → Add to Home Screen/)).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    it('explains when notifications are blocked', async () => {
      stubPushBrowser({ permission: 'denied' })
      renderWith()

      expect(await screen.findByText('Notifications are blocked. Allow them in your browser settings.')).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })
  })

  describe('turning reminders on and off', () => {
    it('asks for permission, subscribes this device and saves the setting', async () => {
      const { notification, pushManager } = stubPushBrowser()
      renderWith()

      await userEvent.click(await reminderSwitch())

      expect(notification.requestPermission).toHaveBeenCalled()
      expect(pushManager.subscribe).toHaveBeenCalled()
      expect(api.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint: TEST_ENDPOINT }))
      expect(api.updateSetting).toHaveBeenCalledWith('RemindersEnabled', ['on'])
      expect(await reminderSwitch()).toBeChecked()
    })

    it('reverts the switch and shows an alert when permission is denied', async () => {
      const { pushManager } = stubPushBrowser({ permissionAnswer: 'denied' })
      renderWith()

      await userEvent.click(await reminderSwitch())

      expect(await screen.findByRole('alert')).toHaveTextContent('Notifications are blocked. Allow them in your browser settings.')
      expect(await reminderSwitch()).not.toBeChecked()
      expect(pushManager.subscribe).not.toHaveBeenCalled()
      expect(api.updateSetting).not.toHaveBeenCalled()
    })

    it('reports a subscription that could not be saved', async () => {
      stubPushBrowser()
      vi.mocked(api.savePushSubscription).mockRejectedValue(new ApiError(500, 'Server error'))
      renderWith()

      await userEvent.click(await reminderSwitch())

      expect(await screen.findByRole('alert')).toHaveTextContent('Reminders could not be turned on: Server error')
      expect(await reminderSwitch()).not.toBeChecked()
    })

    it('unsubscribes this device and saves the setting when turned off', async () => {
      const { subscription } = stubPushBrowser({ permission: 'granted', subscribed: true })
      renderWith({ enabled: true })

      await userEvent.click(await reminderSwitch())

      expect(api.deletePushSubscription).toHaveBeenCalledWith(TEST_ENDPOINT)
      expect(subscription.unsubscribe).toHaveBeenCalled()
      expect(api.updateSetting).toHaveBeenCalledWith('RemindersEnabled', ['off'])
      expect(await reminderSwitch()).not.toBeChecked()
    })

    it('saves this device again on load, in case the server lost it', async () => {
      stubPushBrowser({ permission: 'granted', subscribed: true })
      renderWith({ enabled: true })

      expect(await reminderSwitch()).toBeChecked()
      // The resave runs in an effect after the switch renders, so wait for it.
      await waitFor(() =>
        expect(api.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint: TEST_ENDPOINT })),
      )
      expect(screen.queryByText(/not for this device/)).not.toBeInTheDocument()
    })

    it('offers to enable reminders on a device that is not subscribed', async () => {
      const { pushManager } = stubPushBrowser({ permission: 'granted' })
      renderWith({ enabled: true })

      expect(await screen.findByText('Reminders are on, but not for this device.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Enable on this device' }))

      expect(pushManager.subscribe).toHaveBeenCalled()
      expect(api.savePushSubscription).toHaveBeenCalled()
      expect(api.updateSetting).not.toHaveBeenCalled()
      expect(screen.queryByText(/not for this device/)).not.toBeInTheDocument()
    })

    it('sends a test notification', async () => {
      stubPushBrowser({ permission: 'granted', subscribed: true })
      vi.mocked(api.sendTestPush).mockResolvedValue(undefined)
      renderWith({ enabled: true })

      await userEvent.click(await screen.findByRole('button', { name: 'Send test notification' }))

      expect(api.sendTestPush).toHaveBeenCalled()
      expect(await screen.findByText('Test notification sent.')).toBeInTheDocument()
    })

    it('only offers a test notification while reminders are on', async () => {
      stubPushBrowser()
      renderWith()

      await reminderSwitch()
      expect(screen.queryByRole('button', { name: 'Send test notification' })).not.toBeInTheDocument()
    })
  })

  describe('reminder times', () => {
    it('saves the remaining times when one is removed', async () => {
      stubPushBrowser()
      renderWith()

      await userEvent.click(await screen.findByRole('button', { name: 'Remove reminder time 1' }))

      expect(api.updateSetting).toHaveBeenCalledWith('ReminderTime', ['20:00'])
      expect(screen.getAllByLabelText(/^Reminder time \d$/)).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Remove reminder time 1' })).toBeDisabled()
    })

    it('saves a new time once it is filled in', async () => {
      stubPushBrowser()
      renderWith()

      await userEvent.click(await screen.findByRole('button', { name: 'Add time' }))
      expect(api.updateSetting).not.toHaveBeenCalled()
      const newTime = screen.getByLabelText('Reminder time 3')
      fireEvent.change(newTime, { target: { value: '07:30' } })
      fireEvent.blur(newTime)

      expect(api.updateSetting).toHaveBeenCalledWith('ReminderTime', ['12:00', '20:00', '07:30'])
    })

    it('saves an edited time on blur', async () => {
      stubPushBrowser()
      renderWith()

      const first = await screen.findByLabelText('Reminder time 1')
      fireEvent.change(first, { target: { value: '13:15' } })
      expect(api.updateSetting).not.toHaveBeenCalled()
      fireEvent.blur(first)

      expect(api.updateSetting).toHaveBeenCalledWith('ReminderTime', ['13:15', '20:00'])
    })

    it('allows at most four times', async () => {
      stubPushBrowser()
      renderWith({ times: ['08:00', '12:00', '16:00', '20:00'] })

      expect(await screen.findByRole('button', { name: 'Add time' })).toBeDisabled()
    })

    it('shows the times on unsupported browsers too', async () => {
      renderWith()

      expect(await screen.findByLabelText('Reminder time 1')).toHaveValue('12:00')
    })
  })
})
