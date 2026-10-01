import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { applyTheme, loadTheme, saveTheme, THEME_SETTINGS, themeFromSettings, type Theme } from './theme'

interface ThemeContextValue {
  theme: Theme
  /** Applies the theme straight away, then saves the parts that changed to the user's settings. */
  setTheme: (next: Theme) => Promise<void>
  /** Fetches and applies the saved theme again, e.g. after an import changed it. */
  reloadTheme: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * The user's settings on the server hold their theme. A copy is cached in the browser so the
 * login page and the first paint use it too, before the settings have loaded.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  // A change made while the settings are loading wins over the loaded (older) theme.
  const changedWhileLoading = useRef(false)

  const showTheme = useCallback((next: Theme) => {
    applyTheme(next)
    saveTheme(next)
    setThemeState(next)
  }, [])

  useEffect(() => {
    if (userId === undefined) return
    let current = true
    changedWhileLoading.current = false

    api.getSettings().then(
      (settings) => {
        if (current && !changedWhileLoading.current) showTheme(themeFromSettings(settings))
      },
      // Keep the cached theme; saving a change on the settings page reports any failure.
      () => {},
    )

    return () => {
      current = false
    }
  }, [userId, showTheme])

  const setTheme = useCallback(
    async (next: Theme) => {
      changedWhileLoading.current = true
      showTheme(next)
      const changed = (Object.keys(THEME_SETTINGS) as (keyof Theme)[]).filter((key) => next[key] !== theme[key])
      await Promise.all(changed.map((key) => api.updateSetting(THEME_SETTINGS[key], [next[key]])))
    },
    [theme, showTheme],
  )

  const reloadTheme = useCallback(async () => {
    showTheme(themeFromSettings(await api.getSettings()))
  }, [showTheme])

  const value = useMemo(() => ({ theme, setTheme, reloadTheme }), [theme, setTheme, reloadTheme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.')
  return context
}
