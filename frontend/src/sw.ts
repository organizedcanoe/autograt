/// <reference lib="webworker" />
import { addRoute, cleanupOutdatedCaches, createHandlerBoundToURL, precache } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// The built app shell (JS/CSS/HTML/icons), listed by vite-plugin-pwa at build time.
precache(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Page loads go to the network first, so Cloudflare Access can redirect to its login page once its session
// expires; the cached index.html is only the offline fallback. /api is never routed or cached, so journal data
// always comes from the server. Registered before the precache route, which would otherwise answer a load of /
// with the cached index.html.
const cachedIndexHtml = createHandlerBoundToURL('index.html')
registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        return await fetch(options.request)
      } catch {
        return cachedIndexHtml(options)
      }
    },
    { denylist: [/^\/api\//] },
  ),
)
// Serves the precached app files (JS/CSS/icons) to the page.
addRoute()

// Sent by the update banner's Reload button (updateServiceWorker) to activate the new version.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

/** A reminder's content, as the backend's PushMessage sends it. */
interface PushMessage {
  title: string
  body: string
  url: string
}

self.addEventListener('push', (event) => {
  const message = event.data?.json() as PushMessage | undefined
  if (!message) return

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // A newer reminder replaces an unread older one instead of stacking.
      tag: 'autograt-reminder',
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/'

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        await existing.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})

// The push service replaced or expired this browser's subscription. The worker has no auth token to save the
// new one, so it only subscribes again; the settings page saves it on the next visit.
self.addEventListener('pushsubscriptionchange', (event) => {
  const applicationServerKey = event.oldSubscription?.options.applicationServerKey
  if (!applicationServerKey) return

  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }))
})
