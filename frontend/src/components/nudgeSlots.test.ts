import { describe, expect, it } from 'vitest'
import type { EntryCategory, SubEntry } from '../api/types'
import { assignNudgeSlots } from './nudgeSlots'

function subEntry(id: number, category: EntryCategory): SubEntry {
  return { id, category, content: `Entry ${id}`, createdAtUtc: '2026-09-23T12:00:00Z', appends: [] }
}

describe('assignNudgeSlots', () => {
  it('leaves every slot empty on a day without entries', () => {
    expect(assignNudgeSlots([])).toEqual({ slotted: [undefined, undefined, undefined], custom: [] })
  })

  it('fills each slot with the earliest entry of its category, keeping the slot order', () => {
    const bad = subEntry(1, 'Bad')
    const good = subEntry(2, 'Good')

    expect(assignNudgeSlots([bad, good])).toEqual({ slotted: [good, undefined, bad], custom: [] })
  })

  it('treats entries beyond the slots, and neutral entries, as custom', () => {
    const entries = [subEntry(1, 'Good'), subEntry(2, 'Neutral'), subEntry(3, 'Good'), subEntry(4, 'Good'), subEntry(5, 'Bad'), subEntry(6, 'Bad')]

    const { slotted, custom } = assignNudgeSlots(entries)

    expect(slotted.map((s) => s?.id)).toEqual([1, 3, 5])
    expect(custom.map((s) => s.id)).toEqual([2, 4, 6])
  })
})
