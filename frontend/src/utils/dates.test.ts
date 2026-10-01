import { describe, expect, it } from 'vitest'
import { addDays, addMonths, formatDateTime, monthDates } from './dates'

describe('formatDateTime', () => {
  it('includes both the local date and time', () => {
    const timestamp = '2026-09-23T18:05:00Z'
    const local = new Date(timestamp)
    const expectedDate = local.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const expectedTime = local.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

    const formatted = formatDateTime(timestamp)

    expect(formatted).toContain(expectedDate)
    expect(formatted).toContain(expectedTime)
    expect(formatted).toContain(String(local.getFullYear()))
  })
})

describe('addDays', () => {
  it('moves forwards and backwards across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-09-23', -29)).toBe('2026-08-25')
  })

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('addMonths', () => {
  it('moves a "yyyy-MM" month across year boundaries', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthDates', () => {
  it('lists every date in the month', () => {
    const dates = monthDates('2026-02')

    expect(dates).toHaveLength(28)
    expect(dates[0]).toBe('2026-02-01')
    expect(dates[27]).toBe('2026-02-28')
  })

  it('includes the leap day in a leap year', () => {
    expect(monthDates('2028-02')).toHaveLength(29)
  })
})
