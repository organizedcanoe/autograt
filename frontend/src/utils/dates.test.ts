import { describe, expect, it } from 'vitest'
import { formatDateTime } from './dates'

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
