import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client'
import type { LoginResponse, User } from '../api/types'

interface Session {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  /** Registers and logs in, unless the new account is pending approval. Returns the new user. */
  register: (username: string, password: string) => Promise<User>
  logout: () => void
  /** Replaces the session with one the server issued, e.g. after a password or username change. */
  startSession: (response: LoginResponse) => void
}

const STORAGE_KEY = 'autograt.session'

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
function loadSession(): Session | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Session) : null
  } catch {
    return null
  }
}

function saveSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // The session still works for this tab; it just won't survive a reload.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = loadSession()
    // Set before children mount, so their first requests are already authenticated.
    setAuthToken(stored?.token ?? null)
    return stored
  })

  const applySession = useCallback((next: Session | null) => {
    setAuthToken(next?.token ?? null)
    saveSession(next)
    setSession(next)
  }, [])

  const startSession = useCallback(
    (response: LoginResponse) => applySession({ token: response.token, user: response.user }),
    [applySession],
  )

  const login = useCallback(
    async (username: string, password: string) => startSession(await api.login(username, password)),
    [startSession],
  )

  const register = useCallback(
    async (username: string, password: string) => {
      const user = await api.register(username, password)
      if (user.role !== 'Pending') await login(username, password)
      return user
    },
    [login],
  )

  const logout = useCallback(() => applySession(null), [applySession])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = useMemo(
    () => ({ user: session?.user ?? null, login, register, logout, startSession }),
    [session, login, register, logout, startSession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}
