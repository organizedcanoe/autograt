// Mirrors the backend contracts in backend/Autograt.Api/Contracts. Dates are "yyyy-MM-dd"; timestamps are ISO UTC.

export type EntryCategory = 'Good' | 'Neutral' | 'Bad'

export const ENTRY_CATEGORIES: readonly EntryCategory[] = ['Good', 'Neutral', 'Bad']

export interface User {
  id: number
  username: string
  isAdmin: boolean
}

export interface LoginResponse {
  token: string
  expiresAtUtc: string
  user: User
}

export interface NewSubEntry {
  category: EntryCategory
  content: string
}

export interface CreateEntryRequest {
  entryDate: string
  dayRating: number
  subEntries: NewSubEntry[]
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
  dayRating: number
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
