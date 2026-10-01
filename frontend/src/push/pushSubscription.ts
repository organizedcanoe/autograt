import { api, ApiError } from '../api/client'
import type { PushSubscriptionRequest } from '../api/types'
import { getPushSupport } from './pushSupport'

/** Decodes a base64url string (as VAPID public keys are sent) into the bytes the Push API expects. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function toRequest(subscription: PushSubscription): PushSubscriptionRequest {
  const { keys } = subscription.toJSON()
  return { endpoint: subscription.endpoint, keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' } }
}

async function getPushManager(): Promise<PushManager> {
  return (await navigator.serviceWorker.ready).pushManager
}

/** This browser's push subscription, or null if it has none. */
export async function getThisDeviceSubscription(): Promise<PushSubscription | null> {
  return (await getPushManager()).getSubscription()
}

/**
 * Subscribes this browser with its push service (reusing an existing subscription) and saves it
 * for the signed-in user. Notification permission must already be granted.
 */
export async function subscribeThisDevice(): Promise<void> {
  const pushManager = await getPushManager()
  let subscription = await pushManager.getSubscription()
  if (!subscription) {
    const { publicKey } = await api.getPushPublicKey()
    subscription = await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  }
  await api.savePushSubscription(toRequest(subscription))
}

/**
 * Unsubscribes this browser from its push service without telling the server, e.g. after the account (and with it
 * the server's copy of the subscription) was deleted. Does nothing where push is not available.
 */
export async function forgetThisDevice(): Promise<void> {
  if (getPushSupport() !== 'supported') return
  await (await getThisDeviceSubscription())?.unsubscribe()
}

/** Deletes this browser's subscription for the signed-in user, then unsubscribes it from its push service. */
export async function unsubscribeThisDevice(): Promise<void> {
  const subscription = await getThisDeviceSubscription()
  if (!subscription) return

  try {
    await api.deletePushSubscription(subscription.endpoint)
  } catch (error) {
    // The server may have already dropped it, e.g. after the push service reported it expired.
    if (!(error instanceof ApiError && error.status === 404)) throw error
  }
  await subscription.unsubscribe()
}
