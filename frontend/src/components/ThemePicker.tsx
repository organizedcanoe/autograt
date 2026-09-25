import { COLOR_SCHEMES, THEME_COLORS, type ColorScheme, type ThemeColor } from '../theme/theme'
import { useTheme } from '../theme/useTheme'

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <fieldset role="group">
      <select
        aria-label="Mode"
        value={theme.scheme}
        onChange={(e) => setTheme({ ...theme, scheme: e.target.value as ColorScheme })}
      >
        {COLOR_SCHEMES.map((scheme) => (
          <option key={scheme} value={scheme}>
            {capitalize(scheme)}
          </option>
        ))}
      </select>
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
    </fieldset>
  )
}
