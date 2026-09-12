import React, { useState } from 'react'
import { LockOpen, Lock, ShieldCheck, Download, Upload } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Input, Select } from '@/components/common/Input'
import { Modal } from '@/components/common/Modal'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { useProjects } from '@/hooks/useStore'

const AUTO_LOCK_OPTIONS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: 0 },
]

export function SecuritySettings() {
  const { desktop, initialized, unlocked, autoLockMinutes, setAutoLock, lock, changeMasterPassword } = useVault()
  const { show } = useToast()
  const [showChangePw, setShowChangePw] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)

  if (!desktop) {
    return (
      <div className="max-w-lg space-y-3">
        <p className="text-sm text-ink-400">
          Security settings apply to the local encrypted vault, which requires Desktop Mode
          (<code className="text-ink-300">npm run tauri:dev</code>). Nothing sensitive is ever stored while running in
          the browser.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <span className="block text-xs font-medium text-ink-400 mb-1.5">Vault Status</span>
        <div className="flex items-center gap-2 rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2.5">
          {!initialized ? (
            <>
              <Lock size={15} className="text-amber-400" />
              <span className="text-sm text-ink-200">Not set up yet — visit Secrets & Keys to create a master password.</span>
            </>
          ) : unlocked ? (
            <>
              <LockOpen size={15} className="text-emerald-400" />
              <span className="text-sm text-ink-200">Unlocked</span>
              <div className="flex-1" />
              <button onClick={() => lock()} className="text-xs text-accent-400 hover:text-accent-300">Lock Vault Now</button>
            </>
          ) : (
            <>
              <Lock size={15} className="text-ink-400" />
              <span className="text-sm text-ink-200">Locked</span>
            </>
          )}
        </div>
      </div>

      {initialized && (
        <>
          <div>
            <Select
              label="Auto Lock"
              value={autoLockMinutes}
              onChange={(e) => setAutoLock(Number(e.target.value)).then(() => show('Auto-lock updated'))}
            >
              {AUTO_LOCK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <p className="text-xs text-ink-500 mt-1.5">
              The vault automatically locks — and its encryption key is cleared from memory — after this much
              inactivity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => setShowChangePw(true)}>Change Master Password</Button>
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={() => setShowExport(true)}>Export Encrypted Backup</Button>
            <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowImport(true)}>Import Encrypted Backup</Button>
          </div>

          <div className="rounded-lg border border-dashed border-surface-500 px-3.5 py-3 text-xs text-ink-500 leading-relaxed">
            There is intentionally no "Forgot Password" option. If your master password is lost, encrypted secrets
            cannot be recovered — export a backup regularly and keep your master password somewhere safe (like a
            physical note, not this app).
          </div>

          <MigrateDataRow />
        </>
      )}

      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} onSubmit={changeMasterPassword} />
      <ExportBackupModal open={showExport} onClose={() => setShowExport(false)} />
      <ImportBackupModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  )
}

function ChangePasswordModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (current: string, next: string) => Promise<void>
}) {
  const { show } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New master password must be at least 8 characters.')
    if (next !== confirm) return setError('New passwords do not match.')
    setBusy(true)
    try {
      await onSubmit(current, next)
      show('Master password changed')
      setCurrent(''); setNext(''); setConfirm('')
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change Master Password" size="sm">
      <form onSubmit={submit} className="space-y-3">
        <Input label="Current Master Password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="New Master Password" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirm New Master Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <p className="text-xs text-ink-500">Every secret in the vault is re-encrypted under the new password.</p>
        <Button type="submit" className="w-full justify-center" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</Button>
      </form>
    </Modal>
  )
}

function ExportBackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show } = useToast()
  const [busy, setBusy] = useState(false)

  async function doExport() {
    setBusy(true)
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const stamp = new Date().toISOString().slice(0, 10)
      const path = await save({
        defaultPath: `nexforge-backup-${stamp}.nexforgevault`,
        filters: [{ name: 'Nexforge Vault Backup', extensions: ['nexforgevault'] }],
      })
      if (!path) return
      await vaultApi.backupExport(path)
      show('Encrypted backup exported')
      onClose()
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Encrypted Backup"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">Cancel</button>
          <Button onClick={doExport} disabled={busy}>{busy ? 'Exporting…' : 'Choose Location & Export'}</Button>
        </>
      }
    >
      <p className="text-sm text-ink-300">
        Creates a <code className="text-ink-100">.nexforgevault</code> file with every project, invoice-free
        credential, secret and password — still fully encrypted. It can only be restored with the master password
        that was active when it was created.
      </p>
    </Modal>
  )
}

function ImportBackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show } = useToast()
  const [path, setPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ secrets: number; passwords: number; databases: number; projects: number; created_at: string } | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function pickFile() {
    const { open: openDialog } = await import('@tauri-apps/plugin-dialog')
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Nexforge Vault Backup', extensions: ['nexforgevault'] }],
    })
    if (!selected || Array.isArray(selected)) return
    setPath(selected)
    try {
      const p = await vaultApi.backupPreview(selected)
      setPreview(p)
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function restore() {
    if (!path) return
    setBusy(true)
    try {
      await vaultApi.backupRestore(path, password)
      show('Backup restored — reloading')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Encrypted Backup" size="sm">
      <div className="space-y-3">
        <Button variant="secondary" onClick={pickFile} className="w-full justify-center">Choose Backup File</Button>
        {preview && (
          <div className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-3 text-xs text-ink-300 space-y-1">
            <div>Created: {new Date(preview.created_at).toLocaleString()}</div>
            <div>{preview.projects} projects · {preview.secrets} secrets · {preview.passwords} passwords · {preview.databases} databases</div>
          </div>
        )}
        {preview && (
          <>
            <Input label="Master password for this backup" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-amber-300/90">This replaces everything currently in your local vault.</p>
            <Button onClick={restore} disabled={busy} className="w-full justify-center">{busy ? 'Restoring…' : 'Restore Backup'}</Button>
          </>
        )}
      </div>
    </Modal>
  )
}

function MigrateDataRow() {
  const [projects] = useProjects()
  const { show } = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function migrate() {
    setBusy(true)
    try {
      const count = await vaultApi.projectsMigrate(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client || null,
          description: p.description || null,
          status: p.status || null,
          framework: p.framework || null,
          backend: p.backend || null,
          database_type: p.database || null,
          hosting: p.hosting || null,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        })),
      )
      setDone(true)
      show(`${count} project${count === 1 ? '' : 's'} synced to the local database`)
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-3">
      <p className="text-xs text-ink-300 mb-2">
        Projects, invoices, clients and notes currently live in this browser's local storage (Phase 1). Your
        real secrets always live only in the encrypted vault above — this just mirrors project records into the
        local database so the vault can link credentials to them reliably.
      </p>
      <Button size="sm" variant="secondary" onClick={migrate} disabled={busy}>
        {busy ? 'Migrating…' : done ? 'Migrated ✓ — Run Again' : 'Migrate Existing Data'}
      </Button>
    </div>
  )
}
