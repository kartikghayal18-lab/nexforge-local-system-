import React, { useState } from 'react'
import { Lock, ShieldCheck, Laptop, AlertTriangle, type LucideIcon } from 'lucide-react'
import { useVault } from '@/vault/VaultContext'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

/**
 * Gates any vault-backed content (secrets, passwords, database credentials).
 * Non-sensitive pages (Projects, Invoices, Clients) never use this — they
 * stay fully browsable whether the vault is locked or not, per spec.
 */
export function VaultGuard({ children }: { children: React.ReactNode }) {
  const { desktop, loading, initialized, unlocked } = useVault()

  if (loading) {
    return <CenteredCard icon={ShieldCheck} title="Checking vault status…" />
  }

  if (!desktop) {
    return (
      <CenteredCard
        icon={Laptop}
        title="Secure vault requires Desktop Mode"
        description="API keys, passwords and database credentials are encrypted and stored by the Tauri/Rust backend, which is only available when running the desktop app."
      >
        <code className="block mt-3 rounded-lg bg-surface-300 border border-surface-500 px-3 py-2 text-xs text-ink-300">
          npm run tauri:dev
        </code>
        <p className="text-xs text-ink-500 mt-3">
          Everything else — projects, invoices, clients, notes — works normally in the browser.
        </p>
      </CenteredCard>
    )
  }

  if (!initialized) {
    return <CreateMasterPasswordCard />
  }

  if (!unlocked) {
    return <UnlockCard />
  }

  return <>{children}</>
}

function CenteredCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-surface-400 bg-surface-200 px-6 py-14 text-center max-w-lg mx-auto">
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-accent-500/15 text-accent-400 mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink-100">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1.5 max-w-sm">{description}</p>}
      {children}
    </div>
  )
}

function CreateMasterPasswordCard() {
  const { createVault, error } = useVault()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (pw.length < 8) {
      setLocalError('Master password must be at least 8 characters.')
      return
    }
    if (pw !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await createVault(pw)
    } catch {
      // error surfaced via vault.error
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto rounded-xl border border-surface-400 bg-surface-200 p-6">
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-accent-500/15 text-accent-400 mb-4 mx-auto">
        <Lock size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink-100 text-center">Create Master Password</h3>
      <p className="text-sm text-ink-500 text-center mt-1.5 mb-5">
        This unlocks your local encrypted vault. It never leaves your device.
      </p>

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 mb-5">
        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/90 leading-relaxed">
          Nexforge Studio Manager cannot recover your master password. If it's lost, encrypted
          secrets cannot be recovered either — that's by design.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Input label="Master Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <Input label="Confirm Master Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {(localError || error) && <p className="text-xs text-rose-400">{localError ?? error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? 'Creating…' : 'Create Vault'}
        </Button>
      </form>
    </div>
  )
}

function UnlockCard() {
  const { unlock, error } = useVault()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await unlock(pw)
      setPw('')
    } catch {
      // error surfaced via vault.error
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto rounded-xl border border-surface-400 bg-surface-200 p-6">
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-accent-500/15 text-accent-400 mb-4 mx-auto">
        <Lock size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink-100 text-center">Vault Locked</h3>
      <p className="text-sm text-ink-500 text-center mt-1.5 mb-5">Enter your master password to unlock.</p>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Master Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  )
}
