import { COLOR_SCHEMES, THEME_COLORS, type ColorScheme, type ThemeColor } from '../theme/theme'
import { useTheme } from '../theme/useTheme'

// Icons keep the mode select narrow enough to share the nav on a phone.
const SCHEME_ICONS: Record<ColorScheme, string> = { system: '🖥️', light: '☀️', dark: '🌙' }

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Nav list items (render inside a nav <ul>); Pico shrinks selects there to match nav buttons. */
export default function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <li>
        <select
          aria-label="Mode"
          value={theme.scheme}
          onChange={(e) => setTheme({ ...theme, scheme: e.target.value as ColorScheme })}
        >
          {COLOR_SCHEMES.map((scheme) => (
            <option key={scheme} value={scheme} aria-label={capitalize(scheme)}>
              {SCHEME_ICONS[scheme]}
            </option>
          ))}
        </select>
      </li>
      <li>
        <select
          aria-label="Color"
          value={theme.color}
          onChange={(e) => setTheme({ ...theme, color: e.target.value as ThemeColor })}
        >
          {THEME_COLORS.map((color) => (
            <option key={color} value={color}>
              {capitalize(color)}
            </option>
          ))}
        </select>
      </li>
    </>
  )
}
