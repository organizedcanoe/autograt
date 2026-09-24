/** Formats a Date as its local calendar date, "yyyy-MM-dd". */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Today's date in the user's time zone, as the API expects it. */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/** Whether a "yyyy-MM-dd" date is before today in the user's time zone. Past days are read-only apart from appends. */
export function isPastDate(isoDate: string): boolean {
  return isoDate < todayIso()
}

/** Parses "yyyy-MM-dd" as a local date (new Date("yyyy-MM-dd") would parse it as UTC midnight). */
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isIsoDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseIsoDate(value).getTime())
}

/** e.g. "Wednesday, September 23, 2026" */
export function formatLongDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** e.g. "Wed, Sep 23" */
export function formatShortDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Local time of a UTC timestamp, e.g. "6:05 PM" */
export function formatTime(utcTimestamp: string): string {
  return new Date(utcTimestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Local date and time of a UTC timestamp, e.g. "Wed, Sep 23, 2026, 6:05 PM" */
export function formatDateTime(utcTimestamp: string): string {
  return new Date(utcTimestamp).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
