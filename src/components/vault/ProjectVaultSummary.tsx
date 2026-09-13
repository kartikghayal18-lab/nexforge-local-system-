import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Database as DbIcon, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { vaultApi } from '@/vault/tauriClient'

export function ProjectVaultSummary({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<{ secrets: number; passwords: number; databases: number } | null>(null)

  useEffect(() => {
    let cancelled = false
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
  }, [projectId])

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

      <div className="flex items-center gap-4 text-xs text-ink-300 mb-3">
        <span className="inline-flex items-center gap-1.5"><KeyRound size={12} className="text-accent-400" /> {counts?.secrets ?? '—'} Environment Variables</span>
        <span className="inline-flex items-center gap-1.5"><Lock size={12} className="text-emerald-400" /> {counts?.passwords ?? '—'} Passwords</span>
        <span className="inline-flex items-center gap-1.5"><DbIcon size={12} className="text-amber-400" /> {counts?.databases ?? '—'} Database credentials</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => navigate(`/projects/${projectId}/vault?tab=env`)}>Add Variable</Button>
        <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => navigate(`/projects/${projectId}/vault?tab=passwords`)}>Add Password</Button>
      </div>
    </section>
  )
}
