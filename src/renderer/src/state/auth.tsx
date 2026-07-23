import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser } from '../../../shared/types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  hasUser: boolean
  refreshHasUser: () => Promise<void>
  login: (email: string, password: string) => Promise<AuthUser | null>
  setup: (email: string, password: string, name: string) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'crm.session.user'

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })
  const [hasUser, setHasUser] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshHasUser = async (): Promise<void> => {
    const exists = await window.api.auth.hasUser()
    setHasUser(exists)
  }

  useEffect(() => {
    refreshHasUser().finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string): Promise<AuthUser | null> => {
    const result = await window.api.auth.login(email, password)
    if (result) {
      setUser(result)
      localStorage.setItem(SESSION_KEY, JSON.stringify(result))
    }
    return result
  }

  const setup = async (email: string, password: string, name: string): Promise<AuthUser> => {
    const result = await window.api.auth.setup(email, password, name)
    setUser(result)
    localStorage.setItem(SESSION_KEY, JSON.stringify(result))
    setHasUser(true)
    return result
  }

  const logout = (): void => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasUser, refreshHasUser, login, setup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
