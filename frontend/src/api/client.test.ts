import { afterEach, describe, expect, it, vi } from 'vitest'
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

    const days = await api.getHeatmap('2026-09-23')

    expect(days[0].dayRating).toBe(8)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/journal/heatmap?today=2026-09-23')
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

  it('raises ApiError with the first validation message', async () => {
    stubFetch(Response.json(
      { title: 'One or more validation errors occurred.', errors: { Content: ['The Content field is required.'] } },
      { status: 400 },
    ))

    const error = await api.addAppend(42, '').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'The Content field is required.' })
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
})
