import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  USER_STORAGE_KEY,
  getStoredToken,
  onUnauthorized,
  setStoredToken,
} from '@/services/api'
import { authService, type LoginPayload, type RegisterPayload } from '@/services/authService'
import type { User } from '@/types'

export interface AuthContextValue {
  user: User | null
  token: string | null
  initialising: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function cacheUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_STORAGE_KEY)
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  // Hydrate from cache first so a refresh doesn't flash the login screen.
  const [user, setUser] = useState<User | null>(() => (getStoredToken() ? readCachedUser() : null))
  const [initialising, setInitialising] = useState<boolean>(() => Boolean(getStoredToken()))

  const clearSession = useCallback(() => {
    setStoredToken(null)
    cacheUser(null)
    setToken(null)
    setUser(null)
  }, [])

  // Any 401 from a protected endpoint ends the session.
  useEffect(() => {
    onUnauthorized(() => clearSession())
    return () => onUnauthorized(null)
  }, [clearSession])

  // Validate the stored token against the API exactly once on boot.
  useEffect(() => {
    let cancelled = false
    const stored = getStoredToken()
    if (!stored) {
      setInitialising(false)
      return
    }

    authService
      .me()
      .then((fresh) => {
        if (cancelled) return
        setUser(fresh)
        cacheUser(fresh)
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
      .finally(() => {
        if (!cancelled) setInitialising(false)
      })

    return () => {
      cancelled = true
    }
  }, [clearSession])

  const adopt = useCallback((accessToken: string, nextUser: User) => {
    setStoredToken(accessToken)
    cacheUser(nextUser)
    setToken(accessToken)
    setUser(nextUser)
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const data = await authService.login(payload)
      adopt(data.access_token, data.user)
      return data.user
    },
    [adopt],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await authService.register(payload)
      adopt(data.access_token, data.user)
      return data.user
    },
    [adopt],
  )

  const refresh = useCallback(async () => {
    const fresh = await authService.me()
    setUser(fresh)
    cacheUser(fresh)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initialising,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout: clearSession,
      refresh,
    }),
    [user, token, initialising, login, register, clearSession, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
