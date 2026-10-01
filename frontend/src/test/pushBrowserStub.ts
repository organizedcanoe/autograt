import { vi } from 'vitest'

interface PushBrowserOptions {
  /** Notification.permission before anything is asked. */
  permission?: NotificationPermission
  /** What Notification.requestPermission() resolves to. */
  permissionAnswer?: NotificationPermission
  /** Whether this browser already has a push subscription. */
  subscribed?: boolean
}

export const TEST_ENDPOINT = 'https://push.example/device-1'

/**
 * Stubs the Notification, service worker and Push APIs that jsdom lacks. The push manager remembers
 * its subscription, so subscribing and unsubscribing behave like a real browser.
 */
export function stubPushBrowser({ permission = 'default', permissionAnswer = 'granted', subscribed = false }: PushBrowserOptions = {}) {
  const subscription = {
    endpoint: TEST_ENDPOINT,
    toJSON: () => ({ endpoint: TEST_ENDPOINT, expirationTime: null, keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } }),
    unsubscribe: vi.fn(() => {
      current = null
      return Promise.resolve(true)
    }),
  }
  let current: typeof subscription | null = subscribed ? subscription : null

  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn(() => {
      current = subscription
      return Promise.resolve(subscription)
    }),
  }
  const notification = { permission, requestPermission: vi.fn().mockResolvedValue(permissionAnswer) }

  vi.stubGlobal('Notification', notification)
  vi.stubGlobal('PushManager', function PushManager() {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }), getRegistration: () => Promise.resolve({ pushManager }) },
  })

  return { notification, pushManager, subscription }
}

/** Makes the browser look like iOS Safari, in a tab or opened from the Home Screen. */
export function stubIos({ standalone }: { standalone: boolean }) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  })
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone })
}

/** Undoes stubPushBrowser and stubIos. */
export function restorePushBrowser() {
  vi.unstubAllGlobals()
  // The stubs are own properties that shadow jsdom's navigator getters (or add missing ones).
  for (const key of ['serviceWorker', 'userAgent', 'standalone']) {
    Reflect.deleteProperty(navigator, key)
  }
}
