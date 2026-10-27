import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, loadSession, saveSession, setUnauthorizedHandler } from '@/lib/api'
import type { Session } from '@/lib/types'

type AuthContextValue = {
  session: Session | null
  ready: boolean
  login: (email: string, password: string) => Promise<Session>
  register: (input: { orgName?: string; name: string; email: string; password: string }) => Promise<Session>
  logout: () => void
  switchOrganization: (organizationId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      saveSession(null)
      setSession(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let active = true
    async function refresh() {
      if (!session) {
        setReady(true)
        return
      }
      try {
        const fresh = await api.get<Session>('/auth/me')
        if (active) {
          saveSession(fresh)
          setSession(fresh)
        }
      } catch (error) {
        if (active && error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          saveSession(null)
          setSession(null)
        }
      } finally {
        if (active) setReady(true)
      }
    }
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const next = await api.post<Session>('/auth/login', { email, password })
    saveSession(next)
    setSession(next)
    return next
  }, [])

  const register = useCallback(
    async (input: { orgName?: string; name: string; email: string; password: string }) => {
      const next = await api.post<Session>('/auth/register', input)
      saveSession(next)
      setSession(next)
      return next
    },
    [],
  )

  const logout = useCallback(() => {
    saveSession(null)
    setSession(null)
  }, [])

  const switchOrganization = useCallback(async (organizationId: string) => {
    const next = await api.post<Session>('/auth/switch-org', { organizationId })
    saveSession(next)
    setSession(next)
  }, [])

  const value = useMemo(
    () => ({ session, ready, login, register, logout, switchOrganization }),
    [session, ready, login, register, logout, switchOrganization],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return context
}
