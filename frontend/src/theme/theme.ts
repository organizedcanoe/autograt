export const COLOR_SCHEMES = ['system', 'light', 'dark'] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

// A subset of Pico's built-in theme colors; each must also be listed in pico.scss.
export const THEME_COLORS = ['azure', 'jade', 'violet', 'pumpkin', 'pink', 'slate'] as const
export type ThemeColor = (typeof THEME_COLORS)[number]

export interface Theme {
  scheme: ColorScheme
  color: ThemeColor
}

export const DEFAULT_THEME: Theme = { scheme: 'system', color: 'azure' }

const STORAGE_KEY = 'autograt.theme'

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

export function loadTheme(): Theme {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof saved !== 'object' || saved === null) return DEFAULT_THEME
    const { scheme, color } = saved as Record<string, unknown>
    return {
      scheme: isOneOf(COLOR_SCHEMES, scheme) ? scheme : DEFAULT_THEME.scheme,
      color: isOneOf(THEME_COLORS, color) ? color : DEFAULT_THEME.color,
    }
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
}

/** Pico reads data-theme (absent = follow the OS); pico.scss maps data-color to Pico's accent colors. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme.scheme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme.scheme)
  root.setAttribute('data-color', theme.color)
}
