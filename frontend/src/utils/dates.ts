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

/** The "yyyy-MM-dd" date `days` days after (or, if negative, before) `isoDate`. */
export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** The "yyyy-MM" month `months` months after (or, if negative, before) `isoMonth`. */
export function addMonths(isoMonth: string, months: number): string {
  const [year, month] = isoMonth.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1 + months, 1)).slice(0, 7)
}

/** Every "yyyy-MM-dd" date in a "yyyy-MM" month, in order. */
export function monthDates(isoMonth: string): string[] {
  const [year, month] = isoMonth.split('-').map(Number)
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, index) => addDays(`${isoMonth}-01`, index))
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

/** e.g. "Sep 23, 2026" */
export function formatMediumDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** e.g. "September 2026" for "2026-09" */
export function formatMonth(isoMonth: string): string {
  return parseIsoDate(`${isoMonth}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** The weekday of a "yyyy-MM-dd" date, from 0 (Sunday) to 6 (Saturday). */
export function weekdayOf(isoDate: string): number {
  return parseIsoDate(isoDate).getDay()
}

/** Short weekday names from Sunday to Saturday, e.g. "Sun". */
export function weekdayNames(): string[] {
  // February 1, 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    parseIsoDate(addDays('2026-02-01', index)).toLocaleDateString(undefined, { weekday: 'short' }),
  )
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
