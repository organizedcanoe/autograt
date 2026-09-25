import { useState } from 'react'
import { applyTheme, loadTheme, saveTheme, type Theme } from './theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(loadTheme)

  function setTheme(next: Theme) {
    applyTheme(next)
    saveTheme(next)
    setThemeState(next)
  }

  return { theme, setTheme }
}
