import type { EntryCategory } from '../api/types'

// Translucent so the tint reads as a light wash in both Pico's light and dark themes.
const CATEGORY_TINTS: Record<EntryCategory, string> = {
  Good: 'rgba(34, 197, 94, 0.15)',
  Neutral: 'rgba(210, 180, 140, 0.25)',
  Bad: 'rgba(239, 68, 68, 0.15)',
}

export function categoryTint(category: EntryCategory): string {
  return CATEGORY_TINTS[category]
}
