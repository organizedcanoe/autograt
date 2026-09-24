import type {
  Append,
  CreateEntryRequest,
  DayDetail,
  EntryCategory,
  HeatmapDay,
  LoginResponse,
  SearchResult,
  SubEntry,
  User,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let authToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

/** Sets the bearer token sent with every request (null when signed out). */
export function setAuthToken(token: string | null): void {
  authToken = token
}

/** Called when a signed-in request is rejected with 401, e.g. because the token expired. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

interface ProblemDetails {
  title?: string
  errors?: Record<string, string[]>
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as ProblemDetails
    const firstFieldError = Object.values(problem.errors ?? {}).flat()[0]
    return firstFieldError ?? problem.title ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = new Headers()
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && authToken) {
    unauthorizedHandler?.()
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }

  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  register: (username: string, password: string) =>
    request<User>('POST', '/auth/register', { username, password }),

  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { username, password }),

  me: () => request<User>('GET', '/auth/me'),

  createEntry: (entry: CreateEntryRequest) => request<DayDetail>('POST', '/journal/entries', entry),

  /** Resolves to null when there is no entry for the date. */
  getDay: async (date: string): Promise<DayDetail | null> => {
    try {
      return await request<DayDetail>('GET', `/journal/entries/${date}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },

  updateRating: (date: string, dayRating: number) =>
    request<DayDetail>('PUT', `/journal/entries/${date}/rating`, { dayRating }),

  addSubEntry: (date: string, category: EntryCategory, content: string) =>
    request<SubEntry>('POST', `/journal/entries/${date}/sub-entries`, { category, content }),

  updateSubEntry: (subEntryId: number, category: EntryCategory, content: string) =>
    request<SubEntry>('PUT', `/journal/sub-entries/${subEntryId}`, { category, content }),

  addAppend: (subEntryId: number, content: string) =>
    request<Append>('POST', `/journal/sub-entries/${subEntryId}/appends`, { content }),

  getHeatmap: (today: string) => request<HeatmapDay[]>('GET', `/journal/heatmap?today=${today}`),

  search: (query: string) => request<SearchResult[]>('GET', `/journal/search?q=${encodeURIComponent(query)}`),

  listUsers: () => request<User[]>('GET', '/admin/users'),

  promoteUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/promote`),
}
