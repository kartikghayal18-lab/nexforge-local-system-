import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { coreApi } from '@/data/coreClient'
import type { OwnerProfile } from '@/data/coreTypes'
import { useAuth } from '@/auth/AuthContext'

interface ProfileContextValue {
  profile: OwnerProfile | null
  loading: boolean
  isComplete: boolean
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

// Fetches the owner profile once per authenticated session and exposes
// whether first-run setup is still needed (profile_completed_at is null).
// Mounted inside ProtectedRoute (App.tsx) so it only ever runs while
// authenticated, and re-fetches whenever the auth'd user changes (login →
// logout → different login, e.g. after account deletion + a fresh signup).
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const p = await coreApi.profileGet()
      setProfile(p)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isComplete = !!profile?.profile_completed_at

  return (
    <ProfileContext.Provider value={{ profile, loading, isComplete, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
