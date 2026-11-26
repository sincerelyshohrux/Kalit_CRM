import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/api'
import type { LoginResponse, User } from '@/lib/types'

type Status = 'loading' | 'authenticated' | 'guest'

interface AuthState {
  status: Status
  user: User | null
  login: (phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUserState] = useState<User | null>(null)
  const queryClient = useQueryClient()

  const reset = useCallback(() => {
    setAccessToken(null)
    setUserState(null)
    setStatus('guest')
    queryClient.clear()
  }, [queryClient])

  // Sahifa yuklanganda: httpOnly cookie orqali sessiyani tiklashga urinamiz
  useEffect(() => {
    setSessionExpiredHandler(reset)
    let cancelled = false
    ;(async () => {
      const ok = await refreshSession()
      if (!ok) {
        if (!cancelled) setStatus('guest')
        return
      }
      try {
        const me = await api<User>('/auth/me/')
        if (!cancelled) {
          setUserState(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) reset()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reset])

  const login = useCallback(async (phone: string, password: string) => {
    const data = await api<LoginResponse>('/auth/login/', {
      method: 'POST',
      body: { phone, password },
      noRetry: true,
    })
    setAccessToken(data.access)
    setUserState(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout/', { method: 'POST', noRetry: true })
    } catch {
      /* sessiya allaqachon tugagan bo'lishi mumkin */
    }
    reset()
  }, [reset])

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, setUser: setUserState }),
    [status, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return ctx
}

export function homePathFor(user: User | null) {
  return user?.role === 'superadmin' ? '/platform' : '/app'
}
