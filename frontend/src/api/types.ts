// Mirrors the backend contracts in backend/Autograt.Api/Contracts. Dates are "yyyy-MM-dd"; timestamps are ISO UTC.

export type EntryCategory = 'Good' | 'Neutral' | 'Bad'

export const ENTRY_CATEGORIES: readonly EntryCategory[] = ['Good', 'Neutral', 'Bad']

/** Pending users are awaiting admin approval and cannot log in. */
export type UserRole = 'Pending' | 'Standard' | 'Admin'

export interface User {
  id: number
  username: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  expiresAtUtc: string
  user: User
}

export interface Append {
  id: number
  subEntryId: number
  content: string
  createdAtUtc: string
}

export interface SubEntry {
  id: number
  category: EntryCategory
  content: string
  createdAtUtc: string
  appends: Append[]
}

export interface DayDetail {
  entryDate: string
  /** Null until the day is rated; a day can have entries before it has a rating. */
  dayRating: number | null
  subEntries: SubEntry[]
}

export interface HeatmapDay {
  date: string
  dayRating: number | null
  entryCount: number
}

export type SearchResultType = 'SubEntry' | 'Append'

export interface SearchResult {
  type: SearchResultType
  subEntryId: number
  appendId: number | null
  category: EntryCategory
  content: string
  entryDate: string
  createdAtUtc: string
}

/** A user preference; mirrors the backend Setting enum. */
export type SettingName = 'BrightnessTheme' | 'ColourTheme' | 'RemindersEnabled' | 'ReminderTime' | 'TimeZone'

/** A setting's saved values, or its defaults when the user has not saved any. */
export interface UserSetting {
  setting: SettingName
  values: string[]
}

export interface PushPublicKey {
  /** The server's VAPID public key, base64url-encoded. */
  publicKey: string
}

/** A browser's push subscription, in the shape of PushSubscription.toJSON(). */
export interface PushSubscriptionRequest {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** A running build; local dev builds are "0.0.0-dev" / "local" with no build date. */
export interface BuildVersion {
  version: string
  commit: string
  buildDate: string | null
}

/** "json" can be imported again; "markdown" is for reading only. */
export type ExportFormat = 'json' | 'markdown'

/** A downloaded export, named as the server suggests. */
export interface ExportFile {
  blob: Blob
  fileName: string
}

export interface ImportResult {
  /** Every day in the file, including the replaced ones. */
  importedDays: number
  /** Dates (yyyy-MM-dd) the user already had, which the file's version replaced. */
  replacedDays: string[]
  settingsImported: number
}
