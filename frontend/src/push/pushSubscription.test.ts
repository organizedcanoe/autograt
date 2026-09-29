import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import { restorePushBrowser, stubPushBrowser, TEST_ENDPOINT } from '../test/pushBrowserStub'
import { getThisDeviceSubscription, subscribeThisDevice, unsubscribeThisDevice, urlBase64ToUint8Array } from './pushSubscription'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: { ...original.api, getPushPublicKey: vi.fn(), savePushSubscription: vi.fn(), deletePushSubscription: vi.fn() },
  }
})

describe('urlBase64ToUint8Array', () => {
  it('decodes unpadded base64url, including the - and _ characters', () => {
    // base64url uses - and _ where standard base64 uses + and /, and drops the = padding.
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff])
    expect(Array.from(urlBase64ToUint8Array('-__8'))).toEqual([0xfb, 0xff, 0xfc])
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToUint8Array('AQIDBA'))).toEqual([1, 2, 3, 4])
  })
})

describe('push subscription', () => {
  afterEach(() => {
    restorePushBrowser()
    vi.resetAllMocks()
  })

  it('subscribes with the server key and saves the subscription', async () => {
    const { pushManager } = stubPushBrowser()
    vi.mocked(api.getPushPublicKey).mockResolvedValue({ publicKey: 'AQID' })

    await subscribeThisDevice()

    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
    expect(api.savePushSubscription).toHaveBeenCalledWith({
      endpoint: TEST_ENDPOINT,
      keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
    })
  })

  it('saves an existing subscription instead of making a new one', async () => {
    const { pushManager } = stubPushBrowser({ subscribed: true })

    await subscribeThisDevice()

    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(api.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint: TEST_ENDPOINT }))
  })

  it('deletes the saved subscription, then unsubscribes the browser', async () => {
    const { subscription } = stubPushBrowser({ subscribed: true })

    await unsubscribeThisDevice()

    expect(api.deletePushSubscription).toHaveBeenCalledWith(TEST_ENDPOINT)
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(await getThisDeviceSubscription()).toBeNull()
  })

  it('still unsubscribes the browser when the server had no record of it', async () => {
    const { subscription } = stubPushBrowser({ subscribed: true })
    vi.mocked(api.deletePushSubscription).mockRejectedValue(new ApiError(404, 'Not Found'))

    await unsubscribeThisDevice()

    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('does nothing when this browser is not subscribed', async () => {
    stubPushBrowser()

    await unsubscribeThisDevice()

    expect(api.deletePushSubscription).not.toHaveBeenCalled()
  })
})
