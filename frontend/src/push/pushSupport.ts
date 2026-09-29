export type PushSupport = 'supported' | 'unsupported' | 'needs-install' | 'denied'

interface IosNavigator extends Navigator {
  /** Safari's flag for a page opened from the Home Screen. */
  standalone?: boolean
}

function isIos(): boolean {
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (navigator as IosNavigator).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** Whether this browser can get reminder notifications, and if not, why. */
export function getPushSupport(): PushSupport {
  // iOS only offers the Push API to apps opened from the Home Screen, so check this first.
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'supported'
}
