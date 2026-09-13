import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// The JWT is stored in localStorage. This is acceptable for a bearer token
// with a short (7 day) server-side expiry — it is not a raw secret the way
// a vault value is. Vault secret VALUES are never stored here or in
// localStorage; they only ever live transiently in component state after an
// explicit "reveal" call (see src/data/coreClient.ts vaultApi).
const TOKEN_KEY = 'nexforge_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

interface User {
  id: string
  email: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  sendOtp: (email: string) => Promise<{ ok: boolean; message: string }>
  verifyOtp: (email: string, code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Thrown for a failed API call. Carries `waitSeconds` when the backend's
// rate-limit response included one (see /api/auth/send-otp's 429), so the
// login page can drive a countdown without re-parsing the message text.
export class ApiError extends Error {
  waitSeconds?: number
  constructor(message: string, waitSeconds?: number) {
    super(message)
    this.name = 'ApiError'
    this.waitSeconds = waitSeconds
  }
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, data.waitSeconds)
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('invalid session')
      const me = await res.json()
      setUser({ id: me.id, email: me.email })
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost('/api/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiPost('/api/auth/register', { email, password })
    setToken(data.token)
    setUser(data.user)
  }, [])

  // Sends a login code by email. Always resolves with a generic success
  // message (the backend never reveals whether the email is registered) —
  // it only rejects for rate limiting or a malformed request.
  const sendOtp = useCallback(async (email: string) => {
    const data = await apiPost('/api/auth/send-otp', { email })
    return { ok: true, message: data.message as string }
  }, [])

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await apiPost('/api/auth/verify-otp', { email, code })
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    // Stateless JWTs — there's no server-side session to invalidate. The
    // POST here exists only for symmetry/future use (see
    // server/src/routes/auth.js) and is fire-and-forget; the actual logout
    // is discarding the token below, which happens regardless of whether
    // this request succeeds.
    const token = getToken()
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
