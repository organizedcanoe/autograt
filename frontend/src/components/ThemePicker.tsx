import { COLOR_SCHEMES, THEME_COLORS, type ColorScheme, type Theme, type ThemeColor } from '../theme/theme'

const SCHEME_ICONS: Record<ColorScheme, string> = { system: '🖥️', light: '☀️', dark: '🌙' }

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

interface ThemePickerProps {
  theme: Theme
  onChange: (next: Theme) => void
}

export default function ThemePicker({ theme, onChange }: ThemePickerProps) {
  return (
    <div className="grid">
      <label>
        Mode
        <select
          value={theme.scheme}
          onChange={(e) => onChange({ ...theme, scheme: e.target.value as ColorScheme })}
        >
          {COLOR_SCHEMES.map((scheme) => (
            <option key={scheme} value={scheme}>
              {SCHEME_ICONS[scheme]} {capitalize(scheme)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Color
        <select value={theme.color} onChange={(e) => onChange({ ...theme, color: e.target.value as ThemeColor })}>
          {THEME_COLORS.map((color) => (
            <option key={color} value={color}>
              {capitalize(color)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
