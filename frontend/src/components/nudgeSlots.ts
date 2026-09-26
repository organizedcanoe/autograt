import type { EntryCategory, SubEntry } from '../api/types'

export interface NudgeSlot {
  label: string
  category: EntryCategory
  placeholder: string
}

// Two good boxes to one bad box nudges toward a positive ratio.
export const NUDGE_SLOTS: readonly NudgeSlot[] = [
  { label: 'Good thing 1', category: 'Good', placeholder: 'Something that went well…' },
  { label: 'Good thing 2', category: 'Good', placeholder: 'Something else you are grateful for…' },
  { label: 'Bad thing', category: 'Bad', placeholder: 'Something that could have gone better…' },
]

/**
 * Pairs each nudge slot with the earliest saved entry of its category; every other entry is custom.
 * Derived from the saved entries alone, so the layout is the same after a reload.
 */
export function assignNudgeSlots(subEntries: readonly SubEntry[]): {
  slotted: (SubEntry | undefined)[]
  custom: SubEntry[]
} {
  const remaining = [...subEntries]
  const slotted = NUDGE_SLOTS.map((slot) => {
    const index = remaining.findIndex((subEntry) => subEntry.category === slot.category)
    return index === -1 ? undefined : remaining.splice(index, 1)[0]
  })
  return { slotted, custom: remaining }
}
