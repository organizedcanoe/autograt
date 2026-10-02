import type {
  Append,
  AppSettings,
  BuildVersion,
  DayDetail,
  EntryCategory,
  ExportFile,
  ExportFormat,
  HeatmapDay,
  ImportResult,
  LoginResponse,
  PushPublicKey,
  PushSubscriptionRequest,
  RegistrationStatus,
  ResetPasswordResponse,
  SearchResult,
  SettingName,
  SubEntry,
  User,
  UserSetting,
} from './types'

export class ApiError extends Error {
  readonly status: number
  /** Every validation message, when the server reported several (the first is also the message). */
  readonly details: string[]

  constructor(status: number, message: string, details: string[] = [message]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
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

async function readError(response: Response): Promise<ApiError> {
  const fallback = `Request failed (${response.status})`
  try {
    const problem = (await response.json()) as ProblemDetails
    const fieldErrors = Object.values(problem.errors ?? {}).flat()
    const message = fieldErrors[0] ?? problem.title ?? fallback
    return new ApiError(response.status, message, fieldErrors.length > 0 ? fieldErrors : [message])
  } catch {
    return new ApiError(response.status, fallback)
  }
}

/** Sends a request with the bearer token, throwing ApiError unless it succeeds. */
async function send(method: string, path: string, body?: unknown): Promise<Response> {
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
    throw await readError(response)
  }

  return response
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body)
  return (response.status === 204 ? undefined : await response.json()) as T
}

/** The file name from a Content-Disposition header, preferring the UTF-8 `filename*` form. */
function fileNameFrom(disposition: string | null): string | null {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeURIComponent(encoded)
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? null
}

async function downloadFile(path: string, fallbackName: string): Promise<ExportFile> {
  const response = await send('GET', path)
  return { blob: await response.blob(), fileName: fileNameFrom(response.headers.get('Content-Disposition')) ?? fallbackName }
}

export const api = {
  register: (username: string, password: string) =>
    request<User>('POST', '/auth/register', { username, password }),

  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { username, password }),

  me: () => request<User>('GET', '/auth/me'),

  /** Swaps the current token for a new one, so a session in use never expires. */
  refresh: () => request<LoginResponse>('POST', '/auth/refresh'),

  getRegistrationStatus: () => request<RegistrationStatus>('GET', '/auth/registration'),

  /** Signs out every other session; the response is the new session for this one. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<LoginResponse>('PUT', '/account/password', { currentPassword, newPassword }),

  /** The response is a new session carrying the new username. */
  changeUsername: (username: string) => request<LoginResponse>('PUT', '/account/username', { username }),

  /** Deletes the account and all its data. */
  deleteAccount: (password: string) => request<void>('DELETE', '/account', { password }),

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

  /** Deletes one of today's sub-entries along with its appends. */
  deleteSubEntry: (subEntryId: number) => request<void>('DELETE', `/journal/sub-entries/${subEntryId}`),

  addAppend: (subEntryId: number, content: string) =>
    request<Append>('POST', `/journal/sub-entries/${subEntryId}/appends`, { content }),

  /** Deletes an append on one of today's sub-entries. */
  deleteAppend: (appendId: number) => request<void>('DELETE', `/journal/appends/${appendId}`),

  getHeatmap: (from: string, to: string) => request<HeatmapDay[]>('GET', `/journal/heatmap?from=${from}&to=${to}`),

  search: (query: string) => request<SearchResult[]>('GET', `/journal/search?q=${encodeURIComponent(query)}`),

  getSettings: () => request<UserSetting[]>('GET', '/settings'),

  updateSetting: (setting: SettingName, values: string[]) =>
    request<UserSetting>('PUT', `/settings/${setting}`, { values }),

  /** Downloads the user's whole journal and saved settings. */
  exportJournal: (format: ExportFormat) =>
    downloadFile(`/export?format=${format}`, `autograt-export.${format === 'json' ? 'json' : 'md'}`),

  /** Imports a JSON export (as parsed from the file); the server validates it. */
  importJournal: (file: unknown) => request<ImportResult>('POST', '/import', file),

  getPushPublicKey: () => request<PushPublicKey>('GET', '/push/public-key'),

  savePushSubscription: (subscription: PushSubscriptionRequest) =>
    request<void>('POST', '/push/subscriptions', subscription),

  deletePushSubscription: (endpoint: string) => request<void>('DELETE', '/push/subscriptions', { endpoint }),

  /** Sends a test notification to every device the user enabled reminders on. */
  sendTestPush: () => request<void>('POST', '/push/test'),

  listUsers: () => request<User[]>('GET', '/admin/users'),

  approveUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/approve`),

  deleteUser: (userId: number) => request<void>('DELETE', `/admin/users/${userId}`),

  promoteUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/promote`),

  demoteUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/demote`),

  disableUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/disable`),

  enableUser: (userId: number) => request<void>('POST', `/admin/users/${userId}/enable`),

  resetUserPassword: (userId: number) =>
    request<ResetPasswordResponse>('POST', `/admin/users/${userId}/reset-password`),

  getAppSettings: () => request<AppSettings>('GET', '/admin/settings'),

  updateAppSettings: (settings: AppSettings) => request<AppSettings>('PUT', '/admin/settings', settings),

  getVersion: () => request<BuildVersion>('GET', '/version'),
}
