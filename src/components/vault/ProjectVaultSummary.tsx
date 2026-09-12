import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Database as DbIcon, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'

export function ProjectVaultSummary({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const { desktop, unlocked } = useVault()
  const [counts, setCounts] = useState<{ secrets: number; passwords: number; databases: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!desktop || !unlocked) {
      setCounts(null)
      return
    }
    Promise.all([
      vaultApi.secretsList(projectId),
      vaultApi.passwordsList(projectId),
      vaultApi.databasesList(projectId),
    ]).then(([s, p, d]) => {
      if (!cancelled) setCounts({ secrets: s.length, passwords: p.length, databases: d.length })
    }).catch(() => {
      if (!cancelled) setCounts(null)
    })
    return () => { cancelled = true }
  }, [desktop, unlocked, projectId])

  return (
    <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-ink-500" />
          <h2 className="text-sm font-semibold text-ink-100">Secrets & Environment</h2>
        </div>
        <button onClick={() => navigate(`/projects/${projectId}/vault`)} className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-0.5">
          Open Vault <ArrowRight size={12} />
        </button>
      </div>

      {!desktop ? (
        <p className="text-xs text-ink-500 leading-relaxed">
          Secure vault requires Desktop Mode (<code className="text-ink-400">npm run tauri:dev</code>). Credentials are
          encrypted and stored by the Rust backend, never in the browser.
        </p>
      ) : !unlocked ? (
        <p className="text-xs text-ink-500 leading-relaxed">
          Vault is locked. Unlock it from the top bar to see this project's environment variables, passwords and
          database credentials.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs text-ink-300 mb-3">
            <span className="inline-flex items-center gap-1.5"><KeyRound size={12} className="text-accent-400" /> {counts?.secrets ?? '—'} Environment Variables</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={12} className="text-emerald-400" /> {counts?.passwords ?? '—'} Passwords</span>
            <span className="inline-flex items-center gap-1.5"><DbIcon size={12} className="text-amber-400" /> {counts?.databases ?? '—'} Database credentials</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => navigate(`/projects/${projectId}/vault?tab=env`)}>Add Variable</Button>
            <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => navigate(`/projects/${projectId}/vault?tab=passwords`)}>Add Password</Button>
          </div>
        </>
      )}
    </section>
  )
}
