import type { EntryCategory } from '../api/types'

// Translucent so the tint reads as a light wash in both Pico's light and dark themes.
const CATEGORY_COLORS: Record<EntryCategory, { rgb: string; alpha: number }> = {
  Good: { rgb: '34, 197, 94', alpha: 0.15 },
  Neutral: { rgb: '210, 180, 140', alpha: 0.25 },
  Bad: { rgb: '239, 68, 68', alpha: 0.15 },
}

function tint(category: EntryCategory, alphaScale: number): string {
  const { rgb, alpha } = CATEGORY_COLORS[category]
  return `rgba(${rgb}, ${alpha * alphaScale})`
}

export function categoryTint(category: EntryCategory): string {
  return tint(category, 1)
}

/**
 * For a tinted card's header and footer, which Pico paints over the card's background. Layered on the card tint at
 * half strength, the sections read as a slightly deeper shade without turning muddy in dark mode.
 */
export function categorySectionTint(category: EntryCategory): string {
  return tint(category, 0.5)
}
