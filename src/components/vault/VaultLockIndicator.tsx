import React, { useState } from 'react'
import { Lock, LockOpen, Laptop } from 'lucide-react'
import { useVault } from '@/vault/VaultContext'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

export function VaultLockIndicator() {
  const { desktop, initialized, unlocked, unlock, lock, error } = useVault()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  if (!desktop) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-500 border border-surface-500 rounded-full px-2.5 py-1">
        <Laptop size={12} /> Browser mode
      </span>
    )
  }

  if (!initialized) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-400 border border-amber-500/25 bg-amber-500/10 rounded-full px-2.5 py-1">
        <Lock size={12} /> Vault not set up
      </span>
    )
  }

  async function submitUnlock(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await unlock(pw)
      setPw('')
      setOpen(false)
    } catch {
      // shown via error
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) {
    return (
      <button
        onClick={() => lock()}
        title="Click to lock the vault"
        className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 border border-emerald-500/25 bg-emerald-500/10 rounded-full px-2.5 py-1 hover:bg-emerald-500/20 transition-colors"
      >
        <LockOpen size={12} /> Vault Unlocked
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-300 border border-surface-500 bg-surface-300 rounded-full px-2.5 py-1 hover:bg-surface-400 transition-colors"
      >
        <Lock size={12} /> Vault Locked
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Unlock Vault" size="sm">
        <form onSubmit={submitUnlock} className="space-y-3">
          <Input label="Master Password" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button type="submit" className="w-full justify-center" disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      </Modal>
    </>
  )
}
