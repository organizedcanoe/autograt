import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from './client'

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAuthToken(null)
    setUnauthorizedHandler(null)
  })

  it('sends the bearer token and returns parsed JSON', async () => {
    const fetchMock = stubFetch(Response.json([{ date: '2026-09-23', dayRating: 8, entryCount: 2 }]))
    setAuthToken('abc123')

    const days = await api.getHeatmap('2026-08-25', '2026-09-23')

    expect(days[0].dayRating).toBe(8)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/journal/heatmap?from=2026-08-25&to=2026-09-23')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer abc123')
  })

  it('sends JSON bodies', async () => {
    const fetchMock = stubFetch(Response.json({ id: 1, subEntryId: 42, content: 'Note', createdAtUtc: '' }, { status: 201 }))

    await api.addAppend(42, 'Note')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/journal/sub-entries/42/appends')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ content: 'Note' }))
  })

  it('updates a rating and a sub-entry with PUT', async () => {
    // A fresh response per call, since a body can only be read once.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})))
    vi.stubGlobal('fetch', fetchMock)

    await api.updateRating('2026-09-23', 4)
    await api.updateSubEntry(42, 'Bad', 'Rewritten')

    const [ratingUrl, ratingInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect([ratingUrl, ratingInit.method, ratingInit.body]).toEqual([
      '/api/journal/entries/2026-09-23/rating',
      'PUT',
      JSON.stringify({ dayRating: 4 }),
    ])
    const [subEntryUrl, subEntryInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect([subEntryUrl, subEntryInit.method, subEntryInit.body]).toEqual([
      '/api/journal/sub-entries/42',
      'PUT',
      JSON.stringify({ category: 'Bad', content: 'Rewritten' }),
    ])
  })

  it('calls the push endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/public-key') ? Response.json({ publicKey: 'AQID' }) : new Response(null, { status: 204 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const subscription = { endpoint: 'https://push.example/1', keys: { p256dh: 'key', auth: 'secret' } }

    expect(await api.getPushPublicKey()).toEqual({ publicKey: 'AQID' })
    await api.savePushSubscription(subscription)
    await api.deletePushSubscription('https://push.example/1')
    await api.sendTestPush()

    const calls = (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) => [url, init.method, init.body])
    expect(calls).toEqual([
      ['/api/push/public-key', 'GET', undefined],
      ['/api/push/subscriptions', 'POST', JSON.stringify(subscription)],
      ['/api/push/subscriptions', 'DELETE', JSON.stringify({ endpoint: 'https://push.example/1' })],
      ['/api/push/test', 'POST', undefined],
    ])
  })

  it('raises ApiError with the first validation message', async () => {
    stubFetch(Response.json(
      { title: 'One or more validation errors occurred.', errors: { Content: ['The Content field is required.'] } },
      { status: 400 },
    ))

    const error = await api.addAppend(42, '').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'The Content field is required.' })
  })

  it('keeps every validation message as details', async () => {
    stubFetch(Response.json(
      { title: 'One or more validation errors occurred.', errors: { version: ['Bad version.'], 'entries[1].date': ['Repeated.'] } },
      { status: 400 },
    ))

    const error = await api.importJournal({}).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 400, message: 'Bad version.', details: ['Bad version.', 'Repeated.'] })
  })

  it('exports the journal as a file named by the server', async () => {
    const fetchMock = stubFetch(new Response('# Journal', {
      headers: { 'Content-Disposition': "attachment; filename=x.md; filename*=UTF-8''autograt-bil%C3%A9-2026-09-30.md" },
    }))
    setAuthToken('abc123')

    const file = await api.exportJournal('markdown')

    expect(file.fileName).toBe('autograt-bilé-2026-09-30.md')
    expect(await file.blob.text()).toBe('# Journal')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/export?format=markdown')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer abc123')
  })

  it('falls back to a plain file name when the server gives none', async () => {
    stubFetch(new Response('{}'))

    expect((await api.exportJournal('json')).fileName).toBe('autograt-export.json')
  })

  it('posts an import file', async () => {
    const result = { importedDays: 1, replacedDays: [], settingsImported: 0 }
    const fetchMock = stubFetch(Response.json(result))
    const file = { format: 'autograt-export', version: 1 }

    expect(await api.importJournal(file)).toEqual(result)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect([url, init.method, init.body]).toEqual(['/api/import', 'POST', JSON.stringify(file)])
  })

  it('raises ApiError with the problem title when there are no field errors', async () => {
    stubFetch(Response.json({ title: 'That username is already taken.' }, { status: 409 }))

    await expect(api.register('billy', 'password')).rejects.toMatchObject({
      status: 409,
      message: 'That username is already taken.',
    })
  })

  it('returns null for a day without an entry', async () => {
    stubFetch(new Response(null, { status: 404 }))

    expect(await api.getDay('2026-09-23')).toBeNull()
  })

  it('calls the unauthorized handler when a signed-in request gets 401', async () => {
    stubFetch(new Response(null, { status: 401 }))
    const onUnauthorized = vi.fn()
    setAuthToken('expired')
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  describe('when Cloudflare Access redirects a request to its login page', () => {
    // jsdom can't build the opaque response that redirect: 'manual' gives, so stand in for it.
    const redirected = { type: 'opaqueredirect', ok: false, status: 0 } as Response
    let reload: ReturnType<typeof vi.fn>
    let client: typeof import('./client')

    /** Records an Access reload by an earlier page load, this many milliseconds ago. */
    function reloadedAgo(ms: number) {
      sessionStorage.setItem('autograt.accessReloadAt', String(Date.now() - ms))
    }

    /** Settles to 'pending' if the promise is still waiting once other pending work has run. */
    async function outcome(promise: Promise<unknown>) {
      const pending = new Promise((resolve) => setTimeout(() => resolve('pending'), 0))
      return Promise.race([promise.then(() => 'resolved', () => 'rejected'), pending])
    }

    beforeEach(async () => {
      sessionStorage.clear()
      stubFetch(redirected)
      reload = vi.fn()
      vi.stubGlobal('location', { reload })
      // A fresh module per test, as each page load gets, so one test's reload doesn't carry over to the next.
      vi.resetModules()
      client = await import('./client')
    })

    afterEach(() => {
      vi.restoreAllMocks()
      sessionStorage.clear()
    })

    it('reloads the page without settling, so no error shows before it unloads', async () => {
      expect(await outcome(client.api.me())).toBe('pending')
      expect(reload).toHaveBeenCalledOnce()
      const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(init.redirect).toBe('manual')
    })

    it('reloads once for requests redirected together, and none of them shows an error', async () => {
      const outcomes = await Promise.all([client.api.me(), client.api.refresh(), client.api.getSettings()].map(outcome))

      expect(outcomes).toEqual(['pending', 'pending', 'pending'])
      expect(reload).toHaveBeenCalledOnce()
    })

    it('throws instead of reloading again when an earlier page load reloaded moments ago', async () => {
      reloadedAgo(5_000)

      await expect(client.api.me()).rejects.toBeInstanceOf(client.ApiError)
      expect(reload).not.toHaveBeenCalled()
    })

    it('reloads again once the earlier reload is long past', async () => {
      reloadedAgo(60_000)

      expect(await outcome(client.api.me())).toBe('pending')
      expect(reload).toHaveBeenCalledOnce()
    })

    it('reloads when the clock has moved back past the earlier reload', async () => {
      reloadedAgo(-60_000)

      expect(await outcome(client.api.me())).toBe('pending')
      expect(reload).toHaveBeenCalledOnce()
    })

    it('still reloads when storage is blocked', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError')
      })

      expect(await outcome(client.api.me())).toBe('pending')
      expect(reload).toHaveBeenCalledOnce()
    })
  })
})
