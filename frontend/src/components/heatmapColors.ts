// A faint wash of Pico's muted text color, so empty days stay visible but subdued in light and dark mode.
export const NO_ENTRY_COLOR = 'color-mix(in srgb, var(--pico-muted-color) 30%, transparent)'

const RED_HUE = 0
const GREEN_HUE = 120
const SATURATION = 0.75
const LIGHTNESS = 0.45
const MAX_RATING = 10

const BLACK = '#000000'
const WHITE = '#ffffff'

function ratingHue(rating: number): number {
  return RED_HUE + ((GREEN_HUE - RED_HUE) * rating) / MAX_RATING
}

/** One smooth scale from red (0) through amber to green (10), an equal hue step per rating point. */
export function ratingColor(rating: number | null): string {
  if (rating === null) return NO_ENTRY_COLOR
  return `hsl(${ratingHue(rating)}, ${SATURATION * 100}%, ${LIGHTNESS * 100}%)`
}

/** Black or white, whichever contrasts more with the rating's colour: white on the reds, black on the ambers and greens. */
export function ratingTextColor(rating: number): string {
  const background = relativeLuminance(ratingHue(rating))
  const onWhite = 1.05 / (background + 0.05)
  const onBlack = (background + 0.05) / 0.05
  return onWhite >= onBlack ? WHITE : BLACK
}

/** WCAG relative luminance of the rating colour with this hue. */
function relativeLuminance(hue: number): number {
  // The standard HSL to RGB conversion.
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    return LIGHTNESS - SATURATION * Math.min(LIGHTNESS, 1 - LIGHTNESS) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  const [r, g, b] = [channel(0), channel(8), channel(4)].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
