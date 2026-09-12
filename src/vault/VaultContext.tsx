import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { vaultApi, isDesktop } from './tauriClient'
import type { VaultStatus } from './types'

interface VaultContextValue {
  desktop: boolean
  loading: boolean
  initialized: boolean
  unlocked: boolean
  autoLockMinutes: number
  error: string | null
  refresh: () => Promise<void>
  createVault: (masterPassword: string) => Promise<void>
  unlock: (masterPassword: string) => Promise<void>
  lock: () => Promise<void>
  setAutoLock: (minutes: number) => Promise<void>
  changeMasterPassword: (current: string, next: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const desktop = isDesktop()
  const [loading, setLoading] = useState(desktop)
  const [status, setStatus] = useState<VaultStatus>({ initialized: false, unlocked: false, auto_lock_minutes: 15 })
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (!desktop) {
      setLoading(false)
      return
    }
    try {
      const s = await vaultApi.status()
      setStatus(s)
    } catch {
      // desktop bridge not ready yet — ignore, next poll will retry
    } finally {
      setLoading(false)
    }
  }, [desktop])

  useEffect(() => {
    refresh()
    if (!desktop) return
    pollRef.current = window.setInterval(refresh, 10_000)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [desktop, refresh])

  // Reset the backend's inactivity timer on real user interaction, throttled.
  useEffect(() => {
    if (!desktop || !status.unlocked) return
    let last = 0
    function onActivity() {
      const now = Date.now()
      if (now - last < 15_000) return
      last = now
      vaultApi.touchActivity().catch(() => {})
    }
    window.addEventListener('mousedown', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('mousedown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [desktop, status.unlocked])

  const createVault = useCallback(async (masterPassword: string) => {
    setError(null)
    try {
      await vaultApi.create(masterPassword)
      await refresh()
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [refresh])

  const unlock = useCallback(async (masterPassword: string) => {
    setError(null)
    try {
      await vaultApi.unlock(masterPassword)
      await refresh()
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [refresh])

  const lock = useCallback(async () => {
    await vaultApi.lock()
    await refresh()
  }, [refresh])

  const setAutoLock = useCallback(async (minutes: number) => {
    await vaultApi.setAutoLock(minutes)
    await refresh()
  }, [refresh])

  const changeMasterPassword = useCallback(async (current: string, next: string) => {
    setError(null)
    try {
      await vaultApi.changeMasterPassword(current, next)
      await refresh()
    } catch (e) {
      setError(String(e))
      throw e
    }
  }, [refresh])

  const value: VaultContextValue = {
    desktop,
    loading,
    initialized: status.initialized,
    unlocked: status.unlocked,
    autoLockMinutes: status.auto_lock_minutes,
    error,
    refresh,
    createVault,
    unlock,
    lock,
    setAutoLock,
    changeMasterPassword,
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}

/** Copies a value to the clipboard and best-effort clears it again after `ms`. */
export async function copySecurely(value: string, ms = 60_000): Promise<void> {
  await navigator.clipboard.writeText(value)
  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText()
      if (current === value) {
        await navigator.clipboard.writeText('')
      }
    } catch {
      // Clipboard read can be blocked by the OS/browser — best effort only.
    }
  }, ms)
}
