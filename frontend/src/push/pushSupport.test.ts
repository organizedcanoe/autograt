import { afterEach, describe, expect, it } from 'vitest'
import { restorePushBrowser, stubIos, stubPushBrowser } from '../test/pushBrowserStub'
import { getPushSupport } from './pushSupport'

describe('getPushSupport', () => {
  afterEach(() => {
    restorePushBrowser()
  })

  it('is supported when the Push API is available and not blocked', () => {
    stubPushBrowser({ permission: 'default' })

    expect(getPushSupport()).toBe('supported')
  })

  it('is unsupported without a service worker or push manager', () => {
    expect(getPushSupport()).toBe('unsupported')
  })

  it('is denied when notifications are blocked', () => {
    stubPushBrowser({ permission: 'denied' })

    expect(getPushSupport()).toBe('denied')
  })

  it('needs installing on iOS outside the Home Screen app', () => {
    // iOS hides the Push API in a browser tab, so it looks unsupported too.
    stubIos({ standalone: false })

    expect(getPushSupport()).toBe('needs-install')
  })

  it('is supported on iOS when opened from the Home Screen', () => {
    stubIos({ standalone: true })
    stubPushBrowser()

    expect(getPushSupport()).toBe('supported')
  })
})
